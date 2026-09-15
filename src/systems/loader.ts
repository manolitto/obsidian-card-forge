import { load } from "js-yaml";
import { buildAliasMap, type AliasMap } from "../definitions/bindings";
import { mergeCardSettings, type CardSettings } from "../definitions/card-settings";
import { mergeClassifiers, type Classifiers } from "../definitions/classifiers";
import type { Diagnostics } from "../definitions/diagnostics";
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

/** The document every system starts from, at the root of its folder. */
export const SYSTEM_DOCUMENT = "game-system.yaml" as SystemPath;

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
 * Reads `game-system.yaml`, hands the document to the definition layer, and
 * then checks the folder against the declaration in both directions:
 *
 *   1. every declared file exists, and every referenced asset exists — a
 *      miss is reported naming what declared or referenced it;
 *   2. every file in the folder is declared, referenced, or one of the few
 *      names that ride along (a licence, a readme) — a stranger is reported
 *      with its size, so a stray megabyte is noticed the day it appears;
 *   3. partials both ways: a declared partial nothing calls, and a call no
 *      declaration covers.
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
    text = await source.readText(SYSTEM_DOCUMENT);
  } catch {
    diagnostics.warn(`${source.root}: no ${SYSTEM_DOCUMENT}; not a system`);
    return undefined;
  }

  let doc: unknown;
  try {
    doc = load(text);
  } catch (error) {
    diagnostics.warn(`${source.root}/${SYSTEM_DOCUMENT}: ${describe(error)}`);
    return undefined;
  }

  const declaration = parseSystemDeclaration(doc, diagnostics);
  if (!declaration) return undefined;

  if (declaration.id !== expectedId) {
    diagnostics.warn(
      `${source.root}: ${SYSTEM_DOCUMENT} declares id "${declaration.id}" but is registered as "${expectedId}"; not loading it`
    );
    return undefined;
  }

  const files = new Set<string>(await source.listFiles());
  const used = new Set<string>([SYSTEM_DOCUMENT]);
  const report = (message: string): void =>
    diagnostics.warn(`${declaration.id}: ${message}`);

  // A declared root must exist; whether it does, it counts as used, so a
  // missing one is reported once and not again as a stranger.
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
  for (const name of Object.keys(declaration.partialTemplates)) {
    if (!partialsCalled.has(name)) {
      report(`partial-templates: declares "${name}", which no template calls`);
    }
  }
  for (const [name, caller] of partialsCalled) {
    if (!(name in declaration.partialTemplates)) {
      report(
        `${caller} calls partial "${name}", which partial-templates: does not declare`
      );
    }
  }

  // ── The document's own references — a property's default, say ───
  referenced(documentAssetReferences(doc), SYSTEM_DOCUMENT);

  // ── Strangers ────────────────────────────────────────────────────
  for (const file of files) {
    if (used.has(file) || ridesAlong(file)) continue;
    let size = "";
    try {
      size = `, ${formatSize((await source.readBinary(file as SystemPath)).byteLength)}`;
    } catch {
      /* the size is a courtesy */
    }
    report(`"${file}"${size} is neither declared nor referenced by anything`);
  }

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
  };
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

/**
 * Files that travel with a system without being part of it: a font's
 * licence, a readme. Checked by name, never declared.
 */
function ridesAlong(path: string): boolean {
  const name = path.slice(path.lastIndexOf("/") + 1).toLowerCase();
  return (
    name.startsWith("license") ||
    name.startsWith("licence") ||
    name.startsWith("notice") ||
    name.startsWith("readme") ||
    name.endsWith(".txt")
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
