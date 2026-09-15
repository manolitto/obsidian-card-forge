import { afterEach, describe, expect, it } from "vitest";
import { scaleFontSize } from "../src/layout/font-scaler";

// `scaleFontSize` binary-searches a `.text-scalable` title down until it fits
// its container. Node has no layout engine, so these tests drive it against a
// hand-rolled layout model instead: one unbreakable word whose width is
// proportional to the font size, inside a container with padding.
//
// That is the shape of a card back's category line — `padding: 0 4%` around
// a single long word — and it is the shape that pins the one thing this file
// guards: the search must measure the container's CONTENT box. Measured
// against the padding box, the title is handed its own padding as free
// width, the search stops one padding too late, and the card root clips the
// overflow. A browser test would show the same, but not why.

const PX_PER_MM = 96 / 25.4;

/** The few members of an element the search reads and writes. */
interface FakeTitle {
  style: { fontSize: string };
  parentElement: FakeContainer | null;
  readonly clientWidth: number;
  readonly scrollWidth: number;
  readonly clientHeight: number;
  readonly scrollHeight: number;
}

interface FakeContainer {
  clientWidth: number;
  clientHeight: number;
}

interface Model {
  el: FakeTitle;
  container: FakeContainer;
  contentW: number;
  fontPx: () => number;
}

/** Build a title/container pair with a proportional-width unbreakable word.
 *
 * `wordRatio` is the word's width in px per px of font-size, so the word
 * measures `wordRatio * fontSize` however the search shrinks it. The element
 * lays out shrink-to-fit — `max(min-content, min(max-content, available))` —
 * which for an unbreakable word means it grows past the content box rather
 * than overflowing inside it, exactly as Chromium does. */
function model(opts: {
  cardWidth: number;
  paddingPx: number;
  cascadePx: number;
  wordRatio: number;
  titleMinPx: number;
}): Model {
  const contentW = opts.cardWidth - 2 * opts.paddingPx;

  // Generous height so only the width can bind the search.
  const container: FakeContainer = {
    clientWidth: Math.round(opts.cardWidth),
    clientHeight: 1000,
  };
  const style = { fontSize: "" };
  const fontPx = () => (style.fontSize ? parseFloat(style.fontSize) : opts.cascadePx);
  const el: FakeTitle = {
    style,
    parentElement: container,
    get clientWidth() {
      return Math.round(Math.max(contentW, opts.wordRatio * fontPx()));
    },
    get scrollWidth() {
      return this.clientWidth;
    },
    get clientHeight() {
      return Math.round(fontPx() * 1.05);
    },
    get scrollHeight() {
      return this.clientHeight;
    },
  };

  (globalThis as { getComputedStyle?: unknown }).getComputedStyle = (node: unknown) =>
    node === container
      ? {
          paddingTop: "0px",
          paddingBottom: "0px",
          paddingLeft: opts.paddingPx + "px",
          paddingRight: opts.paddingPx + "px",
        }
      : {
          fontSize: fontPx() + "px",
          getPropertyValue: (k: string) =>
            k === "--card-font-size-title-min" ? opts.titleMinPx + "px" : "",
        };

  return { el, container, contentW, fontPx };
}

const scale = (el: FakeTitle) => scaleFontSize(el as unknown as HTMLElement);

/** A back title at poker size: 63 mm card, `padding: 0 4%`, cascade font
 * 7.72 mm, and a long word that measures 241 px at that size in Chromium. */
function paddedBack() {
  const cardWidth = 63 * PX_PER_MM;
  const cascadePx = 63 * 0.1225 * PX_PER_MM;
  return model({
    cardWidth,
    paddingPx: cardWidth * 0.04,
    cascadePx,
    wordRatio: 241 / cascadePx,
    titleMinPx: 2.4 * PX_PER_MM,
  });
}

describe("scaleFontSize", () => {
  afterEach(() => {
    delete (globalThis as { getComputedStyle?: unknown }).getComputedStyle;
  });

  it("shrinks a title into the container's CONTENT box, not its padding box", () => {
    const { el, contentW } = paddedBack();

    // Precondition: at the cascade size the word overflows the content box.
    expect(el.scrollWidth).toBeGreaterThan(contentW + 1);

    scale(el);

    expect(el.scrollWidth).toBeLessThanOrEqual(contentW + 1);
  });

  it("does not stop at the padding box (the cut-off-heading trap)", () => {
    const { el, container, contentW } = paddedBack();
    scale(el);

    // Measuring `container.clientWidth` would have settled here instead —
    // fitting the padding box while still overflowing the content box by the
    // two paddings, which the card root then clips.
    expect(el.scrollWidth).toBeLessThan(container.clientWidth);
    expect(container.clientWidth - contentW).toBeGreaterThan(1);
  });

  it("leaves a title that already fits at its cascade size", () => {
    const cardWidth = 63 * PX_PER_MM;
    const cascadePx = 20;
    const { el } = model({
      cardWidth,
      paddingPx: cardWidth * 0.04,
      cascadePx,
      wordRatio: 5, // 100 px at cascade — well inside the 219 px content box
      titleMinPx: 2.4 * PX_PER_MM,
    });

    scale(el);

    expect(parseFloat(el.style.fontSize)).toBeCloseTo(cascadePx, 1);
  });

  it("never shrinks below the --card-font-size-title-min floor", () => {
    const cardWidth = 63 * PX_PER_MM;
    const cascadePx = 29;
    const titleMinPx = 2.4 * PX_PER_MM;
    const { el } = model({
      cardWidth,
      paddingPx: cardWidth * 0.04,
      cascadePx,
      wordRatio: 40, // absurdly wide — cannot fit even at the floor
      titleMinPx,
    });

    scale(el);

    expect(parseFloat(el.style.fontSize)).toBeGreaterThanOrEqual(titleMinPx - 0.01);
  });

  it("is unchanged for a container without padding", () => {
    const cardWidth = 63 * PX_PER_MM;
    const cascadePx = 29;
    const { el, contentW } = model({
      cardWidth,
      paddingPx: 0,
      cascadePx,
      wordRatio: 241 / cascadePx,
      titleMinPx: 2.4 * PX_PER_MM,
    });

    scale(el);

    expect(contentW).toBeCloseTo(cardWidth, 5);
    expect(el.scrollWidth).toBeLessThanOrEqual(cardWidth + 1);
  });

  it("starts a second pass from the cascade size, not from the first pass's result", () => {
    const { el, fontPx } = paddedBack();
    scale(el);
    const first = fontPx();
    // Widen the container between passes: a title capped at its first-pass
    // size could never grow back into the room it now has.
    el.parentElement!.clientWidth *= 2;
    scale(el);
    expect(fontPx()).toBeGreaterThan(first);
  });
});
