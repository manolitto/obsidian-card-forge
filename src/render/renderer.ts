import type { CardSettings } from "../definitions/card-settings";
import type { Diagnostics } from "../definitions/diagnostics";
import { CARD_PRESETS, DEFAULT_CARD_PRESET } from "../model/card-size";
import type { LoadedSystem } from "../systems/loader";
import type { TemplateEngine } from "../templates/engine";
import { resolveCards } from "./card";
import { collectImageLinks, resolveImages, type ImageSource } from "./images";
import type { CardNote } from "./note";

/**
 * A note in, its cards out — each with every face its card type declares.
 *
 * This is the one entry point every surface calls: the in-note preview, the
 * deck, the export. Both faces always render; which one a preview shows is
 * the caller's to pick from `settings.side`, and deck output prints both.
 * The settings ride along for their consumers — `copies` for the deck,
 * `overflowMode` and `layouts` for the layout engine.
 */
export interface RenderedCard {
  /** The note's name — a table note's rows share it and differ by position. */
  name: string;
  cardTypeId: string;
  /** Baseline → system → card type → deck → note. */
  settings: CardSettings;
  faces: Partial<Record<"front" | "back", string>>;
  /** `roll-min` as an integer, when the card has one — what a deck sorts by. */
  rollMin?: number;
}

export class CardRenderer {
  constructor(
    private readonly engine: TemplateEngine,
    private readonly images: ImageSource
  ) {}

  /**
   * Render a note's cards against the system its block names — the system
   * is the caller's to fetch, since the library's `get` throws the message
   * the user should see. `[]` when the note resolves to no card; why is in
   * the sink.
   */
  async render(
    note: CardNote,
    system: LoadedSystem,
    diagnostics: Diagnostics,
    deckLayer?: CardSettings
  ): Promise<RenderedCard[]> {
    const cards = resolveCards(note, system, diagnostics, deckLayer);
    if (cards.length === 0) return [];

    // Every picture any card of the note refers to, read once per note.
    const links = cards.flatMap((card) => collectImageLinks(card.props));
    const images = await resolveImages(links, this.images, note.path);

    const out: RenderedCard[] = [];
    for (const card of cards) {
      const declaration = system.cardTypes[card.cardTypeId]?.declaration;
      const faces: RenderedCard["faces"] = {};
      for (const face of ["front", "back"] as const) {
        const template =
          face === "front" ? declaration?.frontTemplate : declaration?.backTemplate;
        if (!template) continue;
        faces[face] = await this.engine.renderFace(
          {
            system,
            cardTypeId: card.cardTypeId,
            face,
            props: card.props,
            language: card.language,
            cardSize: card.settings.cardSize ?? CARD_PRESETS[DEFAULT_CARD_PRESET],
            images,
          },
          diagnostics
        );
      }
      out.push({
        name: note.name,
        cardTypeId: card.cardTypeId,
        settings: card.settings,
        faces,
        ...(card.rollMin === undefined ? {} : { rollMin: card.rollMin }),
      });
    }
    return out;
  }
}
