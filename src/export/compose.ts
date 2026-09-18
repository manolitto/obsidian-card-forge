import type { PhysicalCard } from "../deck/copies";
import type { Deck } from "../deck/pipeline";
import type { CutMarks, DuplexFlip } from "../definitions/deck-settings";
import type { CardSize } from "../model/card-size";
import { DEFAULT_PAPER_PRESET, PAPER_PRESETS, type PaperSize } from "../model/paper-size";

/*
 * Page composition: a deck's physical cards onto sheets of paper.
 *
 * Everything here is millimetres and pure arithmetic. A page holds one
 * grid of one card size, packed without gaps and centred inside the page
 * margin; the fronts of a sheet go on one page and their backs, mirrored
 * along the axis the duplex flip turns about, on the next. What comes out
 * is positions — where each side of each card sits, and where the cut
 * marks go — for the document to render.
 */

/** The grid a deck is imposed in: the paper the right way round, and where the cards sit on it. */
export interface Grid {
  /** The paper as printed — width across, height down. */
  paper: { width: number; height: number };
  card: CardSize;
  columns: number;
  rows: number;
  /** The grid's top-left corner on the page. */
  originX: number;
  originY: number;
}

/** One side of one card at one place on a page. */
export interface Cell {
  /** The card's position in the deck, so a front and its back can be told to belong together. */
  index: number;
  side: "front" | "back";
  name: string;
  cardTypeId: string;
  x: number;
  y: number;
  /** The settled face; absent for the back of a card that has none — the place stays empty. */
  html?: string;
}

export interface Page {
  side: "front" | "back";
  cells: Cell[];
  /** The cut marks, as lines in millimetres on the page. */
  marks: Line[];
}

export interface Line {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** What the composer reads of a deck. */
export interface Composable {
  cards: readonly PhysicalCard[];
  cardSize: CardSize;
  paperSize: PaperSize;
  pageMargin: number;
  duplexFlip: DuplexFlip;
  cutMarks: CutMarks;
}

/**
 * Lay the grid out. `auto` orientation tries the paper both ways and takes
 * the one that holds more cards, portrait on a tie. A paper that is the card
 * itself, either way round, is one card with no margin: the sheet is the
 * card. A card that does not fit the paper even once is an error naming both.
 */
export function layoutGrid(paper: PaperSize, card: CardSize, pageMargin: number): Grid {
  if (paperIsCard(paper, card)) {
    return {
      paper: { width: card.width, height: card.height },
      card,
      columns: 1,
      rows: 1,
      originX: 0,
      originY: 0,
    };
  }

  const short = Math.min(paper.width, paper.height);
  const long = Math.max(paper.width, paper.height);
  const portrait = fit({ width: short, height: long }, card, pageMargin);
  const landscape = fit({ width: long, height: short }, card, pageMargin);
  const chosen =
    paper.orientation === "portrait"
      ? portrait
      : paper.orientation === "landscape"
        ? landscape
        : landscape.columns * landscape.rows > portrait.columns * portrait.rows
          ? landscape
          : portrait;

  if (chosen.columns < 1 || chosen.rows < 1) {
    throw new Error(
      `A ${card.width} × ${card.height} mm card does not fit on ${chosen.paper.width} × ${chosen.paper.height} mm paper inside a ${pageMargin} mm margin`
    );
  }
  return chosen;
}

function fit(
  paper: { width: number; height: number },
  card: CardSize,
  margin: number
): Grid {
  const usableWidth = paper.width - 2 * margin;
  const usableHeight = paper.height - 2 * margin;
  const columns = Math.max(0, Math.floor(usableWidth / card.width));
  const rows = Math.max(0, Math.floor(usableHeight / card.height));
  return {
    paper,
    card,
    columns,
    rows,
    originX: margin + (usableWidth - columns * card.width) / 2,
    originY: margin + (usableHeight - rows * card.height) / 2,
  };
}

function paperIsCard(paper: PaperSize, card: CardSize): boolean {
  const same = (a: number, b: number): boolean => Math.abs(a - b) < 0.01;
  return (
    (same(paper.width, card.width) && same(paper.height, card.height)) ||
    (same(paper.width, card.height) && same(paper.height, card.width))
  );
}

/**
 * The pages, in print order: for each sheet its front page, then — when
 * any card in the deck has a back — its back page. A deck of fronts alone
 * prints no blank sheets; a deck with one back keeps every back page, so
 * that duplex alignment holds from the first sheet to the last.
 *
 * On a back page each card sits where its front lands after the flip:
 * turned about the long edge, the columns mirror within the row; about
 * the short edge, the rows mirror within the column.
 */
export function composePages(deck: Composable): { pages: Page[]; grid: Grid } {
  const grid = layoutGrid(deck.paperSize, deck.cardSize, deck.pageMargin);
  const perPage = grid.columns * grid.rows;
  const withBacks = deck.cards.some((card) => card.back !== undefined);
  const pages: Page[] = [];

  for (let start = 0; start < deck.cards.length; start += perPage) {
    const sheet = deck.cards.slice(start, start + perPage);
    const front: Cell[] = [];
    const back: Cell[] = [];
    sheet.forEach((card, i) => {
      const column = i % grid.columns;
      const row = Math.floor(i / grid.columns);
      const index = start + i;
      front.push({
        index,
        side: "front",
        name: card.name,
        cardTypeId: card.cardTypeId,
        ...at(grid, column, row),
        ...(card.front === undefined ? {} : { html: card.front }),
      });
      const mirrored =
        deck.duplexFlip === "short-edge"
          ? at(grid, column, grid.rows - 1 - row)
          : at(grid, grid.columns - 1 - column, row);
      back.push({
        index,
        side: "back",
        name: card.name,
        cardTypeId: card.cardTypeId,
        ...mirrored,
        ...(card.back === undefined ? {} : { html: card.back }),
      });
    });
    pages.push({
      side: "front",
      cells: front,
      marks: cutMarks(front, grid, deck.cutMarks),
    });
    if (withBacks) {
      pages.push({
        side: "back",
        cells: back,
        marks: cutMarks(back, grid, deck.cutMarks),
      });
    }
  }
  return { pages, grid };
}

/** A built deck onto pages: its settings are the composition's inputs, the baseline having answered whatever the block did not. */
export function composeDeck(deck: Deck): { pages: Page[]; grid: Grid } {
  const { settings } = deck;
  return composePages({
    cards: deck.cards,
    cardSize: deck.cardSize,
    paperSize: settings.paperSize ?? {
      ...PAPER_PRESETS[DEFAULT_PAPER_PRESET],
      orientation: "auto",
    },
    pageMargin: settings.pageMargin ?? 0,
    duplexFlip: settings.duplexFlip ?? "long-edge",
    cutMarks: settings.cutMarks ?? {},
  });
}

function at(grid: Grid, column: number, row: number): { x: number; y: number } {
  return {
    x: grid.originX + column * grid.card.width,
    y: grid.originY + row * grid.card.height,
  };
}

/**
 * Cut marks for a page: short lines in the margins, one pair per cut. Every
 * edge of every card on the page is a cut, and a cut is marked at both ends
 * — outside the block of cards, `margin` clear of it, `length` long — so no
 * mark ever crosses a card face and a cut through the middle of the block
 * is marked at the sheet's edge, where the blade starts. Positions come
 * from the cells as placed, so a back page's marks mirror with its cards.
 */
export function cutMarks(cells: readonly Cell[], grid: Grid, marks: CutMarks): Line[] {
  if (!marks.enabled || cells.length === 0) return [];
  const length = marks.length ?? 3;
  const gap = marks.margin ?? 0;
  const { width, height } = grid.card;

  const xs = new Set<number>();
  const ys = new Set<number>();
  let left = Infinity;
  let right = -Infinity;
  let top = Infinity;
  let bottom = -Infinity;
  for (const cell of cells) {
    xs.add(cell.x).add(cell.x + width);
    ys.add(cell.y).add(cell.y + height);
    left = Math.min(left, cell.x);
    right = Math.max(right, cell.x + width);
    top = Math.min(top, cell.y);
    bottom = Math.max(bottom, cell.y + height);
  }

  const out: Line[] = [];
  for (const x of [...xs].sort((a, b) => a - b)) {
    out.push({ x1: x, y1: top - gap - length, x2: x, y2: top - gap });
    out.push({ x1: x, y1: bottom + gap, x2: x, y2: bottom + gap + length });
  }
  for (const y of [...ys].sort((a, b) => a - b)) {
    out.push({ x1: left - gap - length, y1: y, x2: left - gap, y2: y });
    out.push({ x1: right + gap, y1: y, x2: right + gap + length, y2: y });
  }
  return out;
}

/** The marks of a page as an SVG the size of the paper, its units millimetres. */
export function cutMarksSvg(page: Page, grid: Grid, marks: CutMarks): string {
  if (page.marks.length === 0) return "";
  const { width, height } = grid.paper;
  const stroke = marks.color ?? "#aaaaaa";
  const weight = marks.weight ?? 0.25;
  const lines = page.marks.map(
    (l) => `<line x1="${mm(l.x1)}" y1="${mm(l.y1)}" x2="${mm(l.x2)}" y2="${mm(l.y2)}"/>`
  );
  return (
    `<svg class="cs-cut-marks" width="${width}mm" height="${height}mm" viewBox="0 0 ${width} ${height}" ` +
    `stroke="${stroke}" stroke-width="${weight}" xmlns="http://www.w3.org/2000/svg">` +
    lines.join("") +
    `</svg>`
  );
}

/** A millimetre value as an attribute: three decimals at most, no trailing zeros. */
export function mm(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

/**
 * The composition as text: page count, then per page each cell's side,
 * position and card name — what a reviewer reads when a card moves.
 */
export function compositionText(pages: readonly Page[], grid: Grid): string {
  const lines = [
    `${pages.length} ${pages.length === 1 ? "page" : "pages"} · ${mm(grid.paper.width)} × ${mm(grid.paper.height)} mm · ${grid.columns} × ${grid.rows} of ${mm(grid.card.width)} × ${mm(grid.card.height)} mm at ${mm(grid.originX)}, ${mm(grid.originY)}`,
  ];
  pages.forEach((page, i) => {
    lines.push(`${i + 1}. ${page.side} · ${page.marks.length} marks`);
    for (const cell of page.cells) {
      lines.push(
        `   ${cell.side} #${cell.index + 1} at ${mm(cell.x)}, ${mm(cell.y)} ${cell.html === undefined ? "(empty) " : ""}${cell.cardTypeId}/${cell.name}`
      );
    }
  });
  return lines.join("\n") + "\n";
}
