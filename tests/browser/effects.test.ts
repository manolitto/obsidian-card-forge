import { afterEach, describe, expect, it } from "vitest";
import { fadeEdges, MAX_FADE_CANVAS_EDGE, readFade } from "../../src/layout/effects";
import {
  mountLayoutHost,
  waitForSettledLayout,
  type LayoutHost,
} from "../../src/layout/host";
import { BASELINE } from "../../src/systems/baseline";
import { faceHtml } from "./helpers/face";

/**
 * The edge fade on real pixels: a marked picture comes back as a PNG of the
 * same size whose corners are clear and whose middle is untouched.
 */

let host: LayoutHost | undefined;
afterEach(() => {
  host?.remove();
  host = undefined;
});

/** A solid picture of the given size, as a data URI. */
function solid(width: number, height: number, color = "#d02020"): string {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
  return canvas.toDataURL("image/png");
}

/** The picture's pixels, decoded from its `src`. */
async function pixels(img: HTMLImageElement): Promise<{
  width: number;
  height: number;
  alphaAt(x: number, y: number): number;
}> {
  const probe = new Image();
  probe.src = img.src;
  await probe.decode();
  const canvas = document.createElement("canvas");
  canvas.width = probe.naturalWidth;
  canvas.height = probe.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(probe, 0, 0);
  return {
    width: canvas.width,
    height: canvas.height,
    alphaAt: (x, y) => ctx.getImageData(x, y, 1, 1).data[3]!,
  };
}

async function mounted(body: string, css = ""): Promise<HTMLImageElement[]> {
  host = mountLayoutHost(document, "effects", `${BASELINE.stylesheet}\n${css}`, [
    faceHtml({ body }),
  ]);
  await waitForSettledLayout(host.root);
  await fadeEdges(host.root);
  return Array.from(host.root.querySelectorAll("img"));
}

describe("fadeEdges", () => {
  it("bakes a fade into a marked picture: same size, clear corners, solid middle", async () => {
    const [img] = await mounted(
      `<img class="fade-edges" src="${solid(200, 100)}" style="display:block; width:50px">`
    );
    expect(img!.src).toMatch(/^data:image\/png;base64,/);
    const out = await pixels(img!);
    expect([out.width, out.height]).toEqual([200, 100]);
    // A corner pixel is sampled half a pixel into the gradient, so "clear"
    // is an alpha of a unit or two, not exactly none.
    expect(out.alphaAt(0, 0)).toBeLessThanOrEqual(2);
    expect(out.alphaAt(199, 99)).toBeLessThanOrEqual(2);
    expect(out.alphaAt(100, 50)).toBe(255);
    // The baseline's 0.06 fades 12 px of the 200 px width; a pixel inside
    // the band is partly there, one past it fully.
    expect(out.alphaAt(6, 50)).toBeGreaterThan(0);
    expect(out.alphaAt(6, 50)).toBeLessThan(255);
    expect(out.alphaAt(20, 50)).toBe(255);
  });

  it("reads how far from the stylesheet, clamped to a half", async () => {
    const [wide, over, none] = await mounted(
      [
        `<img class="fade-edges wide" src="${solid(100, 100)}">`,
        `<img class="fade-edges over" src="${solid(100, 100)}">`,
        `<img class="fade-edges none" src="${solid(100, 100)}">`,
      ].join(""),
      ".wide { --card-image-fade: 0.25; } .over { --card-image-fade: 2; } .none { --card-image-fade: 0; }"
    );
    expect(readFade(wide!)).toBe(0.25);
    expect(readFade(over!)).toBe(0.5);
    expect(readFade(none!)).toBe(0);
    const out = await pixels(wide!);
    expect(out.alphaAt(12, 50)).toBeLessThan(255); // inside the wider band
    expect(out.alphaAt(50, 50)).toBe(255);
  });

  it("leaves a picture alone when the fade is zero, or when it is not marked", async () => {
    const plain = solid(60, 40);
    const [unmarked, zero] = await mounted(
      `<img src="${plain}"><img class="fade-edges" src="${plain}">`,
      ".card-root { --card-image-fade: 0; }"
    );
    expect(unmarked!.src).toBe(plain);
    expect(zero!.src).toBe(plain);
  });

  it("encodes a large picture at the canvas cap, the fade fraction unchanged", async () => {
    const [img] = await mounted(
      `<img class="fade-edges" src="${solid(3000, 300)}" style="display:block; width:60px">`
    );
    const out = await pixels(img!);
    expect(out.width).toBe(MAX_FADE_CANVAS_EDGE);
    expect(out.height).toBe(MAX_FADE_CANVAS_EDGE / 10);
    expect(out.alphaAt(0, 75)).toBeLessThanOrEqual(2);
    expect(out.alphaAt(750, 75)).toBe(255);
  });
});
