import type { DeckSettings } from "../definitions/deck-settings";
import type { Diagnostics } from "../definitions/diagnostics";
import { layoutCard, type LaidOutCard } from "../layout/engine";
import { CARD_PRESETS, DEFAULT_CARD_PRESET, type CardSize } from "../model/card-size";
import type { CardRenderer, RenderedCard } from "../render/renderer";
import type { LoadedSystem } from "../systems/loader";
import { parseDeckBlock } from "./block";
import { applyCopies, type DeckCard, type PhysicalCard } from "./copies";
import { selectNotes, sortCards } from "./select";
import type { DeckSource } from "./source";

/**
 * A deck note in, its physical cards out in print order: the block parsed,
 * the folder listed, the notes selected, every note rendered with the
 * deck's layer and laid out, the cards sorted, the copies applied. What
 * comes out is everything the export composes from and nothing it has to
 * compute again.
 */
export interface Deck {
  /** Print order, copies applied. */
  cards: PhysicalCard[];
  /** Baseline → deck. */
  settings: DeckSettings;
  /** The one size every card resolved to — or `buildDeck` threw. */
  cardSize: CardSize;
  /** One per card type in the deck, in print order of first use; fonts included, for the document to hoist once. */
  stylesheets: string[];
  outputPath: { pdf: string; html: string };
  /** Names of the cards whose content was cut at the type floor. */
  clipped: string[];
}

/** Where the systems come from: the library's `get`, which throws the message the user should see. */
export interface SystemProvider {
  get(id: string): Promise<LoadedSystem>;
}

/**
 * Called as the work goes: once per note rendered, once per card laid out.
 * Rendering and layout are the two stretches long enough to watch; each
 * counts its own units, since a note may render to several cards.
 */
export type DeckProgress = (
  phase: "render" | "layout",
  done: number,
  total: number
) => void;

/**
 * Build the deck a note describes. The document is the one the layout
 * host mounts in — the plugin window's, or the test's. Throws, with the
 * message the user should see, when there is no deck to build: no block,
 * a system that does not load, no card matching the block, or cards of
 * two sizes. Everything survivable goes to `diagnostics`.
 */
export async function buildDeck(
  text: string,
  path: string,
  source: DeckSource,
  systems: SystemProvider,
  renderer: CardRenderer,
  doc: Document,
  diagnostics: Diagnostics,
  progress: DeckProgress = () => {}
): Promise<Deck> {
  const block = parseDeckBlock(text, path, diagnostics);
  if (!block) throw new Error(`${path}: no card-forge-deck block to build a deck from`);
  const { selection, settings, cardLayer } = block;

  const system = await systems.get(selection.systemId);
  const listed = await source.listNotes(
    selection.folder,
    settings.folderRecursive ?? false,
    diagnostics
  );
  const notes = selectNotes(listed, selection, system, diagnostics);
  if (notes.length === 0) {
    throw new Error(
      `${path}: no cards — no card note under "${selection.folder || "the vault root"}" matches the deck block`
    );
  }

  const rendered: (RenderedCard & { path: string })[] = [];
  for (const [index, { note }] of notes.entries()) {
    const cards = await renderer.render(note, system, diagnostics, cardLayer);
    for (const card of cards) rendered.push({ ...card, path: note.path });
    progress("render", index + 1, notes.length);
  }
  if (rendered.length === 0) {
    throw new Error(
      `${path}: no cards — none of the ${notes.length} selected notes rendered`
    );
  }

  const ordered = sortCards(
    rendered,
    selection.cardTypeIds,
    Object.keys(system.cardTypes)
  );
  const cardSize = oneCardSize(ordered, path);

  const laidOut: DeckCard[] = [];
  const stylesheets = new Map<string, string>();
  const clipped: string[] = [];
  for (const [index, card] of ordered.entries()) {
    if (!stylesheets.has(card.cardTypeId)) {
      stylesheets.set(card.cardTypeId, await system.stylesheet(card.cardTypeId));
    }
    const out: LaidOutCard = await layoutCard(card, system, doc, diagnostics);
    if (out.clipped) clipped.push(out.name);
    laidOut.push({ path: card.path, card: out });
    progress("layout", index + 1, ordered.length);
  }

  return {
    cards: applyCopies(laidOut, settings.cardCopies, diagnostics),
    settings,
    cardSize,
    stylesheets: [...stylesheets.values()],
    outputPath: block.outputPath,
    clipped,
  };
}

/**
 * The size every card resolved to. A page holds one grid and a grid is
 * one card size, so two sizes in a deck are an error naming both card
 * types and both sizes — and the fix, since a deck's own `card-size:`
 * overrides every card's.
 */
function oneCardSize(cards: readonly RenderedCard[], path: string): CardSize {
  const first = cards[0];
  if (!first) return { ...CARD_PRESETS[DEFAULT_CARD_PRESET] };
  const size = sizeOf(first);
  const other = cards.find((card) => {
    const s = sizeOf(card);
    return s.width !== size.width || s.height !== size.height;
  });
  if (other) {
    const o = sizeOf(other);
    throw new Error(
      `${path}: the deck's cards come in two sizes — ${first.cardTypeId} at ${mm(size)}, ` +
        `${other.cardTypeId} at ${mm(o)}. Set card-size: on the deck block to print them on one grid.`
    );
  }
  return size;
}

function sizeOf(card: RenderedCard): CardSize {
  return card.settings.cardSize ?? CARD_PRESETS[DEFAULT_CARD_PRESET];
}

function mm(size: CardSize): string {
  return `${size.width} × ${size.height} mm`;
}
