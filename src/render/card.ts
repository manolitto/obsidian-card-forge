import { prepareCardProps } from "../definitions/card-props";
import {
  mergeCardSettings,
  parseCardSettings,
  type CardSettings,
} from "../definitions/card-settings";
import { prefixDiagnostics, type Diagnostics } from "../definitions/diagnostics";
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
  /** Baseline → system → card type → note. */
  settings: CardSettings;
  /** The fold above, prepared: lowercased, defaults filled, the alias proxy on. */
  props: Record<string, unknown>;
  /** `settings.language`, or `""` when no layer says. */
  language: string;
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
  diagnostics.warn(`${note.path}: the card-forge block names no system:`);
  return undefined;
}

/** The note's cards, resolved against the system its block names. `[]` when it cannot be. */
export function resolveCards(
  note: CardNote,
  system: LoadedSystem,
  diagnostics: Diagnostics
): ResolvedCard[] {
  const cardType = resolveCardType(note, system, diagnostics);
  if (!cardType) return [];

  const noteSettings = parseCardSettings(
    everythingBut(note.card, CARD_KEYS),
    prefixDiagnostics(diagnostics, `${note.path}: card.`)
  );
  const settings = mergeCardSettings([cardType.cardSettings, noteSettings]);
  const language = settings.language ?? "";

  const below = {
    ...lowercased(note.sections),
    ...lowercased(note.frontmatter),
    ...lowercased(note.data),
  };
  const rows = note.table ? tableRows(note, note.table, diagnostics) : [{}];

  return rows.map((row) => ({
    cardTypeId: cardType.declaration.id,
    settings,
    language,
    props: prepareCardProps(
      { ...below, ...lowercased(row) },
      { aliases: cardType.aliases, defs: cardType.properties, fileName: note.name }
    ),
  }));
}

/**
 * The card type the block names — or the system's only one when it names
 * none, since a `card-type:` line there could name nothing else.
 */
function resolveCardType(
  note: CardNote,
  system: LoadedSystem,
  diagnostics: Diagnostics
): LoadedCardType | undefined {
  const ids = Object.keys(system.cardTypes);
  const named = String(note.card["card-type"] ?? "")
    .trim()
    .toLowerCase();
  if (!named) {
    const only = ids.length === 1 ? system.cardTypes[ids[0] as string] : undefined;
    if (only) return only;
    diagnostics.warn(
      `${note.path}: the card-forge block names no card-type:, and ${system.id} has ${
        ids.length === 0 ? "none" : `${ids.length}: ${ids.join(", ")}`
      }`
    );
    return undefined;
  }
  const cardType = system.cardTypes[named];
  if (!cardType) {
    diagnostics.warn(
      `${note.path}: ${system.id} has no card type "${named}"${
        ids.length > 0 ? ` (it has ${ids.join(", ")})` : ""
      }`
    );
  }
  return cardType;
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
