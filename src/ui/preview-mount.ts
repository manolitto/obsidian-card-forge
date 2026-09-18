import type { CardSide } from "../definitions/card-settings";
import type { LaidOutCard } from "../layout/engine";
import { hoistFontFaces } from "../layout/host";
import type { CardSize } from "../model/card-size";

/*
 * Settled faces on the screen, at a display height.
 *
 * The layout engine has already done everything that measures: every face
 * arrives with its title fitted, its body scaled, its pictures faded. What
 * is left is to show them — each face in a box of the card's size in CSS
 * pixels, scaled by `transform` to the height the reader asked for, under
 * the card type's stylesheet in a shadow root so the card's CSS and
 * Obsidian's never touch. A shadow root cannot load a font, so the
 * `@font-face` rules are hoisted into the document's head the way the
 * layout host does it; a system's fonts are parsed once per document
 * however many previews show it.
 *
 * DOM only: no Obsidian, no measurement, no scaling of text.
 */

export interface PreviewMount {
  root: ShadowRoot;
  remove(): void;
}

/** CSS pixels per millimetre at the 96 dpi a browser renders `mm` at. */
const PX_PER_MM = 96 / 25.4;

/**
 * The faces of a laid-out card as the preview shows them: every face of
 * every physical card in print order, then the ones `side` keeps. `both`
 * keeps everything; a card that spilled onto three fronts under `side:
 * front` shows the three fronts.
 */
export function previewFaces(card: LaidOutCard, side: CardSide = "both"): string[] {
  const out: string[] = [];
  for (const pair of card.cards) {
    if (pair.front !== undefined && side !== "back") out.push(pair.front);
    if (pair.back !== undefined && side !== "front") out.push(pair.back);
  }
  return out;
}

/**
 * Put the faces on the screen inside `host`. `stylesheet` is the card's
 * whole cascade as `LoadedSystem.stylesheet` assembles it; `systemId` keys
 * the hoisted fonts; `cardSize` is the size every face was laid out at.
 */
export function mountPreview(
  host: HTMLElement,
  systemId: string,
  stylesheet: string,
  faces: readonly string[],
  cardSize: CardSize,
  displayHeight: number
): PreviewMount {
  const doc = host.ownerDocument;
  const css = hoistFontFaces(doc, systemId, stylesheet);

  const scale = displayHeight / (cardSize.height * PX_PER_MM);
  const width = cardSize.width * PX_PER_MM * scale;

  const mount = doc.createElement("div");
  mount.className = "cs-preview";
  host.appendChild(mount);

  const root = mount.attachShadow({ mode: "open" });
  root.innerHTML =
    `<style>${css}\n${MOUNT_CSS}</style>` +
    `<div class="cs-preview-faces">` +
    faces
      .map(
        (face) =>
          `<div class="cs-preview-face" style="width:${width.toFixed(2)}px;height:${displayHeight}px">` +
          `<div class="cs-preview-scale" style="transform:scale(${scale.toFixed(5)})">${face}</div>` +
          `</div>`
      )
      .join("") +
    `</div>`;

  return {
    root,
    remove() {
      mount.remove();
    },
  };
}

/**
 * The wrappers' own rules, inside the shadow root because that is where
 * the wrappers are. The face scales from its top-left corner into a box
 * of exactly the scaled size, so the boxes flow like the cards they show.
 */
const MOUNT_CSS = `
.cs-preview-faces { display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-start; }
.cs-preview-face { position: relative; overflow: hidden; flex: none; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12), 0 4px 12px rgba(0, 0, 0, 0.18); }
.cs-preview-scale { transform-origin: top left; }
`;
