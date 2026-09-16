import type { CardSettings } from "../definitions/card-settings";
import type { Diagnostics } from "../definitions/diagnostics";
import type { RenderedCard } from "../render/renderer";
import type { LoadedSystem } from "../systems/loader";
import type { LayoutConfig } from "./font-scaler";
import { mountLayoutHost, waitForSettledLayout, type LayoutHost } from "./host";
import { scaleAndSplitInDom } from "./overflow-splitter";

/*
 * The layout engine's entry point: a rendered card in, its physical cards
 * out. The faces go onto the page in a hidden host under the card's
 * stylesheet, the font scaler fits every title and body, and the overflow
 * splitter paginates a body that does not fit at the floor — onto the
 * back, onto further cards, as the card's overflow mode says. What comes
 * back is settled HTML: every face's body scale inline, every hook class a
 * stylesheet keys on in place. The deck and the export call nothing else.
 */

export interface LaidOutCard {
  name: string;
  cardTypeId: string;
  settings: CardSettings;
  /**
   * In print order, one pair per physical card; a card that fits is one
   * pair. A face is present when its card type declares the template.
   */
  cards: { front?: string; back?: string }[];
  /** Content was cut at the type floor even after the splitter did its best. */
  clipped: boolean;
}

/**
 * What the engine reads of a system: its id, which keys the hoisted fonts,
 * and the stylesheet a card type renders under.
 */
export type LayoutSystem = Pick<LoadedSystem, "id" | "stylesheet">;

/**
 * Lay a card out in `doc`. The document is an argument, not a global: the
 * engine runs in the plugin window and in the browser test, and neither
 * wants the other's. A failure on the way — a stylesheet that does not
 * assemble, an exception in the splitter — is reported to `diagnostics`
 * and the card comes back as rendered, unsplit, rather than lost from its
 * deck.
 */
export async function layoutCard(
  card: RenderedCard,
  system: LayoutSystem,
  doc: Document,
  diagnostics: Diagnostics
): Promise<LaidOutCard> {
  const unsplit: LaidOutCard = {
    name: card.name,
    cardTypeId: card.cardTypeId,
    settings: card.settings,
    cards: [{ ...card.faces }],
    clipped: false,
  };
  const front = card.faces.front;
  const back = card.faces.back;
  if (!front && !back) return unsplit;

  let host: LayoutHost | undefined;
  try {
    const stylesheet = await system.stylesheet(card.cardTypeId);
    const faces = [front, back].filter((face): face is string => face !== undefined);
    host = mountLayoutHost(doc, system.id, stylesheet, faces);
    await waitForSettledLayout(host.root);

    // A card with no front has nothing to paginate: the back is scaled and
    // that is all.
    const result = scaleAndSplitInDom(host.root, {
      mode: front ? (card.settings.overflowMode ?? "none") : "none",
      layout: layoutConfigOf(card.settings),
      frontHtml: front ?? "",
    });

    return {
      ...unsplit,
      cards: pairFaces(host.faces(), front !== undefined, back !== undefined),
      clipped: result.clipped,
    };
  } catch (err) {
    diagnostics.warn(
      `${card.name}: layout failed, the card is printed as rendered — ${
        err instanceof Error ? err.message : String(err)
      }`
    );
    return unsplit;
  } finally {
    host?.remove();
  }
}

/**
 * The candidate set with its decision rule. The baseline seeds both keys,
 * so a chain without them is one that never folded the baseline; it gets
 * the shape the baseline would have given it.
 */
function layoutConfigOf(settings: CardSettings): LayoutConfig {
  return {
    layouts: settings.layouts ?? [
      { name: "default", frontFaceCount: "any", fallback: true },
    ],
    decision: settings.layoutDecision ?? {
      order: [{ metric: "printed-cards", direction: "minimize" }],
      tieBreak: "declaration-order",
    },
  };
}

/**
 * The settled faces, paired onto physical cards. With a back, the faces
 * pair two by two in print order — the splitter keeps the count even, and
 * an odd-parity group's second front IS the first card's back. Without one,
 * every face is a front on a card of its own; without a front, the single
 * face is the back.
 */
function pairFaces(
  faces: readonly string[],
  hasFront: boolean,
  hasBack: boolean
): LaidOutCard["cards"] {
  if (!hasFront) return [{ back: faces[0] }];
  if (!hasBack) return faces.map((front) => ({ front }));
  const cards: LaidOutCard["cards"] = [];
  for (let i = 0; i < faces.length; i += 2) {
    const pair: { front?: string; back?: string } = { front: faces[i] };
    if (faces[i + 1] !== undefined) pair.back = faces[i + 1];
    cards.push(pair);
  }
  return cards;
}
