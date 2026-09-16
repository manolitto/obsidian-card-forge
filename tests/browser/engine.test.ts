import { afterEach, describe, expect, it } from "vitest";
import { collectDiagnostics } from "../../src/definitions/diagnostics";
import { layoutCard, type LayoutSystem } from "../../src/layout/engine";
import { readScaleFromTransform } from "../../src/layout/font-scaler";
import type { RenderedCard } from "../../src/render/renderer";
import { BASELINE } from "../../src/systems/baseline";
import { loadedSystem } from "../helpers/render";
import {
  backHtml,
  faceHtml,
  fontReady,
  paragraphs,
  TEST_FONT_FAMILY,
} from "./helpers/face";
import { listFixtures, renderFixture } from "./helpers/fixtures";

/**
 * The engine end to end: a rendered card in, its physical cards out — over
 * a synthetic card whose overflow is known, and over the real fixtures
 * through the real loader.
 */

const TYPE = `${BASELINE.stylesheet}
.card-root { font: 12px/1.3 "${TEST_FONT_FAMILY}"; padding: 4%; --card-font-size-min: 8px; --card-font-size-title-min: 10px; }
.card-title { font-size: 20px; padding: 0 4%; }
.card-body-scalable p { margin: 0 0 0.5em; }`;

const system: LayoutSystem = { id: "synthetic", stylesheet: async () => TYPE };

function card(
  body: string,
  settings: RenderedCard["settings"],
  withBack = true
): RenderedCard {
  const faces: RenderedCard["faces"] = { front: faceHtml({ body }) };
  if (withBack) faces.back = backHtml();
  return { name: "Synthetic", cardTypeId: "card", settings, faces };
}

const roots = (html: string | undefined) => {
  const el = document.createElement("div");
  el.innerHTML = html ?? "";
  return el.firstElementChild as HTMLElement;
};

afterEach(() => {
  expect(document.body.querySelector("div[aria-hidden]")).toBeNull();
});

describe("layoutCard", () => {
  it("returns one settled pair for a card that fits", async () => {
    await fontReady();
    const diagnostics = collectDiagnostics();
    const out = await layoutCard(card(paragraphs(2), {}), system, document, diagnostics);
    expect(diagnostics.messages).toEqual([]);
    expect(out.clipped).toBe(false);
    expect(out.cards).toHaveLength(1);
    expect(out.name).toBe("Synthetic");
    expect(out.cardTypeId).toBe("card");
    const front = roots(out.cards[0]!.front);
    expect(front.classList.contains("card-front")).toBe(true);
    expect(front.classList.contains("cf-front-first")).toBe(true);
    expect(front.classList.contains("cf-layout-default")).toBe(true);
    expect(roots(out.cards[0]!.back).classList.contains("card-back")).toBe(true);
  });

  it("bakes the committed scale into a body that had to shrink", async () => {
    const out = await layoutCard(
      card(paragraphs(7), {}),
      system,
      document,
      collectDiagnostics()
    );
    const body = roots(out.cards[0]!.front).querySelector<HTMLElement>(
      ".card-body-scalable"
    )!;
    const scale = readScaleFromTransform(body);
    expect(scale).toBeGreaterThan(8 / 12);
    expect(scale).toBeLessThan(1);
    expect(body.style.width).toBe((100 / scale).toFixed(2) + "%");
  });

  it("clips under `none` and says so", async () => {
    const out = await layoutCard(
      card(paragraphs(30), { overflowMode: "none" }),
      system,
      document,
      collectDiagnostics()
    );
    expect(out.clipped).toBe(true);
    expect(out.cards).toHaveLength(1);
  });

  it("pairs spawned cards two by two under extra-cards", async () => {
    const out = await layoutCard(
      card(paragraphs(14), { overflowMode: "extra-cards" }),
      system,
      document,
      collectDiagnostics()
    );
    expect(out.clipped).toBe(false);
    expect(out.cards).toHaveLength(2);
    for (const pair of out.cards) {
      expect(roots(pair.front).classList.contains("card-front")).toBe(true);
      expect(roots(pair.back).classList.contains("card-back")).toBe(true);
    }
    expect(roots(out.cards[1]!.front).classList.contains("cf-front-continued")).toBe(
      true
    );
  });

  it("pairs a back-as-front clone as the first card's back", async () => {
    const out = await layoutCard(
      card(paragraphs(14), { overflowMode: "back-then-cards" }),
      system,
      document,
      collectDiagnostics()
    );
    expect(out.cards).toHaveLength(1);
    const back = roots(out.cards[0]!.back);
    expect(back.classList.contains("cf-overflow-back-as-front")).toBe(true);
  });

  it("honours a parity candidate: three fronts and the designed back are two cards", async () => {
    const out = await layoutCard(
      card(paragraphs(14), {
        overflowMode: "back-then-cards",
        layouts: [{ name: "odd", frontFaceCount: "odd", fallback: true }],
      }),
      system,
      document,
      collectDiagnostics()
    );
    expect(out.cards).toHaveLength(2);
    expect(roots(out.cards[0]!.back).classList.contains("card-front")).toBe(true);
    expect(roots(out.cards[1]!.front).classList.contains("card-front")).toBe(true);
    expect(roots(out.cards[1]!.back).classList.contains("card-back")).toBe(true);
  });

  it("gives a card without a back one front per physical card", async () => {
    const out = await layoutCard(
      card(paragraphs(14), { overflowMode: "back-then-cards" }, false),
      system,
      document,
      collectDiagnostics()
    );
    expect(out.cards).toHaveLength(2);
    expect(out.cards.every((pair) => pair.back === undefined)).toBe(true);
  });

  it("returns the card as rendered when the layout fails, and says why", async () => {
    const diagnostics = collectDiagnostics();
    const broken: LayoutSystem = {
      id: "broken",
      stylesheet: async () => {
        throw new Error("no stylesheet today");
      },
    };
    const input = card(paragraphs(14), { overflowMode: "extra-cards" });
    const out = await layoutCard(input, broken, document, diagnostics);
    expect(out.cards).toEqual([{ front: input.faces.front, back: input.faces.back }]);
    expect(out.clipped).toBe(false);
    expect(diagnostics.messages).toEqual([
      "Synthetic: layout failed, the card is printed as rendered — no stylesheet today",
    ]);
  });
});

describe("layoutCard over the fixtures", () => {
  it("lays every fixture out through the real loader, fonts hoisted", async () => {
    for (const fixture of listFixtures()) {
      const system = await loadedSystem(fixture.system);
      for (const rendered of await renderFixture(fixture)) {
        const diagnostics = collectDiagnostics();
        const out = await layoutCard(rendered, system, document, diagnostics);
        expect(diagnostics.messages, `${fixture.system}/${fixture.name}`).toEqual([]);
        expect(out.cards.length, `${fixture.system}/${fixture.name}`).toBeGreaterThan(0);
        for (const pair of out.cards) {
          if (rendered.faces.front) expect(pair.front).toContain('class="card-root');
          if (rendered.faces.back) expect(pair.back).toContain('class="card-root');
        }
      }
      expect(
        document.head.querySelector(`style[data-cf-fonts="${fixture.system}"]`)
      ).not.toBeNull();
    }
    // The system's fonts went into the document once, and are still there.
    expect(document.fonts.check("12px 'Source Sans 3'")).toBe(true);
  });
});
