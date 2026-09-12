import type { Diagnostics } from "./diagnostics";

/**
 * The fold behind both setting chains — card settings, resolved once per card,
 * and deck settings, resolved once per deck — and the small value parsers the
 * two tables share.
 *
 * Parsing happens at the boundary, where a document is read, so every layer
 * arrives typed; merging then only ever sees valid values. That is what keeps
 * a card type's `card-size: huge` from shadowing the system's valid `poker`:
 * the typo is reported and absent, and the layer below still answers — which
 * is what the predecessor's `parseCardSize` returned `undefined` for.
 */

/** Turn a YAML value into a typed one, or `undefined` when it is not one. */
export type Parse<T> = (raw: unknown) => T | undefined;

/** One setting: the key an author writes, how its value is read, how layers combine. */
export interface Setting<T> {
  key: string;
  parse: Parse<T>;
  /** Absent means the higher layer's value replaces the lower one whole. */
  merge?: (base: T, layer: T) => T;
}

/** A table with one `Setting` per field of the settings interface `S`. */
export type SettingTable<S> = { [K in keyof S]-?: Setting<NonNullable<S[K]>> };

/**
 * Read one layer's settings — a system's, a deck block's, a note's — into the
 * typed shape. Done where the document is read, so a system declaration
 * carries `CardSettings`, not a bag of `unknown`.
 *
 * A key the table does not know, and a value its parser refuses, are each
 * reported and left out. Left out, not defaulted: the layer below answers
 * instead when the layers are merged, which is what an author expects of a
 * typo in a card type — the system's valid `poker` still stands.
 */
export function parseSettings<S extends object>(
  table: SettingTable<S>,
  raw: Record<string, unknown> | undefined,
  what: string,
  diagnostics: Diagnostics
): Partial<S> {
  const byKey = new Map<string, keyof S>();
  for (const field of Object.keys(table) as (keyof S)[])
    byKey.set(table[field].key, field);

  const out: Partial<S> = {};
  for (const [key, value] of Object.entries(raw ?? {})) {
    const field = byKey.get(key);
    if (field === undefined) {
      diagnostics.warn(`${key}: is not a ${what} setting; ignoring it`);
      continue;
    }
    const parsed = table[field].parse(value);
    if (parsed === undefined) {
      diagnostics.warn(
        `${key}: ${JSON.stringify(value)} is not a valid value; ignoring it`
      );
      continue;
    }
    out[field] = parsed as S[keyof S];
  }
  return out;
}

/**
 * Fold parsed layers, lowest first. The highest layer that has a field wins
 * it whole, unless the table says the field merges (`cut-marks`).
 */
export function mergeSettings<S extends object>(
  table: SettingTable<S>,
  layers: readonly (Partial<S> | undefined)[]
): Partial<S> {
  const out: Partial<S> = {};
  for (const layer of layers) {
    for (const field of Object.keys(layer ?? {}) as (keyof S)[]) {
      const value = layer?.[field];
      if (value === undefined) continue;
      const base = out[field];
      const merge = table[field]?.merge;
      out[field] =
        merge && base !== undefined
          ? merge(base as NonNullable<S[keyof S]>, value as NonNullable<S[keyof S]>)
          : value;
    }
  }
  return out;
}

/** The keys a table knows, in table order — what a deck parser splits a block by. */
export function settingKeys<S>(table: SettingTable<S>): readonly string[] {
  return (Object.values(table) as Setting<unknown>[]).map((setting) => setting.key);
}

// ── Value parsers ───────────────────────────────────────────────────

export function oneOf<T extends string>(values: readonly T[]): Parse<T> {
  return (raw) => {
    if (typeof raw !== "string") return undefined;
    const value = raw.trim().toLowerCase();
    return (values as readonly string[]).includes(value) ? (value as T) : undefined;
  };
}

export const booleanValue: Parse<boolean> = (raw) =>
  typeof raw === "boolean" ? raw : undefined;

export const positiveNumber: Parse<number> = (raw) =>
  typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? raw : undefined;

export const nonNegativeNumber: Parse<number> = (raw) =>
  typeof raw === "number" && Number.isFinite(raw) && raw >= 0 ? raw : undefined;

export const positiveInteger: Parse<number> = (raw) =>
  typeof raw === "number" && Number.isInteger(raw) && raw > 0 ? raw : undefined;

export const nonEmptyString: Parse<string> = (raw) => {
  if (typeof raw !== "string") return undefined;
  const value = raw.trim();
  return value === "" ? undefined : value;
};

export function isMapping(raw: unknown): raw is Record<string, unknown> {
  return typeof raw === "object" && raw !== null && !Array.isArray(raw);
}
