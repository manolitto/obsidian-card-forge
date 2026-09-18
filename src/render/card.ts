import { prepareCardProps } from "../definitions/card-props";
import {
  mergeCardSettings,
  parseCardSettings,
  type CardSettings,
} from "../definitions/card-settings";
import { prefixDiagnostics, type Diagnostics } from "../definitions/diagnostics";
import type { CardSize } from "../model/card-size";
import type { LoadedCardType, LoadedSystem } from "../systems/loader";
import type { CardNote } from "./note";
import { tableRows } from "./table";

/**
 * Which card a note is, and what it carries.
 *
 * The block's `card:` mapping names the system and the card type and is the
 * note's layer of the card-settings chain; everything else the note says —
 * its sections, its frontmatter, the block's `data:`, a table row — is
 * values, folded in that order, lowest first:
 *
 *     sections < frontmatter < data: < table row
 *
 * A `## Beschreibung` section is therefore a long `description` written
 * where long text belongs, and a `description:` in the frontmatter still
 * wins. A note without a `table:` is one card; one with it is one card per
 * row, the rows sharing everything below them.
 */
export interface ResolvedCard {
  cardTypeId: string;
  /** Baseline → system → card type → deck → note. */
  settings: CardSettings;
  /** The fold above, prepared: lowercased, defaults filled, the alias proxy on. */
  props: Record<string, unknown>;
  /** `settings.language`, or `""` when no layer says. */
  language: string;
  /** `roll-min` as an integer, when the card has one — what a deck sorts by. */
  rollMin?: number;
}

/** The two keys of `card:` that are not settings. */
const CARD_KEYS: readonly string[] = ["system", "card-type"];

/**
 * The system the block names — the caller's to fetch, since fetching is what
 * the library does and throwing the message the user should see is its job.
 * `undefined`, reported, when the block names none: every card note says
 * which system renders it.
 */
export function noteSystemId(
  note: CardNote,
  diagnostics: Diagnostics
): string | undefined {
  const id = String(note.card["system"] ?? "")
    .trim()
    .toLowerCase();
  if (id) return id;
  diagnostics.warn(`${note.path}: the cardsmith block names no system:`);
  return undefined;
}

function differs(a: CardSize | undefined, b: CardSize): boolean {
  return a !== undefined && (a.width !== b.width || a.height !== b.height);
}

function mm(size: CardSize): string {
  return `${size.width} × ${size.height} mm`;
}

/**
 * The note's cards, resolved against the system its block names. `[]` when
 * it cannot be. `deckLayer` is the deck's card settings when the note is
 * rendered as part of one — it folds between the card type and the note,
 * so a deck overrides what a kind of card says and a note still has the
 * last word. The one exception is `cardSize`: a deck prints on one grid,
 * so a deck that names a size prints every card at it, and a note's own
 * size is reported as overridden.
 */
export function resolveCards(
  note: CardNote,
  system: LoadedSystem,
  diagnostics: Diagnostics,
  deckLayer?: CardSettings
): ResolvedCard[] {
  const cardType = resolveCardType(note, system, diagnostics);
  if (!cardType) return [];

  const noteSettings = parseCardSettings(
    everythingBut(note.card, CARD_KEYS),
    prefixDiagnostics(diagnostics, `${note.path}: card.`)
  );
  const settings = mergeCardSettings([cardType.cardSettings, deckLayer, noteSettings]);
  if (deckLayer?.cardSize && differs(noteSettings.cardSize, deckLayer.cardSize)) {
    // A deck is one grid, so its size is every card's; the note's own size
    // is for its preview. Said once per note, since the note wrote it.
    diagnostics.warn(
      `${note.path}: card-size ${mm(noteSettings.cardSize!)} — printed at the deck's ${mm(deckLayer.cardSize)}`
    );
    settings.cardSize = deckLayer.cardSize;
  }
  const language = settings.language ?? "";

  const below = {
    ...lowercased(note.sections),
    ...lowercased(note.frontmatter),
    ...lowercased(note.data),
  };
  const rows = note.table ? tableRows(note, note.table, diagnostics) : [{}];
  const prepare = (raw: Record<string, unknown>): Record<string, unknown> =>
    prepareCardProps(raw, {
      aliases: cardType.aliases,
      defs: cardType.properties,
      fileName: note.name,
    });

  return rows.flatMap((row) => {
    const raw = { ...below, ...lowercased(row) };
    const props = prepare(raw);
    const range = rollRange(props);
    if (!range)
      return [{ cardTypeId: cardType.declaration.id, settings, language, props }];
    if (!settings.expandByRoll || range.min === range.max) {
      return [
        {
          cardTypeId: cardType.declaration.id,
          settings,
          language,
          props,
          rollMin: range.min,
        },
      ];
    }
    // One card per value; the canonical keys are written over the raw
    // fold, so they win however the note spelled the range.
    return rollValues(range, props["roll"]).map(({ value, roll }) => ({
      cardTypeId: cardType.declaration.id,
      settings,
      language,
      props: prepare({ ...raw, roll, "roll-min": value, "roll-max": value }),
      rollMin: value,
    }));
  });
}

// ── The roll range ─────────────────────────────────────────────────

/**
 * The card's roll range, when both bounds are integers and in order. A
 * range a note got backwards is no range — nothing is printed for it and
 * nothing is reported: `roll-min` above `roll-max` reads as a table typo
 * the card shows as written.
 */
function rollRange(
  props: Record<string, unknown>
): { min: number; max: number } | undefined {
  const min = integer(props["roll-min"]);
  const max = integer(props["roll-max"]);
  if (min === undefined || max === undefined || min > max) return undefined;
  return { min, max };
}

/**
 * Every value of the range with its display form, padded the way the
 * source `roll` was: `"03–07"` yields `"03"` … `"07"`, `"9–10"` yields
 * `"9"`, `"10"`. Only a run that carries a leading zero is evidence of
 * padding — the longest run would read `"9–10"` as two digits and invent a
 * zero the table never printed.
 */
function rollValues(
  range: { min: number; max: number },
  sourceRoll: unknown
): { value: number; roll: string }[] {
  const runs = typeof sourceRoll === "string" ? (sourceRoll.match(/\d+/g) ?? []) : [];
  const width = Math.max(
    0,
    ...runs.filter((r) => r.length > 1 && r.startsWith("0")).map((r) => r.length)
  );
  const out: { value: number; roll: string }[] = [];
  for (let value = range.min; value <= range.max; value++) {
    out.push({ value, roll: String(value).padStart(width, "0") });
  }
  return out;
}

function integer(raw: unknown): number | undefined {
  if (typeof raw === "number") return Number.isInteger(raw) ? raw : undefined;
  if (typeof raw !== "string" || !/^\s*-?\d+\s*$/.test(raw)) return undefined;
  return Number(raw);
}

/**
 * The card type a note is — the id its block names, or the system's only
 * one when it names none, since a `card-type:` line there could name
 * nothing else. `undefined`, silently, when the note names a type the
 * system lacks or names none of several: a deck filters on the answer
 * without wanting a report, and `resolveCards` reports when it renders.
 */
export function noteCardTypeId(
  note: CardNote,
  system: { cardTypes: Record<string, unknown> }
): string | undefined {
  const ids = Object.keys(system.cardTypes);
  const named = String(note.card["card-type"] ?? "")
    .trim()
    .toLowerCase();
  if (named) return system.cardTypes[named] ? named : undefined;
  return ids.length === 1 ? ids[0] : undefined;
}

function resolveCardType(
  note: CardNote,
  system: LoadedSystem,
  diagnostics: Diagnostics
): LoadedCardType | undefined {
  const id = noteCardTypeId(note, system);
  if (id !== undefined) return system.cardTypes[id];

  const ids = Object.keys(system.cardTypes);
  const named = String(note.card["card-type"] ?? "").trim();
  if (!named) {
    diagnostics.warn(
      `${note.path}: the cardsmith block names no card-type:, and ${system.id} has ${
        ids.length === 0 ? "none" : `${ids.length}: ${ids.join(", ")}`
      }`
    );
  } else {
    diagnostics.warn(
      `${note.path}: ${system.id} has no card type "${named.toLowerCase()}"${
        ids.length > 0 ? ` (it has ${ids.join(", ")})` : ""
      }`
    );
  }
  return undefined;
}

function everythingBut(
  mapping: Record<string, unknown>,
  keys: readonly string[]
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(mapping)) {
    if (!keys.includes(key)) out[key] = value;
  }
  return out;
}

/** Keys folded to lowercase, so `Preis:` in the frontmatter and `preis:` in the block meet. */
function lowercased(mapping: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(mapping)) out[key.toLowerCase()] = value;
  return out;
}
