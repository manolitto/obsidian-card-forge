import { describe, expect, it } from "vitest";
import type { PhysicalCard } from "../src/deck/copies";
import {
  composePages,
  compositionText,
  cutMarks,
  cutMarksSvg,
  layoutGrid,
  type Composable,
} from "../src/export/compose";
import { CARD_PRESETS, type CardPreset } from "../src/model/card-size";
import { parsePaperSize, type PaperSize } from "../src/model/paper-size";

const paper = (s: string): PaperSize => parsePaperSize(s)!;
const card = (p: CardPreset) => CARD_PRESETS[p];

function cards(count: number, faces: "both" | "front" = "both"): PhysicalCard[] {
  return Array.from({ length: count }, (_, i) => ({
    name: `Card ${i + 1}`,
    cardTypeId: "gear",
    front: `<div>front ${i + 1}</div>`,
    ...(faces === "both" ? { back: `<div>back ${i + 1}</div>` } : {}),
  }));
}

const deck = (over: Partial<Composable> = {}): Composable => ({
  cards: cards(6),
  cardSize: card("poker"),
  paperSize: paper("140 x 280"),
  pageMargin: 0,
  duplexFlip: "long-edge",
  cutMarks: { enabled: true, length: 3, margin: 0, color: "#aaaaaa", weight: 0.25 },
  ...over,
});

describe("layoutGrid", () => {
  it("packs each preset onto A4 both ways round, inside a 10 mm margin", () => {
    const counts = (p: CardPreset, orientation: string) => {
      const g = layoutGrid(paper(`A4 ${orientation}`), card(p), 10);
      return `${g.columns}x${g.rows}`;
    };
    expect(counts("mini", "portrait")).toBe("4x4");
    expect(counts("mini", "landscape")).toBe("6x3");
    expect(counts("poker", "portrait")).toBe("3x3");
    expect(counts("poker", "landscape")).toBe("4x2");
    expect(counts("tarot", "portrait")).toBe("2x2");
    expect(counts("tarot", "landscape")).toBe("3x1");
    expect(counts("large", "portrait")).toBe("2x2");
    expect(counts("large", "landscape")).toBe("3x1");
  });

  it("lets auto pick whichever way holds more, portrait on a tie", () => {
    // Mini: 18 landscape against 16 portrait. Poker: 9 portrait against 8.
    expect(layoutGrid(paper("A4"), card("mini"), 10).paper).toEqual({
      width: 297,
      height: 210,
    });
    expect(layoutGrid(paper("A4"), card("poker"), 10).paper).toEqual({
      width: 210,
      height: 297,
    });
    // A square card ties 3 × 4 against 4 × 3.
    expect(layoutGrid(paper("A4"), { width: 60, height: 60 }, 10).paper).toEqual({
      width: 210,
      height: 297,
    });
  });

  it("centres the block inside the margin", () => {
    const g = layoutGrid(paper("A4 portrait"), card("poker"), 10);
    expect(g.originX).toBeCloseTo(10 + (190 - 189) / 2);
    expect(g.originY).toBeCloseTo(10 + (277 - 264) / 2);
  });

  it("makes a paper that is the card, either way round, one borderless card", () => {
    for (const size of ["63 x 88", "88 x 63"]) {
      const g = layoutGrid(paper(size), card("poker"), 10);
      expect(g).toMatchObject({
        paper: { width: 63, height: 88 },
        columns: 1,
        rows: 1,
        originX: 0,
        originY: 0,
      });
    }
  });

  it("refuses a card that does not fit even once, naming both", () => {
    expect(() => layoutGrid(paper("100 x 100"), card("tarot"), 10)).toThrow(
      "A 70 × 120 mm card does not fit on 100 × 100 mm paper inside a 10 mm margin"
    );
  });
});

describe("composePages", () => {
  const positions = (page: { cells: { index: number; x: number; y: number }[] }) =>
    page.cells.map((c) => `${c.index + 1}@${c.x},${c.y}`);

  it("fills a 2 × 3 grid in reading order and mirrors the backs about the long edge", () => {
    const { pages, grid } = composePages(deck());
    expect([grid.columns, grid.rows]).toEqual([2, 3]);
    expect(pages.map((p) => p.side)).toEqual(["front", "back"]);
    expect(positions(pages[0]!)).toEqual([
      "1@7,8",
      "2@70,8",
      "3@7,96",
      "4@70,96",
      "5@7,184",
      "6@70,184",
    ]);
    // Columns swap within each row; the sheet turns left to right.
    expect(positions(pages[1]!)).toEqual([
      "1@70,8",
      "2@7,8",
      "3@70,96",
      "4@7,96",
      "5@70,184",
      "6@7,184",
    ]);
    expect(pages[1]!.cells[0]!.html).toBe("<div>back 1</div>");
  });

  it("mirrors the rows about the short edge", () => {
    const { pages } = composePages(deck({ duplexFlip: "short-edge" }));
    expect(positions(pages[1]!)).toEqual([
      "1@7,184",
      "2@70,184",
      "3@7,96",
      "4@70,96",
      "5@7,8",
      "6@70,8",
    ]);
  });

  it("goes on to further sheets, the last one part-filled, and mirrors what is there", () => {
    const { pages } = composePages(deck({ cards: cards(8) }));
    expect(pages.map((p) => `${p.side}:${p.cells.length}`)).toEqual([
      "front:6",
      "back:6",
      "front:2",
      "back:2",
    ]);
    expect(positions(pages[2]!)).toEqual(["7@7,8", "8@70,8"]);
    expect(positions(pages[3]!)).toEqual(["7@70,8", "8@7,8"]);
  });

  it("prints no back page for a deck of fronts, and every back page for a deck with one back", () => {
    expect(
      composePages(deck({ cards: cards(8, "front") })).pages.map((p) => p.side)
    ).toEqual(["front", "front"]);
    const mixed = [...cards(7, "front"), ...cards(1)];
    const { pages } = composePages(deck({ cards: mixed }));
    expect(pages.map((p) => p.side)).toEqual(["front", "back", "front", "back"]);
    // The one back sits on the second sheet; the first back page is all empty places.
    expect(pages[1]!.cells.every((c) => c.html === undefined)).toBe(true);
    expect(pages[3]!.cells.map((c) => c.html !== undefined)).toEqual([false, true]);
  });
});

describe("cut marks", () => {
  it("mark every cut at both ends, outside the block, and none across a card", () => {
    const { pages, grid } = composePages(deck());
    const marks = pages[0]!.marks;
    // Three vertical cuts and four horizontal on a full 2 × 3 page, two marks each.
    expect(marks).toHaveLength(14);
    const vertical = marks.filter((l) => l.x1 === l.x2);
    expect([...new Set(vertical.map((l) => l.x1))]).toEqual([7, 70, 133]);
    expect(vertical.filter((l) => l.y2 === grid.originY)).toHaveLength(3); // above
    expect(vertical.filter((l) => l.y1 === grid.originY + 3 * 88)).toHaveLength(3); // below
    for (const l of marks) {
      const insideX = l.x1 > 7 && l.x1 < 133 && l.x2 > 7 && l.x2 < 133;
      const insideY = l.y1 > 8 && l.y1 < 272 && l.y2 > 8 && l.y2 < 272;
      expect(insideX && insideY).toBe(false);
    }
  });

  it("keep a margin from the corner, and mirror with the backs on a part-filled page", () => {
    const { pages } = composePages(
      deck({ cards: cards(1), cutMarks: { enabled: true, length: 4, margin: 1 } })
    );
    const front = pages[0]!.marks;
    expect(front.find((l) => l.x1 === 7 && l.y2 === 8 - 1)).toMatchObject({ y1: 8 - 5 });
    // The one card's back sits in the other column, and its marks with it.
    const back = pages[1]!.marks;
    expect([...new Set(back.filter((l) => l.x1 === l.x2).map((l) => l.x1))]).toEqual([
      70, 133,
    ]);
  });

  it("are none when switched off", () => {
    const grid = layoutGrid(paper("A4"), card("poker"), 10);
    expect(
      cutMarks(
        [{ index: 0, side: "front", name: "a", cardTypeId: "t", x: 10, y: 10 }],
        grid,
        { enabled: false }
      )
    ).toEqual([]);
  });

  it("render as an SVG in millimetres, with the stroke the settings say", () => {
    const { pages, grid } = composePages(deck({ cards: cards(1) }));
    const svg = cutMarksSvg(pages[0]!, grid, {
      enabled: true,
      color: "#ff0000",
      weight: 0.5,
    });
    expect(svg).toMatch(
      /^<svg class="cs-cut-marks" width="140mm" height="280mm" viewBox="0 0 140 280" stroke="#ff0000" stroke-width="0.5"/
    );
    expect(svg).toContain('<line x1="7" y1="5" x2="7" y2="8"/>');
    expect(svg).not.toContain("px");
    expect(cutMarksSvg({ ...pages[0]!, marks: [] }, grid, {})).toBe("");
  });
});

describe("compositionText", () => {
  it("reads as a page count, then each cell's side, place and name", () => {
    const { pages, grid } = composePages(
      deck({ cards: [...cards(1, "front"), ...cards(1)] })
    );
    expect(compositionText(pages, grid)).toBe(
      [
        "2 pages · 140 × 280 mm · 2 × 3 of 63 × 88 mm at 7, 8",
        "1. front · 10 marks",
        "   front #1 at 7, 8 gear/Card 1",
        "   front #2 at 70, 8 gear/Card 1",
        "2. back · 10 marks",
        "   back #1 at 70, 8 (empty) gear/Card 1",
        "   back #2 at 7, 8 gear/Card 1",
        "",
      ].join("\n")
    );
  });
});
