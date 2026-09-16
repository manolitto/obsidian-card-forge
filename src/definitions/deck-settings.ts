import { parsePaperSize, type PaperSize } from "../model/paper-size";
import type { Diagnostics } from "./diagnostics";
import {
  booleanValue,
  isMapping,
  nonEmptyString,
  nonNegativeNumber,
  oneOf,
  positiveInteger,
  positiveNumber,
  mergeSettings,
  parseSettings,
  settingKeys,
  type SettingTable,
} from "./setting-chain";

/**
 * What a deck — the thing that collects cards and puts them on pages — can be
 * told. Resolved once per deck, from the baseline and the deck block.
 *
 * Nothing in between has a say, and not because it is forbidden: a deck holds
 * cards of several card types, so a `page-margin:` on one of them could not
 * even be disagreed with. A deck block also carries card settings — overrides
 * for every card it holds — and those go to the card chain as the deck layer;
 * the deck parser splits the two by key.
 */
export interface DeckSettings {
  /** Paper the deck is imposed on. */
  paperSize?: PaperSize;
  /** Blank space in millimetres around the card grid on each page. */
  pageMargin?: number;
  /** Which paper edge is the binding, so fronts and backs align after a flip. */
  duplexFlip?: DuplexFlip;
  /** Alignment marks at each card's corners. Fields merge, so one can change alone. */
  cutMarks?: CutMarks;
  /** Whether to print the system's background textures. Defaults from the settings. */
  paperBackground?: PaperBackground;
  /** Include notes from subfolders when a deck names a folder. */
  folderRecursive?: boolean;
  /** Per-card copy overrides by name, which win over every card's own `copies`. */
  cardCopies?: CardCopies[];
}

export type DuplexFlip = "long-edge" | "short-edge";

export type PaperBackground =
  /** Use the system's background images. */
  | "textured"
  /** Drop them from everything printed or previewed as a deck; a card shown in its note keeps its design. */
  | "plain";

/** Every field optional, because the fold merges them: a deck states only what it changes. */
export interface CutMarks {
  enabled?: boolean;
  /** Millimetres. */
  length?: number;
  /** Millimetres between the card corner and the mark. */
  margin?: number;
  /** A CSS colour. */
  color?: string;
  /** Millimetres. */
  weight?: number;
}

export interface CardCopies {
  /** A card, by vault path, path without `.md`, or basename; `[[…]]` stripped. */
  name: string;
  copies: number;
}

const DECK_SETTINGS: SettingTable<DeckSettings> = {
  paperSize: { key: "paper-size", parse: parsePaperSize },
  pageMargin: { key: "page-margin", parse: nonNegativeNumber },
  duplexFlip: { key: "duplex-flip", parse: oneOf(["long-edge", "short-edge"]) },
  cutMarks: {
    key: "cut-marks",
    parse: parseCutMarks,
    merge: (base, layer) => ({ ...base, ...layer }),
  },
  paperBackground: {
    key: "paper-background",
    parse: oneOf(["textured", "plain"]),
  },
  folderRecursive: { key: "folder-recursive", parse: booleanValue },
  cardCopies: { key: "card-copies", parse: parseCardCopies },
};

/** The keys an author may write, in table order. */
export const DECK_SETTING_KEYS = settingKeys(DECK_SETTINGS);

export function isDeckSettingKey(key: string): boolean {
  return DECK_SETTING_KEYS.includes(key);
}

/** Read one layer — the baseline's or a deck block's — typed. */
export function parseDeckSettings(
  raw: Record<string, unknown> | undefined,
  diagnostics: Diagnostics
): DeckSettings {
  return parseSettings(DECK_SETTINGS, raw, "deck", diagnostics);
}

/** Fold baseline, then deck. The deck wins whole, except `cut-marks`, whose fields merge. */
export function mergeDeckSettings(
  layers: readonly (DeckSettings | undefined)[]
): DeckSettings {
  return mergeSettings(DECK_SETTINGS, layers);
}

function parseCutMarks(raw: unknown): CutMarks | undefined {
  if (!isMapping(raw)) return undefined;
  const out: CutMarks = {};
  for (const [key, value] of Object.entries(raw)) {
    switch (key) {
      case "enabled": {
        const v = booleanValue(value);
        if (v === undefined) return undefined;
        out.enabled = v;
        break;
      }
      case "length":
      case "weight": {
        const v = positiveNumber(value);
        if (v === undefined) return undefined;
        out[key] = v;
        break;
      }
      case "margin": {
        const v = nonNegativeNumber(value);
        if (v === undefined) return undefined;
        out.margin = v;
        break;
      }
      case "color": {
        const v = nonEmptyString(value);
        if (v === undefined) return undefined;
        out.color = v;
        break;
      }
      default:
        return undefined;
    }
  }
  return out;
}

function parseCardCopies(raw: unknown): CardCopies[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: CardCopies[] = [];
  for (const item of raw) {
    if (!isMapping(item)) return undefined;
    const name = nonEmptyString(item["name"])?.replace(/^\[\[|\]\]$/g, "");
    const copies = positiveInteger(item["copies"]);
    if (!name || copies === undefined) return undefined;
    out.push({ name, copies });
  }
  return out;
}
