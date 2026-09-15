import type { Diagnostics } from "./diagnostics";

/**
 * `glyphs:` — how a stored abbreviation is printed in full.
 *
 * ```yaml
 * glyphs:
 *   front-stat-1a:          # the slot the table serves
 *     1h: einhändig         # what the note wrote → what the card shows
 *     2h: zweihändig
 * ```
 *
 * Keyed by SLOT, not by property: it is the place on the card that decides
 * how a value is spelled out, and a card type putting something else in the
 * same cell brings its own table or none. A value the table does not name
 * passes through unchanged, so a table need only list the abbreviations.
 *
 * Both the system and a card type may declare one; the loader merges them
 * per slot, the card type's table replacing the system's for that slot and
 * leaving every other slot's table alone.
 */
export type GlyphTable = Record<string, string>;
export type GlyphTables = Record<string, GlyphTable>;

/** Read a `glyphs:` block: slot name → lowercased value → replacement. */
export function parseGlyphTables(
  raw: unknown,
  context: string,
  diagnostics: Diagnostics
): GlyphTables {
  if (raw === null || raw === undefined) return {};
  if (!isMapping(raw)) {
    diagnostics.warn(
      `${context} must be a mapping of <slot>: { value: glyph }; ignoring it`
    );
    return {};
  }
  const out: GlyphTables = {};
  for (const [rawSlot, rawTable] of Object.entries(raw)) {
    const slot = rawSlot.trim().toLowerCase();
    if (!slot) continue;
    if (!isMapping(rawTable)) {
      diagnostics.warn(
        `${context}.${slot} must be a mapping of value: glyph; ignoring it`
      );
      continue;
    }
    const table: GlyphTable = {};
    for (const [value, glyph] of Object.entries(rawTable)) {
      if (glyph === null || glyph === undefined) continue;
      table[String(value).trim().toLowerCase()] = String(glyph);
    }
    out[slot] = table;
  }
  return out;
}

/** The layer's table wins per slot; slots it does not mention keep the base's. */
export function mergeGlyphTables(
  base: GlyphTables | undefined,
  layer: GlyphTables | undefined
): GlyphTables {
  return { ...(base ?? {}), ...(layer ?? {}) };
}

/**
 * The glyph for a value at a slot, or the value itself when the slot has no
 * table or the table does not name it. Matched on the trimmed, lowercased
 * text, so `1H` and `1h` print alike.
 */
export function applyGlyph(tables: GlyphTables, slot: string, value: string): string {
  const table = tables[slot];
  if (!table) return value;
  const glyph = table[value.trim().toLowerCase()];
  return glyph === undefined ? value : glyph;
}

function isMapping(raw: unknown): raw is Record<string, unknown> {
  return typeof raw === "object" && raw !== null && !Array.isArray(raw);
}
