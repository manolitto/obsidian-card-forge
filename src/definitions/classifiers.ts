import type { Diagnostics } from "./diagnostics";

/**
 * `classifiers:` — a CSS class token chosen by what a slot shows.
 *
 * ```yaml
 * classifiers:
 *   front-header-die:                     # the slot the classifier serves
 *     match:
 *       - { pattern: "^.{1,2}$", token: narrow }
 *       - { pattern: "^\\d[–—-]\\d$", token: narrow }
 *     default: wide
 * ```
 *
 * `{{slot-class "front-header-die"}}` runs the slot's display text through
 * the rules in order and yields the first token whose pattern matches, else
 * the default, else nothing. A stylesheet then keys on
 * `.roll-table-badge-num-narrow` — which is how a design picks a type size by
 * how wide a value will run, without the template counting characters.
 *
 * Keyed by slot like `glyphs:`, and merged the same way: a card type's
 * classifier for a slot replaces the system's for that slot.
 */
export interface Classifier {
  match: ClassifierRule[];
  default?: string;
}

export interface ClassifierRule {
  pattern: RegExp;
  token: string;
}

export type Classifiers = Record<string, Classifier>;

/** Read a `classifiers:` block: slot name → its rules, patterns compiled. */
export function parseClassifiers(
  raw: unknown,
  context: string,
  diagnostics: Diagnostics
): Classifiers {
  if (raw === null || raw === undefined) return {};
  if (!isMapping(raw)) {
    diagnostics.warn(
      `${context} must be a mapping of <slot>: { match, default }; ignoring it`
    );
    return {};
  }
  const out: Classifiers = {};
  for (const [rawSlot, rawDef] of Object.entries(raw)) {
    const slot = rawSlot.trim().toLowerCase();
    if (!slot) continue;
    const classifier = parseClassifier(rawDef, `${context}.${slot}`, diagnostics);
    if (classifier) out[slot] = classifier;
  }
  return out;
}

function parseClassifier(
  raw: unknown,
  context: string,
  diagnostics: Diagnostics
): Classifier | undefined {
  if (!isMapping(raw)) {
    diagnostics.warn(`${context} must be a mapping with a match: list; ignoring it`);
    return undefined;
  }
  const match: ClassifierRule[] = [];
  const rules = raw["match"];
  if (rules !== undefined && rules !== null) {
    if (!Array.isArray(rules)) {
      diagnostics.warn(
        `${context}.match must be a list of { pattern, token }; ignoring it`
      );
    } else {
      rules.forEach((rule, i) => {
        const parsed = parseRule(rule, `${context}.match[${i}]`, diagnostics);
        if (parsed) match.push(parsed);
      });
    }
  }
  const out: Classifier = { match };
  const fallback = raw["default"];
  if (fallback !== undefined && fallback !== null) {
    const token = String(fallback).trim();
    if (token) out.default = token;
  }
  if (match.length === 0 && out.default === undefined) {
    diagnostics.warn(`${context} has no match: rules and no default:; ignoring it`);
    return undefined;
  }
  return out;
}

function parseRule(
  raw: unknown,
  context: string,
  diagnostics: Diagnostics
): ClassifierRule | undefined {
  if (!isMapping(raw)) {
    diagnostics.warn(`${context} must be { pattern, token }; ignoring it`);
    return undefined;
  }
  const pattern = raw["pattern"];
  const token = String(raw["token"] ?? "").trim();
  if (typeof pattern !== "string" || !token) {
    diagnostics.warn(`${context} needs both a pattern: and a token:; ignoring it`);
    return undefined;
  }
  try {
    return { pattern: new RegExp(pattern, "u"), token };
  } catch (error) {
    diagnostics.warn(
      `${context}: pattern "${pattern}" is not a regular expression (${describe(error)}); ignoring it`
    );
    return undefined;
  }
}

/** The layer's classifier wins per slot; slots it does not mention keep the base's. */
export function mergeClassifiers(
  base: Classifiers | undefined,
  layer: Classifiers | undefined
): Classifiers {
  return { ...(base ?? {}), ...(layer ?? {}) };
}

/**
 * The token for a slot's display text: the first rule that matches the
 * trimmed, lowercased text, else the default, else `""`. A slot with no
 * classifier yields `""` too — the helper reports that, not this.
 */
export function classify(classifiers: Classifiers, slot: string, text: string): string {
  const classifier = classifiers[slot];
  if (!classifier) return "";
  const value = text.trim().toLowerCase();
  if (value) {
    for (const rule of classifier.match) {
      if (rule.pattern.test(value)) return rule.token;
    }
  }
  return classifier.default ?? "";
}

function isMapping(raw: unknown): raw is Record<string, unknown> {
  return typeof raw === "object" && raw !== null && !Array.isArray(raw);
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
