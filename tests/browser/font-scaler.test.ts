import { afterEach, describe, expect, it } from "vitest";
import {
  cfMeasureWhitespace,
  processBody,
  readScaleFromTransform,
  resolveBodyMinScale,
  scaleFontSize,
  scaleOneBody,
  type LayoutConfig,
} from "../../src/layout/font-scaler";
import { faceHtml, mountFace, paragraphs, type MountedFace } from "./helpers/face";

/**
 * The font scaler against real boxes. Each case is one face under the base
 * stylesheet and a few lines of type, so the only thing that varies is what
 * the case is about: how much text, how wide a title, where the floor sits.
 */

const TYPE = `
.card-root { font: 12px/1.3 sans-serif; padding: 4%; --card-font-size-min: 8px; --card-font-size-title-min: 10px; }
.card-title { font-size: 28px; padding: 0 4%; }
.card-body-scalable p { margin: 0 0 0.5em; }
`;

let mounted: MountedFace | undefined;
afterEach(() => {
  mounted?.unmount();
  mounted = undefined;
});

function mount(html: string, css = TYPE) {
  mounted = mountFace(html, css);
  return mounted.root;
}

const body = (root: HTMLElement) =>
  root.querySelector<HTMLElement>(".card-body-scalable")!;
const title = (root: HTMLElement) => root.querySelector<HTMLElement>(".text-scalable")!;

/** The committed frame's own verdict: does the body fit its stretched box? */
const fitsCommitted = (el: HTMLElement) => el.scrollHeight <= el.clientHeight + 1;

describe("scaleOneBody", () => {
  it("leaves a body that fits alone", () => {
    const root = mount(faceHtml({ body: paragraphs(3) }));
    const el = body(root);
    expect(el.scrollHeight).toBeLessThanOrEqual(el.clientHeight);

    expect(scaleOneBody(el)).toBe(false);

    expect(el.style.transform).toBe("");
    expect(el.style.width).toBe("");
  });

  it("commits a scale between the floor and 1 for a body that overflows", () => {
    const root = mount(faceHtml({ body: paragraphs(7) }));
    const el = body(root);
    expect(el.scrollHeight).toBeGreaterThan(el.clientHeight);
    const floor = resolveBodyMinScale(el);
    expect(floor).toBeCloseTo(8 / 12, 5);

    expect(scaleOneBody(el)).toBe(false);

    const scale = readScaleFromTransform(el);
    expect(scale).toBeGreaterThan(floor);
    expect(scale).toBeLessThan(1);
    // The box is stretched by 1/scale so the scaled body fills its slot …
    expect(el.style.width).toBe((100 / scale).toFixed(2) + "%");
    expect(el.style.height).toBe(el.style.width);
    expect(el.style.minHeight).toBe(el.style.width);
    expect(el.style.transformOrigin).toBe("left top");
    // … and measured in that frame, the content fits.
    expect(fitsCommitted(el)).toBe(true);
  });

  it("stops at the floor --card-font-size-min sets and reports the clip", () => {
    const root = mount(faceHtml({ body: paragraphs(30) }));
    const el = body(root);

    expect(scaleOneBody(el)).toBe(true);

    expect(readScaleFromTransform(el)).toBeCloseTo(8 / 12, 3);
    expect(fitsCommitted(el)).toBe(false);
  });

  it("reads the floor from the cascade, so a card type can lower it", () => {
    const root = mount(
      faceHtml({ body: paragraphs(30) }),
      `${TYPE}\n.card-root { --card-font-size-min: 6px; }`
    );
    const el = body(root);
    scaleOneBody(el);
    expect(readScaleFromTransform(el)).toBeCloseTo(6 / 12, 3);
  });

  it("commits the same scale on a second pass over a body with %-sized content", async () => {
    // A percentage resolves against the box the previous pass stretched:
    // without the reset at the top of the search, a second pass would
    // measure a wider image in a wider body and settle somewhere else.
    const svg =
      "data:image/svg+xml," +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100"/></svg>'
      );
    const root = mount(
      faceHtml({
        body: `<img src="${svg}" style="width: 50%; height: auto; display: block">${paragraphs(5)}`,
      })
    );
    await root.querySelector("img")!.decode();
    const el = body(root);

    scaleOneBody(el);
    const first = readScaleFromTransform(el);
    scaleOneBody(el);
    const second = readScaleFromTransform(el);

    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThan(1);
    expect(second).toBe(first);
  });

  it("lays a body out at a forced scale and reports whether it fits there", () => {
    const root = mount(faceHtml({ body: paragraphs(7) }));
    const el = body(root);
    scaleOneBody(el);
    const free = readScaleFromTransform(el);

    expect(scaleOneBody(el, 0.9)).toBe(true);
    expect(el.style.transform).toBe("scale(0.9)");
    expect(el.style.width).toBe("111.11%");

    expect(scaleOneBody(el, free)).toBe(false);
    expect(readScaleFromTransform(el)).toBe(free);
  });
});

describe("scaleFontSize", () => {
  const contentWidth = (el: HTMLElement) => {
    const c = el.parentElement!;
    const s = getComputedStyle(c);
    return c.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight);
  };

  it("leaves a title that fits at its cascade size", () => {
    const root = mount(faceHtml({ title: "Short", body: "" }));
    const el = title(root);
    scaleFontSize(el);
    expect(parseFloat(el.style.fontSize)).toBeCloseTo(28, 1);
  });

  it("shrinks a title too wide for its header until it fits the content box", () => {
    const root = mount(faceHtml({ title: "DÄMONENBESCHWÖRUNGSRITUAL", body: "" }));
    const el = title(root);
    expect(el.scrollWidth).toBeGreaterThan(contentWidth(el) + 1);

    scaleFontSize(el);

    const px = parseFloat(el.style.fontSize);
    expect(px).toBeLessThan(28);
    expect(px).toBeGreaterThanOrEqual(10);
    expect(el.scrollWidth).toBeLessThanOrEqual(contentWidth(el) + 1);
  });

  it("does not shrink below --card-font-size-title-min", () => {
    const root = mount(
      faceHtml({ title: "DÄMONENBESCHWÖRUNGSRITUAL", body: "" }),
      `${TYPE}\n.card-root { --card-font-size-title-min: 24px; }`
    );
    const el = title(root);
    scaleFontSize(el);
    expect(parseFloat(el.style.fontSize)).toBeCloseTo(24, 2);
    expect(el.scrollWidth).toBeGreaterThan(contentWidth(el) + 1);
  });
});

describe("processBody", () => {
  const layoutClasses = (root: HTMLElement) =>
    Array.from(root.classList).filter((c) => c.startsWith("cf-layout-"));
  const candidates: LayoutConfig = {
    layouts: [
      {
        name: "image-side",
        frontFaceCount: "any",
        fallback: false,
        eligibleIf: { element: "hero", minHeight: "10mm" },
      },
      { name: "image-none", frontFaceCount: "any", fallback: true },
    ],
    decision: {
      order: [{ metric: "element-size", element: "hero", direction: "maximize" }],
      tieBreak: "declaration-order",
    },
  };
  const heroCss = (height: string) => `${TYPE}
.hero { display: none; height: ${height}; background: #888; }
.cf-layout-image-side .hero { display: block; }`;
  const withHero = () =>
    faceHtml({ body: `<div class="hero" data-cf-measure="hero"></div>${paragraphs(2)}` });

  it("commits the candidate whose guard the measured element clears", () => {
    const root = mount(withHero(), heroCss("15mm"));
    expect(processBody(body(root), candidates)).toBe(false);
    expect(layoutClasses(root)).toEqual(["cf-layout-image-side"]);
    expect(root.querySelector<HTMLElement>(".hero")!.clientHeight).toBeGreaterThan(0);
  });

  it("falls back when the element measures under the guard", () => {
    const root = mount(withHero(), heroCss("5mm"));
    processBody(body(root), candidates);
    expect(layoutClasses(root)).toEqual(["cf-layout-image-none"]);
  });

  it("skips the candidate loop for a parity-only set", () => {
    const parity: LayoutConfig = {
      layouts: [{ name: "default", frontFaceCount: "odd", fallback: true }],
      decision: {
        order: [{ metric: "printed-cards", direction: "minimize" }],
        tieBreak: "declaration-order",
      },
    };
    const root = mount(faceHtml({ body: paragraphs(2) }));
    processBody(body(root), parity);
    expect(layoutClasses(root)).toEqual([]);
  });
});

describe("cfMeasureWhitespace", () => {
  it("reads the unfilled share of the last front face's body", () => {
    const empty = mount(faceHtml({ body: "" }));
    expect(cfMeasureWhitespace([empty])).toBe(1);
    mounted!.unmount();

    const half = mount(faceHtml({ body: paragraphs(2) }));
    const ws = cfMeasureWhitespace([half]);
    expect(ws).toBeGreaterThan(0.3);
    expect(ws).toBeLessThan(0.8);
    mounted!.unmount();

    // A scaled body measures in the same frame: the transform cancels. The
    // search commits the largest scale that fits, and lines wrap whole, so a
    // full body still leaves under a line's worth of gap.
    const full = mount(faceHtml({ body: paragraphs(7) }));
    scaleOneBody(body(full));
    expect(cfMeasureWhitespace([full])).toBeLessThan(0.2);
  });
});
