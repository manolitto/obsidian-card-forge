import { afterEach, beforeAll, describe, expect, it } from "vitest";
import type { OverflowMode } from "../../src/definitions/card-settings";
import { readScaleFromTransform, type LayoutConfig } from "../../src/layout/font-scaler";
import {
  MAX_OVERFLOW_CARDS,
  scaleAndSplitInDom,
} from "../../src/layout/overflow-splitter";
import {
  backHtml,
  faceHtml,
  fontReady,
  mountHost,
  paragraphs,
  TEST_FONT_FAMILY,
  type MountedHost,
} from "./helpers/face";

/**
 * The overflow splitter against real boxes. One synthetic card — the
 * three-part front of `faceHtml`, a designed back with a logo line — and
 * hand-written bodies, so each case pins one branch: a mode, a marker, a
 * guard, a candidate decision. The type face is inlined, so "ten paragraphs
 * to a face at the floor" holds on every machine that runs this.
 */

const TYPE = `
.card-root { font: 12px/1.3 "${TEST_FONT_FAMILY}"; padding: 4%; --card-font-size-min: 8px; --card-font-size-title-min: 10px; }
.card-title { font-size: 20px; padding: 0 4%; }
.card-body-scalable p { margin: 0 0 0.5em; }
.card-body-scalable h3 { margin: 0.5em 0 0.2em; font-size: 1.1em; }
.card-body-scalable table { border-collapse: collapse; width: 100%; }
.card-body-scalable th, .card-body-scalable td { padding: 0.1em 0.3em; text-align: left; }
`;

/** The same type with the floor at the font size: the scale cannot grow, so a
 * split is committed once and a test reads exactly one pass of the cut. */
const NO_GROWTH = TYPE.replace("--card-font-size-min: 8px", "--card-font-size-min: 12px");

const ANY: LayoutConfig = {
  layouts: [{ name: "default", frontFaceCount: "any", fallback: true }],
  decision: {
    order: [{ metric: "printed-cards", direction: "minimize" }],
    tieBreak: "declaration-order",
  },
};

beforeAll(fontReady);

let mounted: MountedHost | undefined;
afterEach(() => {
  mounted?.unmount();
  mounted = undefined;
});

/** Mount the pair and run the splitter over it. */
function split(body: string, mode: OverflowMode, layout = ANY, css = TYPE) {
  const front = faceHtml({ body });
  mounted = mountHost([front, backHtml()], css);
  const container = mounted.container;
  const result = scaleAndSplitInDom(container, { mode, layout, frontHtml: front });
  return { container, result };
}

const roots = (c: ParentNode) =>
  Array.from(c.querySelectorAll<HTMLElement>(".card-root"));
const isFront = (r: HTMLElement) => r.classList.contains("card-front");
const bodyOf = (r: HTMLElement) => r.querySelector<HTMLElement>(".card-body-scalable")!;
/** The front bodies in print order — the ones the note's text flows through. */
const frontBodies = (c: ParentNode) => roots(c).filter(isFront).map(bodyOf);
/** The words of a node, as the splitter counts them: per text node, so `</p><p>` separates. */
const words = (el: Node) => {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const out: string[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    out.push(...(n as Text).data.split(/\s+/).filter(Boolean));
  }
  return out;
};
const wordsOfHtml = (html: string) => {
  const el = document.createElement("div");
  el.innerHTML = html;
  return words(el);
};
const flowWords = (c: ParentNode) => frontBodies(c).flatMap(words);
const classes = (el: Element, prefix: string) =>
  Array.from(el.classList)
    .filter((k) => k.startsWith(prefix))
    .sort();
const frontMarkers = (r: HTMLElement) => classes(r, "cf-front-");
const layoutClasses = (r: HTMLElement) => classes(r, "cf-layout-");
const fits = (el: HTMLElement) => el.scrollHeight <= el.clientHeight + 1;
const lines = (el: HTMLElement) =>
  Math.round(el.scrollHeight / parseFloat(getComputedStyle(el).lineHeight));

describe("the entry gate", () => {
  it("under `none` clips at the floor and produces one pair", () => {
    const { container, result } = split(paragraphs(30), "none");
    expect(result).toEqual({ clipped: true, cardCount: 1 });
    const rs = roots(container);
    expect(rs).toHaveLength(2);
    expect(frontMarkers(rs[0]!)).toEqual(["cf-front-first"]);
    expect(rs.some((r) => r.classList.contains("cf-overflow-active"))).toBe(false);
    expect(fits(bodyOf(rs[0]!))).toBe(false);
  });

  it("leaves a card that fits as one pair in a spawning mode", () => {
    const { container, result } = split(paragraphs(3), "extra-cards");
    expect(result).toEqual({ clipped: false, cardCount: 1 });
    const rs = roots(container);
    expect(rs).toHaveLength(2);
    expect(frontMarkers(rs[0]!)).toEqual(["cf-front-first"]);
    expect(rs[0]!.style.getPropertyValue("--cf-front-total")).toBe("1");
    expect(rs.every((r) => layoutClasses(r).join() === "cf-layout-default")).toBe(true);
  });
});

describe("extra-cards", () => {
  it("spawns a card for a body two faces long, both bodies at one scale", () => {
    const body = paragraphs(14);
    const { container, result } = split(body, "extra-cards");
    expect(result).toEqual({ clipped: false, cardCount: 2 });

    const rs = roots(container);
    expect(rs.map(isFront)).toEqual([true, false, true, false]);
    const [first, , second] = rs as [HTMLElement, HTMLElement, HTMLElement, HTMLElement];
    const b1 = bodyOf(first);
    const b2 = bodyOf(second);

    // The text flows on, nothing lost and nothing doubled.
    expect(flowWords(container)).toEqual(wordsOfHtml(body));
    expect(b1.querySelectorAll("p")).toHaveLength(7);
    expect(b2.querySelectorAll("p")).toHaveLength(7);
    // Both faces fit, at the same scale, above the floor: the fill grew the
    // font back up from the floor the first pass stopped at.
    expect(fits(b1)).toBe(true);
    expect(fits(b2)).toBe(true);
    const scale = readScaleFromTransform(b1);
    expect(scale).toBeGreaterThan(8 / 12);
    expect(scale).toBeLessThan(1);
    expect(readScaleFromTransform(b2)).toBe(scale);

    // The continuation carries the chrome of the front it was cloned from.
    expect(second.querySelector(".card-title")!.textContent).toBe("Title");
    expect(second.querySelector(".card-footer")!.textContent).toBe("Footer");
    // Its back is the designed back, not a copy of anything the first got.
    expect(bodyOf(rs[3]!).textContent).toBe("Logo");

    // Markers: the pagination relationship on the bodies …
    expect(b1.classList.contains("cf-body-continues")).toBe(true);
    expect(b2.classList.contains("cf-body-continued")).toBe(true);
    // … the page position on the fronts …
    expect(frontMarkers(first)).toEqual(["cf-front-first", "cf-front-has-next"]);
    expect(frontMarkers(second)).toEqual(["cf-front-continued"]);
    expect(frontMarkers(rs[1]!)).toEqual([]);
    expect(first.style.getPropertyValue("--cf-front-index")).toBe("1");
    expect(second.style.getPropertyValue("--cf-front-index")).toBe("2");
    expect(second.style.getPropertyValue("--cf-front-total")).toBe("2");
    expect(rs[1]!.style.getPropertyValue("--cf-front-index")).toBe("");
    // … and the group flag on every face, backs included.
    expect(rs.every((r) => r.classList.contains("cf-overflow-active"))).toBe(true);
  });

  it("stops at the card cap and reports the clip", () => {
    const { container, result } = split(paragraphs(110), "extra-cards");
    expect(result).toEqual({ clipped: true, cardCount: MAX_OVERFLOW_CARDS + 1 });
    expect(roots(container)).toHaveLength(2 * (MAX_OVERFLOW_CARDS + 1));
    const last = frontBodies(container).pop()!;
    expect(fits(last)).toBe(false);
  });
});

describe("back-then-cards", () => {
  it("fills the back with a front clone before spawning anything", () => {
    const body = paragraphs(14);
    const { container, result } = split(body, "back-then-cards");
    expect(result).toEqual({ clipped: false, cardCount: 1 });

    const rs = roots(container);
    expect(rs).toHaveLength(2);
    expect(rs.map(isFront)).toEqual([true, true]);
    const back = rs[1]!;
    expect(back.classList.contains("cf-overflow-back-as-front")).toBe(true);
    expect(back.querySelector(".card-title")!.textContent).toBe("Title");
    expect(flowWords(container)).toEqual(wordsOfHtml(body));
    expect(frontMarkers(rs[0]!)).toEqual(["cf-front-first", "cf-front-has-next"]);
    expect(frontMarkers(back)).toEqual(["cf-front-continued"]);
    expect(readScaleFromTransform(bodyOf(back))).toBe(
      readScaleFromTransform(bodyOf(rs[0]!))
    );
  });

  it("spawns once the back is full, and fills every further back too", () => {
    // Five faces of text at the floor: front, back, front, back, front. The
    // fill then grows the font until the third card's back carries text as
    // well — three physical cards either way, and no blank side mid-note.
    const body = paragraphs(50);
    const { container, result } = split(body, "back-then-cards");
    expect(result).toEqual({ clipped: false, cardCount: 3 });
    const rs = roots(container);
    expect(rs.map(isFront)).toEqual([true, true, true, true, true, true]);
    expect(rs.map((r) => r.classList.contains("cf-overflow-back-as-front"))).toEqual([
      false,
      true,
      false,
      true,
      false,
      true,
    ]);
    expect(readScaleFromTransform(bodyOf(rs[0]!))).toBeGreaterThan(8 / 12);
    expect(flowWords(container)).toEqual(wordsOfHtml(body));
    expect(rs.map((r) => r.style.getPropertyValue("--cf-front-index"))).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
    ]);
    expect(frontMarkers(rs[5]!)).toEqual(["cf-front-continued"]);
  });

  it("leaves a spawned card's back designed when nothing flows onto it", () => {
    // With no room to grow, three full faces of text end on the second
    // card's front, and that card keeps the designed back.
    const body = paragraphs(12);
    const { container, result } = split(body, "back-then-cards", ANY, NO_GROWTH);
    expect(result).toEqual({ clipped: false, cardCount: 2 });
    const rs = roots(container);
    expect(rs.map(isFront)).toEqual([true, true, true, false]);
    expect(bodyOf(rs[3]!).textContent).toBe("Logo");
    expect(flowWords(container)).toEqual(wordsOfHtml(body));
  });

  it("behaves as extra-cards for a card without a back", () => {
    const body = paragraphs(14);
    const front = faceHtml({ body });
    mounted = mountHost([front], TYPE);
    const result = scaleAndSplitInDom(mounted.container, {
      mode: "back-then-cards",
      layout: ANY,
      frontHtml: front,
    });
    expect(result).toEqual({ clipped: false, cardCount: 2 });
    expect(roots(mounted.container).map(isFront)).toEqual([true, true]);
    expect(flowWords(mounted.container)).toEqual(wordsOfHtml(body));
  });
});

/** A paragraph longer than a face at the floor: it can only ever be cut. */
const LONG = `<p>${Array.from(
  { length: 18 },
  (_, i) => `Sentence ${i + 1} of the long paragraph goes on for a while.`
).join(" ")}</p>`;

describe("where the cut lands", () => {
  it("keeps the largest prefix of whole blocks and cuts the boundary paragraph", () => {
    // One short line, then a paragraph longer than a face: the line stays,
    // the paragraph is cut where the face ends and continues on the next.
    const body = `<p>Short.</p>${LONG}${paragraphs(6)}`;
    const { container, result } = split(body, "extra-cards");
    expect(result.clipped).toBe(false);
    const [b1, b2] = frontBodies(container) as [HTMLElement, HTMLElement];

    const head = b1.lastElementChild as HTMLElement;
    const tail = b2.firstElementChild as HTMLElement;
    expect(head.tagName).toBe("P");
    expect(head.classList.contains("cf-split-head")).toBe(true);
    expect(tail.classList.contains("cf-split-continuation")).toBe(true);
    expect(b1.children).toHaveLength(2);
    expect([...words(head), ...words(tail)]).toEqual(wordsOfHtml(LONG));
    expect(flowWords(container)).toEqual(wordsOfHtml(body));
  });

  it("moves an atomic block whole rather than cutting it", () => {
    // Four paragraphs, then a keep-together block too tall to follow them but
    // short enough for a face of its own: it goes over intact.
    const block = `<div class="cf-keep-together">${paragraphs(8)}</div>`;
    const body = `${paragraphs(4)}${block}${paragraphs(1)}`;
    const { container, result } = split(body, "extra-cards");
    expect(result.clipped).toBe(false);
    const blocks = container.querySelectorAll(".cf-keep-together");
    expect(blocks).toHaveLength(1);
    expect(words(blocks[0]!)).toEqual(wordsOfHtml(block));
    expect(blocks[0]!.classList.contains("cf-split-head")).toBe(false);
    expect(blocks[0]!.parentElement).toBe(frontBodies(container)[1]);
    expect(flowWords(container)).toEqual(wordsOfHtml(body));
  });

  it("paginates a single wrapper between its children", () => {
    // A template that wraps the whole body in one block: the splitter breaks
    // between that block's paragraphs, never through a sentence.
    const body = `<div class="wrap">${paragraphs(14)}</div>`;
    const { container, result } = split(body, "extra-cards");
    expect(result).toMatchObject({ clipped: false, cardCount: 2 });
    const [b1, b2] = frontBodies(container) as [HTMLElement, HTMLElement];
    expect(b1.children).toHaveLength(1);
    expect(b2.children).toHaveLength(1);
    const headWrap = b1.firstElementChild!;
    const tailWrap = b2.firstElementChild!;
    expect(headWrap.classList.contains("cf-split-head")).toBe(true);
    expect(tailWrap.classList.contains("cf-split-continuation")).toBe(true);
    expect(headWrap.children).toHaveLength(7);
    expect(tailWrap.children).toHaveLength(7);
    expect(container.querySelectorAll("p.cf-split-head")).toHaveLength(0);
  });

  it("abandons a clean boundary that would leave the face a quarter full", () => {
    // Inside one wrapper: a short line, then a paragraph longer than a face.
    // Breaking between the wrapper's children keeps only the short line;
    // below MIN_FACE_FILL the word-level cut inside the paragraph is taken
    // instead, and the face is filled.
    const body = `<div class="wrap"><p>Short.</p>${LONG}${paragraphs(6)}</div>`;
    const { container, result } = split(body, "extra-cards");
    expect(result.clipped).toBe(false);
    const [b1] = frontBodies(container) as [HTMLElement];
    const headWrap = b1.firstElementChild!;
    expect(headWrap.children).toHaveLength(2);
    const head = headWrap.lastElementChild!;
    expect(head.classList.contains("cf-split-head")).toBe(true);
    expect(words(head).length).toBeGreaterThan(20);
    const box = b1.getBoundingClientRect();
    expect(
      (head.getBoundingClientRect().bottom - box.top) / box.height
    ).toBeGreaterThanOrEqual(0.75);
    expect(flowWords(container)).toEqual(wordsOfHtml(body));
  });

  it("leaves neither a one-line orphan nor a one-line widow", () => {
    // One-line paragraphs up to the foot of the face, then a longer one:
    // wherever the boundary falls, a cut through it keeps at least two lines
    // on each side or moves it whole. The floor is pinned so each run is one
    // cut and not a fill's search over many.
    const short = "<p>A line.</p>";
    const long = `<p>${Array.from({ length: 8 }, () => "Lines of prose that the boundary may fall through.").join(" ")}</p>`;
    let movedWhole = 0;
    for (let n = 4; n <= 12; n++) {
      const { container, result } = split(
        `${short.repeat(n)}${long}`,
        "extra-cards",
        ANY,
        NO_GROWTH
      );
      expect(result.clipped).toBe(false);
      const parts = Array.from(
        container.querySelectorAll<HTMLElement>(".cf-split-head, .cf-split-continuation")
      );
      for (const el of parts) expect(lines(el)).toBeGreaterThanOrEqual(2);
      const [, b2] = frontBodies(container);
      if (
        b2 &&
        b2.firstElementChild &&
        words(b2.firstElementChild).length === wordsOfHtml(long).length
      )
        movedWhole++;
      mounted!.unmount();
      mounted = undefined;
    }
    expect(movedWhole).toBeGreaterThan(0);
  });

  it("repeats a table's head on its continuation", () => {
    const rows = Array.from(
      { length: 30 },
      (_, i) => `<tr><td>Row ${i + 1}</td><td>${(i + 1) * 7}</td></tr>`
    ).join("");
    const table = `<table><thead><tr><th>Name</th><th>Value</th></tr></thead><tbody>${rows}</tbody></table>`;
    const body = `<p>Before the table.</p>${table}`;
    const { container, result } = split(body, "extra-cards");
    expect(result).toMatchObject({ clipped: false, cardCount: 2 });
    const tables = Array.from(container.querySelectorAll("table"));
    expect(tables).toHaveLength(2);
    for (const t of tables) {
      expect(t.querySelector("thead")!.textContent).toBe("NameValue");
    }
    expect(tables[0]!.classList.contains("cf-split-head")).toBe(true);
    expect(tables[1]!.classList.contains("cf-split-continuation")).toBe(true);
    const rowTexts = Array.from(container.querySelectorAll("tbody tr")).map(
      (r) => r.textContent
    );
    expect(rowTexts).toEqual(
      Array.from({ length: 30 }, (_, i) => `Row ${i + 1}${(i + 1) * 7}`)
    );
  });
});

describe("%% card-break %%", () => {
  it("splits a body that fits, and the font grows back up to fill both faces", () => {
    const body = `${paragraphs(2)}<div class="cf-card-break"></div>${paragraphs(2)}`;
    const { container, result } = split(body, "extra-cards");
    expect(result).toEqual({ clipped: false, cardCount: 2 });
    const [b1, b2] = frontBodies(container) as [HTMLElement, HTMLElement];
    expect(b1.querySelectorAll("p")).toHaveLength(2);
    expect(b2.querySelectorAll("p")).toHaveLength(2);
    expect(container.querySelectorAll(".cf-card-break")).toHaveLength(0);
    expect(readScaleFromTransform(b1)).toBeGreaterThan(0.95);
    expect(readScaleFromTransform(b2)).toBe(readScaleFromTransform(b1));
  });

  it("is inert under `none`", () => {
    const body = `${paragraphs(2)}<div class="cf-card-break"></div>${paragraphs(2)}`;
    const { container, result } = split(body, "none");
    expect(result).toEqual({ clipped: false, cardCount: 1 });
    expect(roots(container)).toHaveLength(2);
  });

  it("rides along when its leading part does not fit, and fires on the next face", () => {
    const body = `${paragraphs(14)}<div class="cf-card-break"></div>${paragraphs(2)}`;
    const { container, result } = split(body, "extra-cards");
    expect(result).toEqual({ clipped: false, cardCount: 3 });
    const bs = frontBodies(container);
    expect(bs[2]!.querySelectorAll("p")).toHaveLength(2);
    expect(container.querySelectorAll(".cf-card-break")).toHaveLength(0);
    expect(flowWords(container)).toEqual(wordsOfHtml(body));
  });
});

describe("keep markers", () => {
  it("moves a keep-together block whole, whatever it holds", () => {
    const block = `<div class="cf-keep-together">${paragraphs(5)}</div>`;
    const body = `${paragraphs(6)}${block}${paragraphs(2)}`;
    const { container, result } = split(body, "extra-cards");
    expect(result.clipped).toBe(false);
    const blocks = container.querySelectorAll(".cf-keep-together");
    expect(blocks).toHaveLength(1);
    expect(words(blocks[0]!)).toEqual(wordsOfHtml(block));
    expect(flowWords(container)).toEqual(wordsOfHtml(body));
  });

  it("splits a keep-together block larger than a face rather than spawning empty faces", () => {
    const body = `<div class="cf-keep-together">${paragraphs(25)}</div>${paragraphs(1)}`;
    const { container, result } = split(body, "extra-cards");
    expect(result.clipped).toBe(false);
    expect(result.cardCount).toBeLessThanOrEqual(4);
    for (const b of frontBodies(container)) expect(words(b).length).toBeGreaterThan(0);
    expect(flowWords(container)).toEqual(wordsOfHtml(body));
  });

  it("never leaves a heading as the last block of a face", () => {
    for (let n = 6; n <= 12; n++) {
      const body = `${paragraphs(n)}<h3>Heading</h3>${paragraphs(6)}`;
      const { container, result } = split(body, "extra-cards");
      expect(result.clipped).toBe(false);
      for (const b of frontBodies(container)) {
        expect(b.lastElementChild!.tagName).not.toBe("H3");
      }
      mounted!.unmount();
      mounted = undefined;
    }
  });

  it("binds a keep-with-next block to what follows it", () => {
    let pulled = 0;
    for (let n = 6; n <= 12; n++) {
      const body = `${paragraphs(n)}<p class="lead cf-keep-with-next">Lead-in.</p>${paragraphs(6)}`;
      const { container, result } = split(body, "extra-cards");
      expect(result.clipped).toBe(false);
      const bs = frontBodies(container);
      for (const b of bs)
        expect(b.lastElementChild!.classList.contains("lead")).toBe(false);
      if (bs[1]?.firstElementChild?.classList.contains("lead")) pulled++;
      mounted!.unmount();
      mounted = undefined;
    }
    expect(pulled).toBeGreaterThan(0);
  });
});

describe("parity", () => {
  const parity = (name: "odd" | "even"): LayoutConfig => ({
    layouts: [{ name, frontFaceCount: name, fallback: true }],
    decision: ANY.decision,
  });

  it("odd pads with a blank front face and re-appends the designed back", () => {
    const body = paragraphs(14);
    const { container, result } = split(body, "back-then-cards", parity("odd"));
    expect(result.clipped).toBe(false);
    expect(result.cardCount).toBe(3);
    const rs = roots(container);
    expect(rs.map(isFront)).toEqual([true, true, true, false]);
    expect(bodyOf(rs[3]!).textContent).toBe("Logo");
    expect(flowWords(container)).toEqual(wordsOfHtml(body));
    expect(rs.every((r) => layoutClasses(r).join() === "cf-layout-odd")).toBe(true);
    expect(rs.slice(0, 3).map(frontMarkers)).toEqual([
      ["cf-front-first", "cf-front-has-next"],
      ["cf-front-continued", "cf-front-has-next"],
      ["cf-front-continued"],
    ]);
  });

  it("pads with a blank front-chrome face when the text cannot grow into it", () => {
    const body = paragraphs(8);
    const { container, result } = split(
      body,
      "back-then-cards",
      parity("odd"),
      NO_GROWTH
    );
    expect(result).toEqual({ clipped: false, cardCount: 3 });
    const rs = roots(container);
    expect(rs.map(isFront)).toEqual([true, true, true, false]);
    const pad = rs[2]!;
    expect(bodyOf(pad).children).toHaveLength(0);
    expect(pad.querySelector(".card-title")!.textContent).toBe("Title");
    expect(frontMarkers(pad)).toEqual(["cf-front-continued"]);
    expect(flowWords(container)).toEqual(wordsOfHtml(body));
  });

  it("even appends no back", () => {
    const body = paragraphs(14);
    const { container, result } = split(body, "back-then-cards", parity("even"));
    expect(result).toEqual({ clipped: false, cardCount: 2 });
    const rs = roots(container);
    expect(rs.map(isFront)).toEqual([true, true]);
    expect(container.querySelector(".card-back")).toBeNull();
    expect(flowWords(container)).toEqual(wordsOfHtml(body));
  });

  it("is parity in name only outside back-then-cards", () => {
    const { container, result } = split(paragraphs(14), "extra-cards", parity("odd"));
    expect(result).toEqual({ clipped: false, cardCount: 2 });
    expect(roots(container).map(isFront)).toEqual([true, false, true, false]);
  });
});

describe("candidates", () => {
  const twoParities = (
    first: "odd" | "even",
    order = ANY.decision.order
  ): LayoutConfig => {
    const second = first === "odd" ? "even" : "odd";
    return {
      layouts: [
        { name: first, frontFaceCount: first, fallback: true },
        { name: second, frontFaceCount: second, fallback: false },
      ],
      decision: { order, tieBreak: "declaration-order" },
    };
  };

  it("printed-cards picks the parity that prints fewer physical cards", () => {
    // Two faces of text: odd pads to three fronts plus a back (two cards),
    // even is two fronts on one card.
    const { container, result } = split(
      paragraphs(14),
      "back-then-cards",
      twoParities("odd")
    );
    expect(result).toEqual({ clipped: false, cardCount: 2 });
    const rs = roots(container);
    expect(rs.map(isFront)).toEqual([true, true]);
    expect(rs.every((r) => layoutClasses(r).join() === "cf-layout-even")).toBe(true);
  });

  it("declaration order breaks a tie", () => {
    // Three faces of text: odd is three fronts plus a back, even pads to four
    // fronts — two cards either way, so the first declared wins.
    const { container, result } = split(
      paragraphs(24),
      "back-then-cards",
      twoParities("even")
    );
    expect(result.clipped).toBe(false);
    const rs = roots(container);
    expect(rs.every((r) => layoutClasses(r).join() === "cf-layout-even")).toBe(true);
    expect(rs.map(isFront)).toEqual([true, true, true, true]);
  });

  it("whitespace breaks the same tie before declaration order does", () => {
    // Five faces of text with no room to grow: odd is five fronts plus a
    // back, even pads to six fronts — three cards either way — and even's
    // sixth front is the blank pad, so it loses on whitespace.
    const order = [
      ...ANY.decision.order,
      { metric: "whitespace" as const, direction: "minimize" as const },
    ];
    const { container, result } = split(
      paragraphs(20),
      "back-then-cards",
      twoParities("even", order),
      NO_GROWTH
    );
    expect(result).toEqual({ clipped: false, cardCount: 5 });
    const rs = roots(container);
    expect(rs.every((r) => layoutClasses(r).join() === "cf-layout-odd")).toBe(true);
    expect(rs.map(isFront)).toEqual([true, true, true, true, true, false]);
  });

  const guarded = (minHeight: string): LayoutConfig => ({
    layouts: [
      {
        name: "hero",
        frontFaceCount: "any",
        fallback: false,
        eligibleIf: { element: "hero", minHeight },
      },
      { name: "plain", frontFaceCount: "any", fallback: true },
    ],
    decision: {
      order: [{ metric: "element-size", element: "hero", direction: "maximize" }],
      tieBreak: "declaration-order",
    },
  });
  const HERO_CSS = `${TYPE}
.hero { display: none; height: 10mm; background: #888; }
.cf-layout-hero .hero { display: block; }`;
  const heroBody = `<div class="hero" data-cf-measure="hero"></div>${paragraphs(14)}`;

  it("an eligible-if guard excludes a candidate whose element measures short", () => {
    const { container } = split(heroBody, "extra-cards", guarded("30mm"), HERO_CSS);
    const rs = roots(container);
    expect(rs.every((r) => layoutClasses(r).join() === "cf-layout-plain")).toBe(true);
  });

  it("the measured element wins its candidate once it clears the guard", () => {
    const { container, result } = split(
      heroBody,
      "extra-cards",
      guarded("5mm"),
      HERO_CSS
    );
    expect(result.clipped).toBe(false);
    const rs = roots(container);
    expect(rs.every((r) => layoutClasses(r).join() === "cf-layout-hero")).toBe(true);
    expect(rs[0]!.querySelector<HTMLElement>(".hero")!.clientHeight).toBeGreaterThan(0);
  });
});
