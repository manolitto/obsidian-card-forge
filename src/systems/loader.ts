import { load } from "js-yaml";
import { buildAliasMap, type AliasMap } from "../definitions/bindings";
import { mergeCardSettings, type CardSettings } from "../definitions/card-settings";
import { mergeClassifiers, type Classifiers } from "../definitions/classifiers";
import { IGNORE_DIAGNOSTICS, type Diagnostics } from "../definitions/diagnostics";
import { mergeGlyphTables, type GlyphTables } from "../definitions/glyphs";
import {
  parseSystemDeclaration,
  parseSystemPath,
  type CardTypeDeclaration,
  type SystemDeclaration,
  type SystemPath,
} from "../definitions/game-system";
import { resolvePropertyDefs, type PropertyDefsMap } from "../definitions/property-defs";
import { mergeTranslations, type TranslationTables } from "../definitions/translations";
import { inlineStylesheet } from "./assets";
import { BASELINE } from "./baseline";
import {
  documentAssetReferences,
  stylesheetReferences,
  templateAssetReferences,
  templatePartialCalls,
  templateStringLiterals,
  type Reference,
} from "./references";
import type { SystemSource } from "./source";

/**
 * A system, loaded: its declaration taken apart, every card type's definition
 * layers folded, and its files reachable through the source it came from.
 */
export interface LoadedSystem {
  id: string;
  declaration: SystemDeclaration;
  source: SystemSource;
  /** Keyed by card-type id, in declaration order. */
  cardTypes: Record<string, LoadedCardType>;
  /**
   * The stylesheet a card of this type renders under: baseline, then the
   * system's, then the card type's own, with every `url()` inlined.
   */
  stylesheet(cardTypeId: string): Promise<string>;
  /**
   * Files in the folder that nothing declares or refers to, and declared
   * partials no template calls. Data, not a report: a vault folder may
   * hold whatever its owner keeps beside the system, but every byte of a
   * bundled folder ships in the plugin, so the bundled test asserts both
   * empty.
   */
  unusedFiles: readonly SystemPath[];
  unusedPartials: readonly string[];
  /**
   * Every asset the root document names — a property's `default:`, a
   * classifier's token — that the folder has. The template engine reads
   * these before a render beside the literals it finds in the templates,
   * so a template may compute a path from a value: `{{asset (slot-class
   * "front-icon") inline=true}}`.
   */
  documentAssets: readonly SystemPath[];
}

export interface LoadedCardType {
  declaration: CardTypeDeclaration;
  /** Baseline → system → card type, resolved. */
  properties: PropertyDefsMap;
  /** Both binding directions of `properties`, folded — see `bindings.ts`. */
  aliases: AliasMap;
  /** The places this card type fills: every `slot:` target across `properties`. */
  slots: ReadonlySet<string>;
  /** System, then card type. Resolved per language at render, since the note picks it. */
  translations: TranslationTables;
  /** System, then card type, per slot. */
  glyphs: GlyphTables;
  classifiers: Classifiers;
  /**
   * Baseline → system → card type. The deck and the note fold on top at
   * render. The system's primary language sits under the system's own layer,
   * so a system that says nothing prints in the language it was written in.
   */
  cardSettings: CardSettings;
}

/**
 * Load a system from wherever its files are.
 *
 * Reads the source's root document, hands it to the definition layer, and
 * then checks the folder against the declaration:
 *
 *   1. every declared file exists, and every referenced asset exists — a
 *      miss is reported naming what declared or referenced it;
 *   2. every partial a template calls is declared — a call no declaration
 *      covers is reported naming the caller.
 *
 * The other direction — a file nothing names, a declared partial nothing
 * calls — costs a vault system nothing and is handed back as data
 * (`unusedFiles`, `unusedPartials`) rather than reported.
 *
 * Problems are reported, not thrown: a system with one broken card type
 * still shows its other four, and a face whose template is missing fails at
 * render, naming the path. A bundled system is held to zero reports by test.
 *
 * `expectedId` is the id the caller has on record — the manifest's, or the
 * settings entry's — and the document must agree: the document is the
 * authority, and a divergence is a system that is not what it was registered
 * as. Returns `undefined` only when there is no system to speak of.
 */
export async function loadSystem(
  source: SystemSource,
  expectedId: string,
  diagnostics: Diagnostics
): Promise<LoadedSystem | undefined> {
  let text: string;
  try {
    text = await source.readText(source.document);
  } catch {
    diagnostics.warn(`${source.root}: no ${source.document}; not a system`);
    return undefined;
  }

  let doc: unknown;
  try {
    doc = load(text);
  } catch (error) {
    diagnostics.warn(`${source.root}/${source.document}: ${describe(error)}`);
    return undefined;
  }

  const cardTypeDocuments = await spliceCardTypeDocuments(doc, source, diagnostics);
  const declaration = parseSystemDeclaration(doc, diagnostics);
  if (!declaration) return undefined;

  if (declaration.id !== expectedId) {
    diagnostics.warn(
      `${source.root}: ${source.document} declares id "${declaration.id}" but is registered as "${expectedId}"; not loading it`
    );
    return undefined;
  }

  const files = new Set<string>(await source.listFiles());
  const used = new Set<string>([source.document, ...cardTypeDocuments]);
  const report = (message: string): void =>
    diagnostics.warn(`${declaration.id}: ${message}`);

  // A declared root must exist; whether it does, it counts as used, so a
  // missing one is reported once and not again as unused.
  const declared = async (
    path: SystemPath | undefined,
    what: string
  ): Promise<string | undefined> => {
    if (!path) return undefined;
    used.add(path);
    if (!files.has(path)) {
      report(`${what} names "${path}", which does not exist`);
      return undefined;
    }
    return source.readText(path);
  };
  const referenced = (refs: Reference[], inFile: string): void => {
    for (const ref of refs) {
      const path = parseSystemPath(ref.path, `${inFile}, ${ref.where}`, diagnostics);
      if (!path) continue;
      used.add(path);
      if (!files.has(path)) {
        report(`${inFile}, ${ref.where} refers to "${path}", which does not exist`);
      }
    }
  };

  // ── Stylesheets, and what they refer to ──────────────────────────
  const systemCss = await declared(declaration.stylesheet, "stylesheet:");
  if (systemCss !== undefined)
    referenced(stylesheetReferences(systemCss), declaration.stylesheet!);

  // ── Templates: faces, partials, and the calls between them ───────
  const partialsCalled = new Map<string, string>(); // name → first caller
  const templates = new Map<string, string>(); // path → text, for the slot check
  const scanTemplate = (path: SystemPath, hbs: string): void => {
    templates.set(path, hbs);
    referenced(templateAssetReferences(hbs), path);
    for (const call of templatePartialCalls(hbs)) {
      if (!partialsCalled.has(call.path))
        partialsCalled.set(call.path, `${path}, ${call.where}`);
    }
  };
  for (const [name, path] of Object.entries(declaration.partialTemplates)) {
    const hbs = await declared(path, `partial-templates.${name}:`);
    if (hbs !== undefined) scanTemplate(path, hbs);
  }
  for (const cardType of Object.values(declaration.cardTypes)) {
    const context = `card-types.${cardType.id}.`;
    const front = await declared(cardType.frontTemplate, `${context}front-template:`);
    if (front !== undefined) scanTemplate(cardType.frontTemplate!, front);
    const back = await declared(cardType.backTemplate, `${context}back-template:`);
    if (back !== undefined) scanTemplate(cardType.backTemplate!, back);
    const css = await declared(cardType.stylesheet, `${context}stylesheet:`);
    if (css !== undefined) referenced(stylesheetReferences(css), cardType.stylesheet!);
  }
  if (declaration.markdownImagePartial) {
    partialsCalled.set(declaration.markdownImagePartial, "markdown-image-partial:");
  }
  const unusedPartials = Object.keys(declaration.partialTemplates).filter(
    (name) => !partialsCalled.has(name)
  );
  for (const [name, caller] of partialsCalled) {
    if (!(name in declaration.partialTemplates)) {
      report(
        `${caller} calls partial "${name}", which partial-templates: does not declare`
      );
    }
  }

  // ── The document's own references — a property's default, say ───
  const documentRefs = documentAssetReferences(doc);
  referenced(documentRefs, source.document);
  const documentAssets = [
    ...new Set(
      documentRefs
        .map((ref) => parseSystemPath(ref.path, ref.where, IGNORE_DIAGNOSTICS))
        .filter((path): path is SystemPath => path !== undefined && files.has(path))
    ),
  ];

  const unusedFiles = [...files].filter((file) => !used.has(file)) as SystemPath[];

  // ── Fold the layers ──────────────────────────────────────────────
  const cardTypes: Record<string, LoadedCardType> = {};
  for (const cardType of Object.values(declaration.cardTypes)) {
    const properties = resolvePropertyDefs([
      BASELINE.properties,
      declaration.properties,
      cardType.properties,
    ]);
    cardTypes[cardType.id] = {
      declaration: cardType,
      properties,
      aliases: buildAliasMap(properties),
      slots: slotVocabulary(properties),
      translations: mergeTranslations(declaration.translations, cardType.translations),
      glyphs: mergeGlyphTables(declaration.glyphs, cardType.glyphs),
      classifiers: mergeClassifiers(declaration.classifiers, cardType.classifiers),
      cardSettings: mergeCardSettings([
        BASELINE.cardSettings,
        { language: declaration.languages[0] },
        declaration.cardSettings,
        cardType.cardSettings,
      ]),
    };
  }

  checkSlots(declaration, cardTypes, templates, report);
  checkSampleTables(cardTypes, report);

  const stylesheets = new Map<string, Promise<string>>();
  return {
    id: declaration.id,
    declaration,
    source,
    cardTypes,
    stylesheet(cardTypeId) {
      let pending = stylesheets.get(cardTypeId);
      if (!pending) {
        pending = assembleStylesheet(source, declaration, cardTypeId);
        stylesheets.set(cardTypeId, pending);
      }
      return pending;
    },
    unusedFiles,
    unusedPartials,
    documentAssets,
  };
}

/**
 * A card type may be declared in a document of its own — `card-types.gear:
 * card-types/gear.yaml` — holding the card-type mapping, dedented, every
 * path in it still relative to the system folder. This reads each such
 * document and puts its mapping where the path stood, so the definition
 * layer sees one shape and a diagnostic inside the card type is worded the
 * same either way. A document that is missing, does not parse or is not a
 * mapping is reported naming it, and the card type is dropped.
 *
 * Only a card type may be declared this way: it is the one block a system
 * has several of, each the size of a small system on its own. A card-type
 * document has no key that could point further, so there is nothing to
 * guard against.
 *
 * Returns the paths so the loader can count them as used.
 */
async function spliceCardTypeDocuments(
  doc: unknown,
  source: SystemSource,
  diagnostics: Diagnostics
): Promise<SystemPath[]> {
  if (!isMapping(doc) || !isMapping(doc["card-types"])) return [];
  const cardTypes = doc["card-types"];
  const paths: SystemPath[] = [];
  for (const [id, entry] of Object.entries(cardTypes)) {
    if (typeof entry !== "string") continue;
    const context = `${source.root}: card-types.${id}`;
    const path = parseSystemPath(entry, context, diagnostics);
    if (path) paths.push(path);
    const mapping =
      path && (await readCardTypeDocument(path, context, source, diagnostics));
    // Assigning in place keeps the card type's position in the declaration
    // order; deleting drops it without a second report about it declaring
    // nothing.
    if (mapping) cardTypes[id] = mapping;
    else delete cardTypes[id];
  }
  return paths;
}

async function readCardTypeDocument(
  path: SystemPath,
  context: string,
  source: SystemSource,
  diagnostics: Diagnostics
): Promise<Record<string, unknown> | undefined> {
  let text: string;
  try {
    text = await source.readText(path);
  } catch {
    diagnostics.warn(`${context} names "${path}", which does not exist`);
    return undefined;
  }
  let mapping: unknown;
  try {
    mapping = load(text);
  } catch (error) {
    diagnostics.warn(`${context}: ${path}: ${describe(error)}`);
    return undefined;
  }
  if (!isMapping(mapping)) {
    diagnostics.warn(
      `${context}: ${path} must hold the card type as a mapping; ignoring it`
    );
    return undefined;
  }
  return mapping;
}

function isMapping(raw: unknown): raw is Record<string, unknown> {
  return typeof raw === "object" && raw !== null && !Array.isArray(raw);
}

async function assembleStylesheet(
  source: SystemSource,
  declaration: SystemDeclaration,
  cardTypeId: string
): Promise<string> {
  const cardType = declaration.cardTypes[cardTypeId];
  if (!cardType) {
    throw new Error(`${declaration.id} has no card type "${cardTypeId}"`);
  }
  const layers = [BASELINE.stylesheet];
  for (const path of [declaration.stylesheet, cardType.stylesheet]) {
    if (path) layers.push(await inlineStylesheet(await source.readText(path), source));
  }
  return layers.join("\n\n");
}

/**
 * The slot check. A place exists because a template reads it, so the
 * templates are the declaration and a binding is what can be wrong: a
 * `slot:` naming a place no template of the card type mentions reaches the
 * card nowhere. That catches a typo on either side — in the binding, or in
 * the template's read of a place somebody binds. The other direction is
 * not an error: one front may offer places no card type fills yet, and a
 * card type fills the ones it has something for. A partial is any card
 * type's, so its literals count for every one.
 */
function checkSlots(
  declaration: SystemDeclaration,
  cardTypes: Record<string, LoadedCardType>,
  templates: ReadonlyMap<string, string>,
  report: (message: string) => void
): void {
  const partialLiterals = new Set<string>();
  for (const path of Object.values(declaration.partialTemplates)) {
    for (const literal of templateStringLiterals(templates.get(path) ?? "")) {
      partialLiterals.add(literal);
    }
  }
  for (const cardType of Object.values(cardTypes)) {
    const mentioned = new Set(partialLiterals);
    for (const path of [
      cardType.declaration.frontTemplate,
      cardType.declaration.backTemplate,
    ]) {
      if (!path) continue;
      for (const literal of templateStringLiterals(templates.get(path) ?? "")) {
        mentioned.add(literal);
      }
    }
    for (const [property, def] of Object.entries(cardType.properties)) {
      for (const slot of def.slot ?? []) {
        if (!mentioned.has(slot)) {
          report(
            `card-types.${cardType.declaration.id} binds "${property}" to slot "${slot}", which no template of the card type reads`
          );
        }
      }
    }
  }
}

/** Every slot some property fills, in the order the resolved map binds them. */
function slotVocabulary(properties: PropertyDefsMap): ReadonlySet<string> {
  const slots = new Set<string>();
  for (const def of Object.values(properties)) {
    for (const slot of def.slot ?? []) slots.add(slot);
  }
  return slots;
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * A sample table's columns are properties of its card type — the map is
 * what the inserted block writes under `table:`, and a column no property
 * answers would be a sample that renders nothing.
 */
function checkSampleTables(
  cardTypes: Record<string, LoadedCardType>,
  report: (message: string) => void
): void {
  for (const cardType of Object.values(cardTypes)) {
    for (const [language, table] of Object.entries(
      cardType.declaration.sampleTable ?? {}
    )) {
      for (const property of Object.keys(table.columns)) {
        if (!(property in cardType.properties)) {
          report(
            `card-types.${cardType.declaration.id}.sample-table.${language} names the column "${property}", which is not a property of the card type`
          );
        }
      }
    }
  }
}
