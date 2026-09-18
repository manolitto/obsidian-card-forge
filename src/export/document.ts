import type { Deck } from "../deck/pipeline";
import { splitFontFaces } from "../layout/host";
import { escapeHtml } from "../templates/inline-markdown";
import { composeDeck, cutMarksSvg, mm, type Grid, type Page } from "./compose";

/*
 * The export document: a deck's pages as one self-contained HTML file.
 *
 * The same document is what the PDF is printed from and what the HTML
 * export saves — a browser opening either shows the sheets as they print.
 * It is static: every face arrives settled from the layout engine, every
 * picture and font is a data URI, and nothing runs on load. Its own CSS is
 * the page geometry and the few rules that keep Chromium's print engine
 * honest; the cards' look is the card-type stylesheets, carried as they
 * are, with their `@font-face` rules lifted out and written once.
 */

/** A deck ready to save or print: the document, and the paper it is laid out for. */
export interface DeckDocument {
  html: string;
  /** The paper as printed, in millimetres. */
  paper: { width: number; height: number };
  pageCount: number;
}

/** Compose a built deck and write its document. */
export function deckDocument(deck: Deck, title: string): DeckDocument {
  const { pages, grid } = composeDeck(deck);
  return {
    html: exportDocument(deck, pages, grid, title),
    paper: grid.paper,
    pageCount: pages.length,
  };
}

/** The document for pages already composed. */
export function exportDocument(
  deck: Deck,
  pages: readonly Page[],
  grid: Grid,
  title: string
): string {
  const { width, height } = grid.paper;
  const cutMarks = deck.settings.cutMarks ?? {};
  const pageClass =
    deck.settings.paperBackground === "plain" ? "cs-page cs-paper-plain" : "cs-page";

  const fonts = new Set<string>();
  const stylesheets: string[] = [];
  for (const css of deck.stylesheets) {
    const split = splitFontFaces(css);
    for (const rule of split.fonts) fonts.add(rule);
    stylesheets.push(split.rest);
  }

  const body = pages.map((page) => {
    const cells = page.cells
      .filter((cell) => cell.html !== undefined)
      .map(
        (cell) =>
          `<div class="cs-cell" style="left:${mm(cell.x)}mm;top:${mm(cell.y)}mm;width:${mm(grid.card.width)}mm;height:${mm(grid.card.height)}mm">${cell.html}</div>`
      );
    return `<div class="${pageClass}" data-cs-side="${page.side}">${cutMarksSvg(page, grid, cutMarks)}${cells.join("")}</div>`;
  });

  return [
    "<!DOCTYPE html>",
    `<html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>`,
    "<style>",
    pageStyles(width, height),
    "</style>",
    `<style>\n${[...fonts].join("\n")}\n</style>`,
    ...stylesheets.map((css) => `<style>\n${css}\n</style>`),
    "</head><body>",
    ...body,
    "</body></html>",
  ].join("\n");
}

/**
 * The page geometry, and the rules that keep the print engine from
 * rescaling it. Chromium shrinks a page to fit when the content's
 * preferred width exceeds the `@page` width by any amount — a sub-pixel of
 * mm→px rounding is enough — so under `@media print` the root boxes go
 * `auto`, the page takes `100%` rather than a length, and every cell is
 * `contain: layout paint`, so nothing inside a card can widen the page.
 * The card faces get no rule here: they must lay out exactly as they did
 * in the measurement host, which had only their own stylesheet.
 */
function pageStyles(width: number, height: number): string {
  return [
    `@page { size: ${mm(width)}mm ${mm(height)}mm; margin: 0; }`,
    "html, body { margin: 0; padding: 0; background: #ffffff; }",
    `.cs-page { position: relative; width: ${mm(width)}mm; height: ${mm(height)}mm; overflow: hidden; break-after: page; }`,
    ".cs-page:last-child { break-after: auto; }",
    ".cs-cell { position: absolute; overflow: hidden; contain: layout paint; }",
    ".cs-cut-marks { position: absolute; left: 0; top: 0; pointer-events: none; }",
    "@media print {",
    "  html, body { width: auto; height: auto; }",
    "  .cs-page { width: 100%; }",
    "}",
  ].join("\n");
}
