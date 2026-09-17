import type { Diagnostics } from "./diagnostics";
import { parseCardSettings, type CardSettings } from "./card-settings";
import { parseClassifiers, type Classifiers } from "./classifiers";
import { parseGlyphTables, type GlyphTables } from "./glyphs";
import { parsePropertyDefs, type PropertyDefsMap } from "./property-defs";
import { parseTranslationTables, type TranslationTables } from "./translations";

/**
 * A system document, taken apart.
 *
 * This is the ROOT of the layer cake: the one YAML file at the top of a
 * system's folder that says what the system is made of, and the only place
 * its own definition layers come from. Everything else in `src/definitions/`
 * folds what this hands over. The file's name is the registration's
 * business, not this module's.
 *
 * It stops exactly where loading begins. A declared file arrives here as the
 * string an author wrote — checked for shape, branded `SystemPath`, never
 * resolved, never read. That is what keeps this module free of the vault and
 * testable from a string literal, and it is the line to defend when adding a
 * key.
 *
 * What is declared is what nothing points at: the faces, the stylesheets, the
 * partials. What is small and every system writes — `properties:`, `translations:` —
 * is inline. Images and fonts are NOT declared — every
 * reference to one carries its full relative path (`url(assets/x.webp)`,
 * `{{asset "…"}}`, a property's `default:`), so the reference is the
 * declaration, and the loader derives the asset list by reading them.
 *
 * "A system is a family of cards that share a look and a vocabulary" — not
 * necessarily a role-playing system.
 */
/**
 * A path an author declared, relative to the system folder, that has been
 * checked to stay inside it — no `..` segment, nothing absolute, `/` as the
 * separator on every platform. Only `parseSystemPath` makes one, so a reader that
 * takes a `SystemPath` cannot be handed a string nobody checked. That is the
 * invariant "a system is one folder you can copy" rests on, and the
 * copy-into-vault action depends on it being true rather than merely usual.
 */
export type SystemPath = string & { readonly [SYSTEM_PATH]: true };
declare const SYSTEM_PATH: unique symbol;

export interface SystemDeclaration {
  /** Stable identifier a card note names in `system:`. Lowercased. */
  id: string;
  /** Shown to the reader. Falls back to the id. */
  name: string;
  /**
   * The languages this system is written in, **the primary one first**.
   *
   * The order carries meaning: the first entry is what a translation falls back
   * to, so a system documented in German shows German to an English reader
   * rather than showing nothing.
   */
  languages: string[];

  /**
   * The stylesheet. One, not a list: a system has one and a card type at most
   * one of its own, and a list would ask "in what order?" for a question no
   * system poses.
   */
  stylesheet?: SystemPath;
  /** The system layer of the translation chain, one table per language. Inline. */
  translations: TranslationTables;
  /** How a value at a slot is spelled out — see `glyphs.ts`. The system's layer, per slot. */
  glyphs: GlyphTables;
  /** A class token chosen by what a slot shows — see `classifiers.ts`. The system's layer, per slot. */
  classifiers: Classifiers;
  /** Partial name → the template implementing it. */
  partialTemplates: Record<string, SystemPath>;
  /**
   * Which partial the ENGINE renders a markdown image through — every
   * `![[image]]` embedded in a note's body — so it gets the design's chrome
   * rather than a bare `<img>`. Called with `url`, `alt` and `placement="body"`.
   *
   * That is the hook's only job. A face template that wants the same chrome on
   * its own image slots calls the partial by name, like any other partial; it
   * does not go through here.
   *
   * A name into `partial-templates:`, not a file of its own: the file is declared once,
   * where every other partial is, and nothing is registered under a reserved
   * name behind the author's back.
   */
  markdownImagePartial?: string;

  /**
   * The system layer of the definition cascade. Absent when it declares none.
   *
   * A constant the design needs — a logo path, a wordmark line, a layout
   * weight — is a property with a `default:`. It folds through the same
   * cascade as every other value, is read under one name, and may be bound to
   * a slot.
   *
   * A slot is declared by the template that reads it, and how it renders is
   * said there; what YAML says is which property fills it — `slot:` on the
   * property. See `bindings.ts`.
   */
  properties?: PropertyDefsMap;
  /**
   * Whatever else the document says at top level — `card-size: poker`,
   * `overflow-mode: back-then-cards` — read as the system's layer of the
   * card-setting chain.
   *
   * There is one fixed vocabulary of card settings, `card-settings.ts`; a
   * system invents none. It sets defaults for its cards, and a card type, a
   * deck and a note may each override them. A key that is not a card setting
   * — `page-margin:`, say, which is the deck's, since a deck holds cards of
   * several card types — is reported and left out.
   */
  cardSettings: CardSettings;

  /** The card types, keyed by id, in declaration order. */
  cardTypes: Record<string, CardTypeDeclaration>;
}

/**
 * One card type — a face design and the vocabulary that fills it.
 *
 * A card type names its own templates out loud, even when five of them name the
 * same file. The sharing is visible; a reader does not have to know a cascade
 * rule to see it.
 */
export interface CardTypeDeclaration {
  /** Singular English, lowercase — `npc`, `gear`, `creature`. */
  id: string;

  /** The front face. A card type without one cannot render. */
  frontTemplate?: SystemPath;
  /** The back face. */
  backTemplate?: SystemPath;
  /** The card type's own stylesheet, loaded after the system's. */
  stylesheet?: SystemPath;
  translations: TranslationTables;
  /** The card type's layer, per slot, over the system's. */
  glyphs: GlyphTables;
  classifiers: Classifiers;

  properties?: PropertyDefsMap;
  /** The card type's layer of the card-setting chain — see `SystemDeclaration`. */
  cardSettings: CardSettings;
}

/**
 * The keys that are structure. Everything else in the document is a card
 * setting and is read by `parseCardSettings` — one vocabulary, in one place.
 */
const SYSTEM_KEYS: readonly string[] = [
  "id",
  "name",
  "languages",
  "stylesheet",
  "translations",
  "glyphs",
  "classifiers",
  "partial-templates",
  "markdown-image-partial",
  "properties",
  "card-types",
];

const CARD_TYPE_KEYS: readonly string[] = [
  "front-template",
  "back-template",
  "stylesheet",
  "translations",
  "glyphs",
  "classifiers",
  "properties",
];

/**
 * Take a system document — already parsed out of its YAML — apart.
 *
 * Returns `undefined` only when there is nothing to work with: no mapping, or
 * no `id:`. Everything else is reported and survived, because a system with one
 * broken card type should still show its other four.
 */
export function parseSystemDeclaration(
  raw: unknown,
  diagnostics: Diagnostics
): SystemDeclaration | undefined {
  if (!isMapping(raw)) {
    diagnostics.warn("the system document must be a mapping; ignoring the system");
    return undefined;
  }

  const id = String(raw["id"] ?? "")
    .trim()
    .toLowerCase();
  if (!id) {
    diagnostics.warn("the system document declares no id:; ignoring the system");
    return undefined;
  }

  const name = String(raw["name"] ?? "").trim() || id;

  const languages = parseStringList(raw["languages"], `${id}.languages`, diagnostics);
  if (languages.length === 0) {
    diagnostics.warn(
      `${id} declares no languages:; its translations have nothing to fall back to`
    );
  }

  const out: SystemDeclaration = {
    id,
    name,
    languages,
    translations: parseTranslationTables(
      raw["translations"],
      `${id}.translations`,
      diagnostics
    ),
    glyphs: parseGlyphTables(raw["glyphs"], `${id}.glyphs`, diagnostics),
    classifiers: parseClassifiers(raw["classifiers"], `${id}.classifiers`, diagnostics),
    partialTemplates: parsePathMap(
      raw["partial-templates"],
      `${id}.partial-templates`,
      diagnostics
    ),
    cardSettings: parseCardSettings(everythingBut(raw, SYSTEM_KEYS), diagnostics),
    cardTypes: {},
  };

  const stylesheet = parseSystemPath(raw["stylesheet"], `${id}.stylesheet`, diagnostics);
  if (stylesheet) out.stylesheet = stylesheet;

  const hook = String(raw["markdown-image-partial"] ?? "")
    .trim()
    .toLowerCase();
  if (hook) {
    if (hook in out.partialTemplates) out.markdownImagePartial = hook;
    else {
      diagnostics.warn(
        `${id}.markdown-image-partial names "${hook}", which partial-templates: does not declare; ignoring it`
      );
    }
  }

  const properties = parsePropertyDefs(raw["properties"], diagnostics);
  if (properties) out.properties = properties;

  out.cardTypes = parseCardTypes(raw["card-types"], id, diagnostics);
  if (Object.keys(out.cardTypes).length === 0) {
    diagnostics.warn(`${id} declares no card types; it can produce no cards`);
  }

  return out;
}

function parseCardTypes(
  raw: unknown,
  systemId: string,
  diagnostics: Diagnostics
): Record<string, CardTypeDeclaration> {
  if (raw === null || raw === undefined) return {};
  if (!isMapping(raw)) {
    diagnostics.warn(`${systemId}.card-types must be a mapping; ignoring it`);
    return {};
  }

  const out: Record<string, CardTypeDeclaration> = {};
  for (const [rawId, rawEntry] of Object.entries(raw)) {
    // Singular English, lowercase, whatever language the cards are in.
    const id = String(rawId).trim().toLowerCase();
    if (!id) continue;
    const declaration = parseCardType(
      rawEntry,
      id,
      `${systemId}.card-types.${id}`,
      diagnostics
    );
    if (declaration) out[id] = declaration;
  }
  return out;
}

function parseCardType(
  raw: unknown,
  id: string,
  context: string,
  diagnostics: Diagnostics
): CardTypeDeclaration | undefined {
  if (raw === null || raw === undefined) {
    diagnostics.warn(
      `${context} declares nothing, not even a front-template:; ignoring it`
    );
    return undefined;
  }
  if (!isMapping(raw)) {
    diagnostics.warn(`${context} must be a mapping; ignoring it`);
    return undefined;
  }

  const out: CardTypeDeclaration = {
    id,
    translations: parseTranslationTables(
      raw["translations"],
      `${context}.translations`,
      diagnostics
    ),
    glyphs: parseGlyphTables(raw["glyphs"], `${context}.glyphs`, diagnostics),
    classifiers: parseClassifiers(
      raw["classifiers"],
      `${context}.classifiers`,
      diagnostics
    ),
    cardSettings: parseCardSettings(everythingBut(raw, CARD_TYPE_KEYS), diagnostics),
  };

  const front = parseSystemPath(
    raw["front-template"],
    `${context}.front-template`,
    diagnostics
  );
  if (front) out.frontTemplate = front;
  else
    diagnostics.warn(`${context} declares no front-template:; it cannot render a card`);

  const back = parseSystemPath(
    raw["back-template"],
    `${context}.back-template`,
    diagnostics
  );
  if (back) out.backTemplate = back;
  const stylesheet = parseSystemPath(
    raw["stylesheet"],
    `${context}.stylesheet`,
    diagnostics
  );
  if (stylesheet) out.stylesheet = stylesheet;

  const properties = parsePropertyDefs(raw["properties"], diagnostics);
  if (properties) out.properties = properties;

  return out;
}

/** Everything that is not structure. */
function everythingBut(
  entry: Record<string, unknown>,
  structural: readonly string[]
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(entry)) {
    if (!structural.includes(key)) out[key] = value;
  }
  return out;
}

// ── Declared paths ──────────────────────────────────────────────────

/**
 * Check a declared path's shape — never resolve it — and brand it. See
 * `SystemPath` for what is refused and why; a Windows-style separator is
 * refused too, since a vault syncs across both.
 */
export function parseSystemPath(
  raw: unknown,
  context: string,
  diagnostics: Diagnostics
): SystemPath | undefined {
  if (raw === null || raw === undefined) return undefined;
  const path = String(raw).trim();
  if (!path) return undefined;
  if (path.startsWith("/")) {
    diagnostics.warn(
      `${context}: "${path}" is absolute; declare it relative to the system folder`
    );
    return undefined;
  }
  if (path.includes("\\")) {
    diagnostics.warn(
      `${context}: "${path}" uses a backslash; separate path segments with "/"`
    );
    return undefined;
  }
  if (path.split("/").includes("..")) {
    diagnostics.warn(
      `${context}: "${path}" leaves the system folder, which a system may not do`
    );
    return undefined;
  }
  return path as SystemPath;
}

function parsePathMap(
  raw: unknown,
  context: string,
  diagnostics: Diagnostics
): Record<string, SystemPath> {
  const out: Record<string, SystemPath> = {};
  for (const [key, value] of Object.entries(asMapping(raw, context, diagnostics))) {
    const path = parseSystemPath(value, `${context}.${key}`, diagnostics);
    if (path) out[key.trim().toLowerCase()] = path;
  }
  return out;
}

function parseStringList(
  raw: unknown,
  context: string,
  diagnostics: Diagnostics
): string[] {
  const out: string[] = [];
  for (const item of asList(raw, context, diagnostics)) {
    if (item === null || item === undefined) continue;
    const value = String(item).trim();
    if (value && !out.includes(value)) out.push(value);
  }
  return out;
}

/** A single entry is a list of one — `stylesheet: styles/simple.css` is what one expects to work. */
function asList(raw: unknown, context: string, diagnostics: Diagnostics): unknown[] {
  if (raw === null || raw === undefined) return [];
  if (Array.isArray(raw)) return raw;
  if (isMapping(raw)) {
    diagnostics.warn(`${context} must be a list; ignoring it`);
    return [];
  }
  return [raw];
}

function asMapping(
  raw: unknown,
  context: string,
  diagnostics: Diagnostics
): Record<string, unknown> {
  if (raw === null || raw === undefined) return {};
  if (!isMapping(raw)) {
    diagnostics.warn(`${context} must be a mapping; ignoring it`);
    return {};
  }
  return raw;
}

function isMapping(raw: unknown): raw is Record<string, unknown> {
  return typeof raw === "object" && raw !== null && !Array.isArray(raw);
}
