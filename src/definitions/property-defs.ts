import type { Diagnostics } from "./diagnostics";
import {
  parseLocalizedText,
  pickLocalized,
  pickLocalizedValue,
  type LocalizedText,
} from "./language";

/**
 * What one canonical card property is: the names a note may write it under,
 * what it means, what a valid value looks like, and where it sits on the card.
 */
export interface PropertyDef {
  /**
   * The other names a note may write this property under (YAML `aliases:`).
   * A layer appends to what it inherited; nothing removes an inherited name.
   *
   * Aliases are additive, not destructive. Declaring `image: { aliases: [img] }`
   * does not reserve `img` — a note may write either name, or both, and each
   * keeps its own value.
   */
  aliases?: string[];
  /** What the property means, for the property reference and the insert commands. */
  description?: LocalizedText;
  /** An example value. Any shape, or a `{ <lang>: … }` map of them. */
  sample?: unknown;
  /**
   * The value when the note answers neither this key nor any of its aliases.
   *
   * Deliberately NOT localizable, and the reason is structural rather than a
   * simplification: defaults are applied while preparing the props, and the
   * card's language is resolved afterwards — from those props, since `language`
   * is itself a property a note may set. A localized default would need the
   * language before the language exists. Where a per-language fallback is
   * genuinely wanted, keep it in the template against a translation key.
   */
  default?: unknown;
  /**
   * The layout slots this property fills. A slot is a place a template reads —
   * `{{slot "front-stat-1a"}}` — and this is how a card type says which of its
   * values goes there.
   *
   * Normalized to a list. An EMPTY list means explicitly unbound, which is what
   * `slot: ~` in a higher layer does to an inherited binding; that is why the
   * field is read through `"slot" in def` rather than through a nullish check.
   */
  slot?: string[];
}

export type PropertyDefsMap = Record<string, PropertyDef>;

/** Everything a `properties:` entry may carry. Anything else is a typo. */
const PROPERTY_FIELD_KEYS: readonly string[] = [
  "aliases",
  "description",
  "sample",
  "default",
  "slot",
];

// ── Parsing ─────────────────────────────────────────────────────────

/**
 * Read a `properties:` block — already parsed out of its YAML document — into
 * a map of authored defs.
 *
 * Canonical keys and alias entries are folded to lowercase, because note
 * frontmatter keys are too and the two have to meet.
 *
 * Returns `undefined` when the block is absent or unusable, and `{}` when it is
 * present but empty, so a caller can tell "said nothing" from "said nothing on
 * purpose".
 */
export function parsePropertyDefs(
  raw: unknown,
  diagnostics: Diagnostics
): PropertyDefsMap | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "object" || Array.isArray(raw)) {
    diagnostics.warn("properties: must be a mapping; ignoring it");
    return undefined;
  }

  const out: PropertyDefsMap = {};
  for (const [rawKey, rawValue] of Object.entries(raw as Record<string, unknown>)) {
    const canonical = String(rawKey).trim().toLowerCase();
    if (!canonical) continue;
    const entry = parsePropertyEntry(rawValue, canonical, diagnostics);
    if (entry !== null) out[canonical] = entry;
  }
  return out;
}

function parsePropertyEntry(
  raw: unknown,
  canonical: string,
  diagnostics: Diagnostics
): PropertyDef | null {
  // `hit-points:` and `hit-points: ~` declare the key and nothing else, which
  // is a legitimate and common thing for a layer to say.
  if (raw === null || raw === undefined) return {};
  if (typeof raw !== "object" || Array.isArray(raw)) {
    diagnostics.warn(`properties.${canonical} must be a mapping; ignoring it`);
    return null;
  }

  const context = `properties.${canonical}`;
  const entry = raw as Record<string, unknown>;
  const out: PropertyDef = {};

  for (const key of Object.keys(entry)) {
    if (!PROPERTY_FIELD_KEYS.includes(key)) {
      diagnostics.warn(
        `${context}.${key} is not a property field (${PROPERTY_FIELD_KEYS.join(", ")} are); ignoring it`
      );
    }
  }

  if ("aliases" in entry) {
    const list = parseNameList(entry["aliases"], `${context}.aliases`, diagnostics);
    if (list) out.aliases = dedupeDroppingSelf(list, canonical);
  }
  if ("description" in entry) {
    const description = parseLocalizedText(
      entry["description"],
      `${context}.description`,
      diagnostics
    );
    if (description !== undefined) out.description = description;
  }
  // Read through `in`, not through a nullish check: `sample: ~` is an author
  // saying "this one has no useful example", which a higher layer may mean.
  if ("sample" in entry) out.sample = entry["sample"];
  if ("default" in entry) out.default = entry["default"];
  if ("slot" in entry) {
    const list = parseNameList(entry["slot"], `${context}.slot`, diagnostics);
    if (list) {
      if (list.includes(canonical)) {
        diagnostics.warn(
          `${context}.slot names its own property; dropping the self-reference`
        );
      }
      out.slot = dedupeDroppingSelf(list, canonical);
    }
  }
  return out;
}

/**
 * Read a list of names — an alias list or a slot binding. A bare string is one
 * name, `~` is an empty list (which is how a binding is removed), and anything
 * else is a mistake.
 */
function parseNameList(
  raw: unknown,
  context: string,
  diagnostics: Diagnostics
): string[] | null {
  if (raw === null || raw === undefined) return [];
  if (typeof raw === "string") {
    const name = raw.trim().toLowerCase();
    return name ? [name] : [];
  }
  if (!Array.isArray(raw)) {
    diagnostics.warn(`${context} must be a name or a list of names; ignoring it`);
    return null;
  }
  const out: string[] = [];
  for (const item of raw) {
    if (item === null || item === undefined) continue;
    const name = String(item).trim().toLowerCase();
    if (name) out.push(name);
  }
  return out;
}

function dedupeDroppingSelf(list: readonly string[], canonical: string): string[] {
  const seen = new Set<string>([canonical]);
  const out: string[] = [];
  for (const name of list) {
    if (seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}

// ── Merging ─────────────────────────────────────────────────────────

/**
 * Fold one authored layer onto a resolved base. The result is itself resolved,
 * so it can serve as the base for the next layer.
 *
 * Per canonical key:
 *
 * - `aliases` appends to the list it inherited, deduped. There is no way to
 *   remove an inherited alias, and none is wanted: an alias reserves nothing,
 *   so an inherited one costs a lower layer nothing either.
 * - `slot` REPLACES outright — the sharpest edge in the design. A layer that
 *   re-binds a property must restate every target it still wants, and `slot: ~`
 *   unbinds it. Silently emptying an inherited binding is exactly how a card
 *   back once lost its title, so this is guarded by a test rather than by a
 *   comment.
 * - everything else: the highest layer that SETS the field wins, and a layer
 *   that says nothing leaves the inherited value alone.
 */
export function mergePropertyDefs(
  base: PropertyDefsMap,
  layer: PropertyDefsMap | undefined
): PropertyDefsMap {
  const out: PropertyDefsMap = {};
  for (const [canonical, def] of Object.entries(base))
    out[canonical] = cloneResolvedDef(def);
  if (!layer) return out;

  for (const [canonical, layerDef] of Object.entries(layer)) {
    const merged = cloneResolvedDef(out[canonical] ?? {});

    if (layerDef.aliases && layerDef.aliases.length > 0) {
      const aliases = merged.aliases ?? [];
      const seen = new Set<string>([canonical, ...aliases]);
      for (const alias of layerDef.aliases) {
        if (seen.has(alias)) continue;
        seen.add(alias);
        aliases.push(alias);
      }
      merged.aliases = aliases;
    }

    if ("slot" in layerDef) merged.slot = layerDef.slot ? [...layerDef.slot] : [];
    if ("default" in layerDef) merged.default = layerDef.default;
    if ("description" in layerDef) merged.description = layerDef.description;
    if ("sample" in layerDef) merged.sample = layerDef.sample;

    out[canonical] = merged;
  }
  return out;
}

function cloneResolvedDef(def: PropertyDef): PropertyDef {
  const out: PropertyDef = {};
  if (def.aliases) out.aliases = [...def.aliases];
  if (def.slot) out.slot = [...def.slot];
  if ("default" in def) out.default = def.default;
  if ("description" in def) out.description = def.description;
  if ("sample" in def) out.sample = def.sample;
  return out;
}

/**
 * Fold the definition chain — baseline, then system, then card type.
 *
 * The baseline is the fold's seed rather than a layer of its own: the merge has
 * to exist for system → card type regardless, so seeding it costs nothing and
 * saves every system from restating the eight canonical properties.
 */
export function resolvePropertyDefs(
  layers: readonly (PropertyDefsMap | undefined)[]
): PropertyDefsMap {
  return layers.reduce<PropertyDefsMap>(mergePropertyDefs, {});
}

// ── Reading a def ───────────────────────────────────────────────────

/** The description in the card's language, or in the first one declared. */
export function propertyDescription(
  def: PropertyDef | undefined,
  language: string
): string | undefined {
  return pickLocalized(def?.description, language);
}

/**
 * The sample in the card's language. `undefined` when the def declares none;
 * an explicit `sample: ~` yields `null`, which is a declaration that the
 * property has no useful example rather than an absence.
 */
export function propertySample(def: PropertyDef | undefined, language: string): unknown {
  if (!def || !("sample" in def)) return undefined;
  return pickLocalizedValue(def.sample, language);
}
