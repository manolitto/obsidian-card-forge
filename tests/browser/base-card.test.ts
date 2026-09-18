import { describe, expect, it } from "vitest";
import { mountFace } from "./helpers/face";

/**
 * The rules the base stylesheet ships for what the layout engine stamps.
 * The engine never writes text into a card; the counter's "X / N" and the
 * re-anchoring of a continued body are CSS alone, so they are checked here
 * on hand-stamped faces rather than through the splitter.
 */

function counterFace(props: string): string {
  return `<div class="card-root card-front${props ? " cs-overflow-active" : ""}"
       style="--card-width: 63mm; --card-height: 88mm; ${props}">
  <div class="card-header">
    <div class="card-title"><span class="text-scalable">Title</span><span class="cs-overflow-counter"></span></div>
  </div>
  <div class="card-content-container"><div class="card-body-scalable"><p>Body</p></div></div>
</div>`;
}

describe("the page counter", () => {
  it("shows nothing on a card that fit", () => {
    const { root, unmount } = mountFace(counterFace(""));
    try {
      const counter = root.querySelector<HTMLElement>(".cs-overflow-counter")!;
      expect(getComputedStyle(counter).display).toBe("none");
      expect(counter.getBoundingClientRect().width).toBe(0);
    } finally {
      unmount();
    }
  });

  it("renders the two properties inside an overflowed group", () => {
    const short = mountFace(counterFace("--cs-front-index: 2; --cs-front-total: 3;"));
    const long = mountFace(counterFace("--cs-front-index: 12; --cs-front-total: 13;"));
    try {
      const a = short.root.querySelector<HTMLElement>(".cs-overflow-counter")!;
      const b = long.root.querySelector<HTMLElement>(".cs-overflow-counter")!;
      expect(getComputedStyle(a).display).toBe("inline");
      expect(getComputedStyle(a, "::after").content).toBe(
        'counter(cs-idx) " / " counter(cs-tot)'
      );
      // The text comes from the properties: two more digits, a wider box.
      const wa = a.getBoundingClientRect().width;
      const wb = b.getBoundingClientRect().width;
      expect(wa).toBeGreaterThan(0);
      expect(wb).toBeGreaterThan(wa);
      expect(getComputedStyle(a).whiteSpace).toBe("nowrap");
    } finally {
      long.unmount();
      short.unmount();
    }
  });
});

describe("a continued body", () => {
  const anchored = (cls: string) =>
    `<div class="card-root card-front" style="--card-width: 63mm; --card-height: 88mm;">
  <div class="card-content-container">
    <div class="card-body-scalable anchored ${cls}"><div>Tail</div></div>
  </div>
</div>`;

  it("flows from the top edge whatever the body anchors to", () => {
    const css = ".anchored { justify-content: flex-end; }";
    const bottom = mountFace(anchored(""), css);
    const top = mountFace(anchored("cs-body-continued"), css);
    try {
      const gap = (root: HTMLElement) => {
        const body = root.querySelector<HTMLElement>(".card-body-scalable")!;
        const p = body.querySelector<HTMLElement>("div")!;
        return p.getBoundingClientRect().top - body.getBoundingClientRect().top;
      };
      expect(gap(bottom.root)).toBeGreaterThan(100);
      expect(gap(top.root)).toBeLessThan(1);
    } finally {
      top.unmount();
      bottom.unmount();
    }
  });
});
