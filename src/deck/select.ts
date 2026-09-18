import type { Diagnostics } from "../definitions/diagnostics";
import { noteCardTypeId } from "../render/card";
import type { CardNote } from "../render/note";
import type { DeckSelection } from "./block";
import type { TaggedNote } from "./source";

/**
 * Which of a folder's card notes are the deck, and in what order its cards
 * come out. Two steps with a render between them: the filter reads what a
 * note declares and runs before anything is rendered; the sort reads
 * `roll-min`, which a table note has once per row and a German note under
 * an alias, so it runs on the cards the render produced.
 */

/** What the filter reads of a system: its card types, in declaration order, with the language each resolves to. */
export interface SelectionSystem {
  id: string;
  cardTypes: Record<string, { cardSettings: { language?: string } }>;
}

/**
 * The notes the selection keeps, in the order given. Every filter is a
 * conjunction; an empty list filters nothing. A note of another system, or
 * of a card type the deck does not list, is left out silently — that is
 * what the deck asked for — while a card note that names no system at all
 * is reported: it can be in no deck, and someone should hear it.
 */
export function selectNotes(
  notes: readonly TaggedNote[],
  selection: DeckSelection,
  system: SelectionSystem,
  diagnostics: Diagnostics
): TaggedNote[] {
  const cardTypeIds = new Set(selection.cardTypeIds);
  const languages = new Set(selection.languages);

  return notes.filter(({ note, tags }) => {
    const systemId = String(note.card["system"] ?? "")
      .trim()
      .toLowerCase();
    if (!systemId) {
      diagnostics.warn(
        `${note.path}: the cardsmith block names no system:; not in the deck`
      );
      return false;
    }
    if (systemId !== system.id) return false;

    const cardTypeId = noteCardTypeId(note, system);
    if (
      cardTypeIds.size > 0 &&
      (cardTypeId === undefined || !cardTypeIds.has(cardTypeId))
    ) {
      return false;
    }

    if (!matchesTags(tags, selection)) return false;

    if (languages.size > 0) {
      const language = noteLanguage(note, cardTypeId, system);
      // A card whose chain names no language prints in none; there is
      // nothing to hold the filter against, so it passes.
      if (language && !languages.has(language)) return false;
    }
    return true;
  });
}

function matchesTags(noteTags: readonly string[], selection: DeckSelection): boolean {
  const tags = new Set(noteTags.map((tag) => tag.replace(/^#/, "").toLowerCase()));
  const has = (tag: string): boolean => tags.has(tag);
  const { includeTagsAll, includeTagsAny, excludeTagsAny, excludeTagsAll } = selection;
  if (includeTagsAll.length > 0 && !includeTagsAll.every(has)) return false;
  if (includeTagsAny.length > 0 && !includeTagsAny.some(has)) return false;
  if (excludeTagsAny.length > 0 && excludeTagsAny.some(has)) return false;
  if (excludeTagsAll.length > 0 && excludeTagsAll.every(has)) return false;
  return true;
}

/**
 * The language a note's card prints in, as far as the note and the system
 * decide it: the block's own `language:`, else the card type's resolved
 * one. The deck's layer is not consulted — it applies to every card alike
 * and could not tell one from another.
 */
function noteLanguage(
  note: CardNote,
  cardTypeId: string | undefined,
  system: SelectionSystem
): string {
  const own = String(note.card["language"] ?? "")
    .trim()
    .toLowerCase();
  if (own) return own;
  return (cardTypeId && system.cardTypes[cardTypeId]?.cardSettings.language) ?? "";
}

// ── The sort ───────────────────────────────────────────────────────

/** What the sort reads of a card. A rendered card and a laid-out one both are one. */
export interface SortableCard {
  cardTypeId: string;
  name: string;
  /** The lower bound of the card's roll range, when it has one. */
  rollMin?: number;
}

/**
 * Print order: grouped by card type — the deck's `card-type:` order, then
 * the system's declaration order — and within a group by `roll-min`
 * ascending, cards without one after, then by name. Names collate as a
 * reader expects: case and accents do not separate, and `Wolf 2` comes
 * before `Wolf 10`. Stable, so equal cards keep the order they came in.
 */
export function sortCards<T extends SortableCard>(
  cards: readonly T[],
  declaredOrder: readonly string[],
  systemOrder: readonly string[]
): T[] {
  const group = (card: SortableCard): number => {
    const declared = declaredOrder.indexOf(card.cardTypeId);
    if (declared >= 0) return declared;
    const system = systemOrder.indexOf(card.cardTypeId);
    return declaredOrder.length + (system >= 0 ? system : systemOrder.length);
  };
  return [...cards].sort((a, b) => {
    const byGroup = group(a) - group(b);
    if (byGroup !== 0) return byGroup;
    if (a.cardTypeId !== b.cardTypeId) return a.cardTypeId < b.cardTypeId ? -1 : 1;
    const byRoll = (a.rollMin ?? Infinity) - (b.rollMin ?? Infinity);
    if (byRoll !== 0 && !Number.isNaN(byRoll)) return byRoll;
    return NAME_ORDER.compare(a.name, b.name);
  });
}

const NAME_ORDER = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
