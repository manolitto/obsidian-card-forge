import { expect, it } from "vitest";
import { loadedSystem } from "../helpers/render";
import { listFixtures, renderFixture } from "./helpers/fixtures";

/**
 * The browser project's smoke test: a fixture note, its system and the
 * system's fonts all reach a real Chromium through vite, and a face put on
 * the page lays out under its stylesheet. Nothing about layout is asserted
 * beyond that — the layout engine's suites build on exactly this path.
 */

it("lists the fixture notes of every bundled system", () => {
  const systems = new Set(listFixtures().map((f) => f.system));
  expect(systems).toContain("simple");
  expect(systems).toContain("dragonbane");
});

it("renders a simple face into the page under its stylesheet", async () => {
  const fixture = listFixtures().find(
    (f) => f.system === "simple" && f.name === "lantern-of-revealing"
  );
  expect(fixture).toBeDefined();
  const [card] = await renderFixture(fixture!);
  expect(card).toBeDefined();

  const css = await (await loadedSystem("simple")).stylesheet(card!.cardTypeId);
  // The loader inlined the bundled font: the stylesheet needs no file.
  expect(css).toContain("data:font/woff2;base64,");

  const style = document.createElement("style");
  style.textContent = css;
  const host = document.createElement("div");
  host.innerHTML = card!.faces.front!;
  document.head.append(style);
  document.body.append(host);
  try {
    const root = host.querySelector<HTMLElement>(".card-root");
    expect(root).not.toBeNull();
    // A poker card is 63 mm wide; CSS resolves that at 96 dpi.
    expect(root!.getBoundingClientRect().width).toBeCloseTo((63 / 25.4) * 96, 0);
    expect(root!.scrollHeight).toBeGreaterThan(0);
    // The font decodes and is the one the face is set in.
    const faces = await document.fonts.load("16px 'Source Sans 3'", "Lantern");
    expect(faces.length).toBeGreaterThan(0);
    expect(getComputedStyle(root!.querySelector(".card-title")!).fontFamily).toContain(
      "Source Sans 3"
    );
  } finally {
    host.remove();
    style.remove();
  }
});
