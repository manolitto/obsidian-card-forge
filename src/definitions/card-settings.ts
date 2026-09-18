import { parseCardSize, type CardSize } from "../model/card-size";
import type { Diagnostics } from "./diagnostics";
import {
  booleanValue,
  isMapping,
  nonEmptyString,
  oneOf,
  positiveInteger,
  positiveNumber,
  mergeSettings,
  parseSettings,
  settingKeys,
  type Parse,
  type SettingTable,
} from "./setting-chain";

/** A language code as the translation tables key it: trimmed and lowercased. */
const languageCode: Parse<string> = (raw) => nonEmptyString(raw)?.toLowerCase();

/**
 * What a card's rendering can be told, resolved once per card.
 *
 * The chain is baseline → system → card type → deck → note, and every layer
 * may set every key. A system sets defaults for its cards, a card type refines
 * them, a deck overrides them for one print run, and a note is the exception.
 * There is no per-key permission, and no deck-only key for what a deck can say
 * with the card's own: a deck that wants no overflow on this print says
 * `overflow-mode: none`, one that wants every card twice says `copies: 2`.
 *
 * What is resolved once per deck instead is `deck-settings.ts`.
 */
export interface CardSettings {
  /** Physical geometry. */
  cardSize?: CardSize;
  /** What a card does when its content cannot fit at the smallest type size. */
  overflowMode?: OverflowMode;
  /** The named, mutually exclusive ways this card may be laid out. */
  layouts?: LayoutCandidate[];
  /** How the winning layout candidate is chosen. */
  layoutDecision?: LayoutDecision;
  /** Which face the in-note preview shows. Deck output always renders both. */
  side?: CardSide;
  /** Height of the in-note preview, in pixels. */
  displayHeight?: number;
  /** How many times this card is printed. */
  copies?: number;
  /** Print one card per value of the roll range — a property of the kind of card. */
  expandByRoll?: boolean;
  /**
   * The language the card is printed in — which translation table captions
   * come from, and the `lang` its root carries. A setting rather than a
   * property: it says how the card comes out, not what the card is, and the
   * loader puts the system's primary language under the system's own layer so
   * a system that says nothing prints in the language it was written in.
   */
  language?: string;
}

export type OverflowMode = "none" | "extra-cards" | "back-then-cards";
export type CardSide = "front" | "back" | "both";

/**
 * One way of laying a card out. The layout engine produces every candidate,
 * measures what the decision names, and commits the winner, stamped as
 * `.cs-layout-<name>` so CSS can show or hide content per candidate. The
 * engine lives in `src/layout/`; the shape is data and is declared here.
 */
export interface LayoutCandidate {
  name: string;
  /** The parity of front faces this candidate produces when overflow fires. */
  frontFaceCount: "any" | "odd" | "even";
  /** Chosen when no candidate is eligible, so the list can never come up empty. */
  fallback: boolean;
  /** Only in the running if the named measured element clears the length. */
  eligibleIf?: { element: string; minWidth?: string; minHeight?: string };
}

export interface LayoutDecision {
  /** Tried in order; the first metric that separates the candidates decides. */
  order: LayoutMetric[];
  tieBreak: "declaration-order";
}

export interface LayoutMetric {
  metric: "printed-cards" | "element-size" | "whitespace";
  direction: "minimize" | "maximize";
  /** For `element-size`: which measured element, along which dimension — its
   * width, its height, or (absent, the default) the area of its box. */
  element?: string;
  dimension?: "width" | "height" | "area";
  /** For `element-size`: differences below this count as a tie. */
  epsilon?: number;
}

const CARD_SETTINGS: SettingTable<CardSettings> = {
  cardSize: { key: "card-size", parse: parseCardSize },
  overflowMode: {
    key: "overflow-mode",
    parse: oneOf(["none", "extra-cards", "back-then-cards"]),
  },
  layouts: { key: "layouts", parse: parseLayouts },
  layoutDecision: { key: "layout-decision", parse: parseLayoutDecision },
  side: { key: "side", parse: oneOf(["front", "back", "both"]) },
  displayHeight: { key: "display-height", parse: positiveNumber },
  copies: { key: "copies", parse: positiveInteger },
  expandByRoll: { key: "expand-by-roll", parse: booleanValue },
  language: { key: "language", parse: languageCode },
};

/** The keys an author may write, in table order. */
export const CARD_SETTING_KEYS = settingKeys(CARD_SETTINGS);

export function isCardSettingKey(key: string): boolean {
  return CARD_SETTING_KEYS.includes(key);
}

/** Read one layer — a system's, a card type's, a deck block's, a note's — typed. */
export function parseCardSettings(
  raw: Record<string, unknown> | undefined,
  diagnostics: Diagnostics
): CardSettings {
  return parseSettings(CARD_SETTINGS, raw, "card", diagnostics);
}

/** Fold the chain, lowest layer first; the highest layer that has a field wins it. */
export function mergeCardSettings(
  layers: readonly (CardSettings | undefined)[]
): CardSettings {
  return mergeSettings(CARD_SETTINGS, layers);
}

// ── Layout candidates ───────────────────────────────────────────────

const CANDIDATE_NAME = /^[a-z0-9_-]+$/;

function parseLayouts(raw: unknown): LayoutCandidate[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const out: LayoutCandidate[] = [];
  for (const item of raw) {
    const candidate = parseCandidate(item);
    if (!candidate) return undefined;
    out.push(candidate);
  }
  return out;
}

function parseCandidate(raw: unknown): LayoutCandidate | undefined {
  if (!isMapping(raw)) return undefined;
  const name = nonEmptyString(raw["name"])?.toLowerCase();
  if (!name || !CANDIDATE_NAME.test(name)) return undefined;

  const frontFaceCount =
    raw["front-face-count"] === undefined
      ? "any"
      : oneOf(["any", "odd", "even"] as const)(raw["front-face-count"]);
  if (!frontFaceCount) return undefined;

  const out: LayoutCandidate = {
    name,
    frontFaceCount,
    fallback: raw["fallback"] === true,
  };

  if (raw["eligible-if"] !== undefined) {
    const guard = raw["eligible-if"];
    if (!isMapping(guard)) return undefined;
    const element = nonEmptyString(guard["element"]);
    if (!element) return undefined;
    out.eligibleIf = { element };
    const minWidth = nonEmptyString(guard["min-width"]);
    const minHeight = nonEmptyString(guard["min-height"]);
    if (minWidth) out.eligibleIf.minWidth = minWidth;
    if (minHeight) out.eligibleIf.minHeight = minHeight;
    if (!minWidth && !minHeight) return undefined;
  }
  return out;
}

function parseLayoutDecision(raw: unknown): LayoutDecision | undefined {
  if (!isMapping(raw) || !Array.isArray(raw["order"]) || raw["order"].length === 0) {
    return undefined;
  }
  const order: LayoutMetric[] = [];
  for (const item of raw["order"]) {
    const metric = parseMetric(item);
    if (!metric) return undefined;
    order.push(metric);
  }
  const tieBreak =
    raw["tie-break"] === undefined
      ? "declaration-order"
      : oneOf(["declaration-order"] as const)(raw["tie-break"]);
  if (!tieBreak) return undefined;
  return { order, tieBreak };
}

const parseMetricName: Parse<LayoutMetric["metric"]> = oneOf([
  "printed-cards",
  "element-size",
  "whitespace",
]);

function parseMetric(raw: unknown): LayoutMetric | undefined {
  if (!isMapping(raw)) return undefined;
  const metric = parseMetricName(raw["metric"]);
  const direction = oneOf(["minimize", "maximize"] as const)(raw["direction"]);
  if (!metric || !direction) return undefined;
  const out: LayoutMetric = { metric, direction };
  const element = nonEmptyString(raw["element"]);
  if (element) out.element = element;
  const dimension = oneOf(["width", "height", "area"] as const)(raw["dimension"]);
  if (dimension) out.dimension = dimension;
  const epsilon = positiveNumber(raw["epsilon"]);
  if (epsilon !== undefined) out.epsilon = epsilon;
  if (metric === "element-size" && !element) return undefined;
  return out;
}
