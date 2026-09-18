import type { CardCopies } from "../definitions/deck-settings";
import type { Diagnostics } from "../definitions/diagnostics";
import type { LaidOutCard } from "../layout/engine";

/**
 * One card as it goes onto a sheet: a front, a back, or both, settled.
 * The unit the export composes and counts.
 */
export interface PhysicalCard {
  /** The note's name, for messages. */
  name: string;
  cardTypeId: string;
  front?: string;
  back?: string;
}

/** A laid-out card with the path of the note it came from, which `card-copies` may name. */
export interface DeckCard {
  path: string;
  card: LaidOutCard;
}

/**
 * The deck's physical cards, each printed as often as it should be, each
 * with the faces its `side` keeps — a card that says `front` contributes
 * no back, and a deck of such cards prints no back pages at all.
 *
 * Copies multiply physical cards, not notes: a card whose text spilled onto
 * three faces, printed twice, is six physical cards, the two runs
 * consecutive. How often is the deck's `card-copies` entry for the card if
 * there is one, else the card's own `copies` — the setting the chain
 * resolved through system, card type, deck and note — else once. An entry
 * names a card by vault path, path without `.md`, or note name; one that
 * names no card in the deck is reported, since it is most likely a typo.
 */
export function applyCopies(
  cards: readonly DeckCard[],
  overrides: readonly CardCopies[] | undefined,
  diagnostics: Diagnostics
): PhysicalCard[] {
  const matched = new Set<CardCopies>();
  const out: PhysicalCard[] = [];

  for (const { path, card } of cards) {
    const override =
      overrides?.filter((entry) => names(entry.name, path, card.name)) ?? [];
    for (const entry of override) matched.add(entry);
    const count = override.at(-1)?.copies ?? card.settings.copies ?? 1;

    const side = card.settings.side ?? "both";
    for (let i = 0; i < count; i++) {
      for (const faces of card.cards) {
        out.push({
          name: card.name,
          cardTypeId: card.cardTypeId,
          ...(faces.front === undefined || side === "back" ? {} : { front: faces.front }),
          ...(faces.back === undefined || side === "front" ? {} : { back: faces.back }),
        });
      }
    }
  }

  for (const entry of overrides ?? []) {
    if (!matched.has(entry)) {
      diagnostics.warn(`card-copies: "${entry.name}" names no card in the deck`);
    }
  }
  return out;
}

function names(key: string, path: string, name: string): boolean {
  return key === path || key === path.replace(/\.md$/i, "") || key === name;
}
