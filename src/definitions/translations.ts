import type { Diagnostics } from "./diagnostics";

/** A flat table of translation key → text, for one language. */
export type Translations = Record<string, string>;

/** Every language a layer declares, keyed by language code. */
export type TranslationTables = Record<string, Translations>;

/**
 * Read an `i18n:` block — `{ <lang>: { key: text } }`, inline in the system or
 * card-type entry of the system document — into one table per language.
 *
 * Inline, not a file per language: the tables are small, every system has
 * some, and a card type's captions then sit beside the bindings they caption.
 */
export function parseTranslationTables(
  raw: unknown,
  context: string,
  diagnostics: Diagnostics
): TranslationTables {
  if (raw === null || raw === undefined) return {};
  if (typeof raw !== "object" || Array.isArray(raw)) {
    diagnostics.warn(
      `${context} must be a mapping of <lang>: { key: text }; ignoring it`
    );
    return {};
  }
  const out: TranslationTables = {};
  for (const [language, table] of Object.entries(raw as Record<string, unknown>)) {
    const code = language.trim().toLowerCase();
    if (code) out[code] = parseTranslations(table, `${context}.${code}`, diagnostics);
  }
  return out;
}

/**
 * Read one language's table into flat key → text. Non-string values are
 * stringified, so a numeric label declared without quotes still works;
 * nullish ones are dropped.
 */
export function parseTranslations(
  raw: unknown,
  context: string,
  diagnostics: Diagnostics
): Translations {
  if (raw === null || raw === undefined) return {};
  if (typeof raw !== "object" || Array.isArray(raw)) {
    diagnostics.warn(`${context} must be a mapping of key: text; ignoring it`);
    return {};
  }
  const out: Translations = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value === null || value === undefined) continue;
    out[String(key)] = String(value);
  }
  return out;
}

/** Fold one layer's tables onto another's: the layer wins, per key, per language. */
export function mergeTranslations(
  base: TranslationTables | undefined,
  layer: TranslationTables | undefined
): TranslationTables {
  const out: TranslationTables = {};
  for (const [language, table] of Object.entries(base ?? {}))
    out[language] = { ...table };
  for (const [language, table] of Object.entries(layer ?? {})) {
    out[language] = { ...(out[language] ?? {}), ...table };
  }
  return out;
}

/**
 * Collapse the chain — baseline, then system, then card type — into the one
 * flat table a render reads through, so a lookup is a single hit.
 *
 * `fallbackLanguage` is the system's own primary language, and it fills the
 * keys the active language does not answer. A system that translates half its
 * labels shows the other half in the language it was written in, rather than
 * showing nothing.
 *
 * A key no layer answers is absent from the result. What that renders as is the
 * caller's decision, and the two callers differ on purpose: a `{{t}}` lookup
 * shows the key, as a visible marker an author can spot, while a slot's caption
 * shows nothing, because most cells are unlabelled.
 */
export function resolveTranslations(
  layers: readonly (TranslationTables | undefined)[],
  language: string,
  fallbackLanguage?: string
): Translations {
  const out: Translations = {};
  const fill = (lang: string): void => {
    for (const layer of layers) Object.assign(out, layer?.[lang] ?? {});
  };
  if (fallbackLanguage && fallbackLanguage !== language) fill(fallbackLanguage);
  fill(language);
  return out;
}
