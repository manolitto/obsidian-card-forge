import type { Diagnostics } from "./diagnostics";

/**
 * A value an author may write once or once per language.
 *
 * ```yaml
 * description: "Grip — one- or two-handed."
 * description: { de: "Griff – 1H/2H.", en: "Grip — 1H/2H." }
 * ```
 */
export type LocalizedText = string | Record<string, string>;

/** `de`, `en`, `de-DE`, `pt-BR` — what a language key in a localized map looks like. */
const LANGUAGE_CODE = /^[a-z]{2,4}(-[A-Za-z]{2,4})?$/;

function isLanguageCode(key: string): boolean {
  return LANGUAGE_CODE.test(key);
}

/**
 * Read a `LocalizedText` for one language. Falls back to the first declared
 * language rather than to nothing: a system that documents its properties in
 * German only should still show them to an English reader.
 */
export function pickLocalized(
  value: LocalizedText | undefined,
  language: string
): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "string") return value;
  const exact = value[language];
  if (exact !== undefined) return exact;
  const firstKey = Object.keys(value)[0];
  return firstKey === undefined ? undefined : value[firstKey];
}

/**
 * Read a localized value of any shape — a `sample:`, which may be a number, a
 * list, or a map of objects.
 *
 * Whether a map is localized or is itself the value is decided by a heuristic:
 * every top-level key looks like a language code. A sample whose real shape
 * happens to match must wrap itself under explicit language keys to say so.
 */
export function pickLocalizedValue(value: unknown, language: string): unknown {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return value;
  const map = value as Record<string, unknown>;
  const keys = Object.keys(map);
  if (keys.length === 0 || !keys.every(isLanguageCode)) return value;
  if (language in map) return map[language];
  const firstKey = keys[0];
  return firstKey === undefined ? undefined : map[firstKey];
}

/**
 * Coerce a YAML `description:` / `label:` into a `LocalizedText`. Language keys
 * are folded to lowercase; the value is not, since it is prose.
 */
export function parseLocalizedText(
  raw: unknown,
  context: string,
  diagnostics: Diagnostics
): LocalizedText | undefined {
  if (raw === null || raw === undefined) return undefined;
  if (typeof raw === "string") return raw;
  if (typeof raw === "object" && !Array.isArray(raw)) {
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      if (value === null || value === undefined) continue;
      out[key.toLowerCase()] = String(value);
    }
    return out;
  }
  diagnostics.warn(
    `${context} must be a string or a { <lang>: string } map; ignoring it`
  );
  return undefined;
}
