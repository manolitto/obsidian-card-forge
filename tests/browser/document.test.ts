import { afterEach, describe, expect, it } from "vitest";
import { commands } from "vitest/browser";
import { buildDeck, type Deck } from "../../src/deck/pipeline";
import { collectDiagnostics } from "../../src/definitions/diagnostics";
import { composeDeck } from "../../src/export/compose";
import { deckDocument } from "../../src/export/document";
import { loadedSystem } from "../helpers/render";
import { deckNote, fixtureDeckSource, fixtureRenderer } from "./helpers/fixtures";

/**
 * The export document, measured: each fixture deck's document is loaded
 * into a frame and its pages and cells are checked against the composition
 * in real pixels — the paper is the paper, every card sits where the
 * composer put it at the size the deck resolved.
 */

declare module "vitest/browser" {
  interface BrowserCommands {
    writeDeckDocument(system: string, html: string): Promise<void>;
  }
}

const PX_PER_MM = 96 / 25.4;
const systems = { get: (id: string) => loadedSystem(id) };

let frame: HTMLIFrameElement | undefined;
afterEach(() => {
  frame?.remove();
  frame = undefined;
});

async function build(system: string, text?: string): Promise<Deck> {
  const deck = await deckNote(system);
  return buildDeck(
    text ?? deck.text,
    deck.path,
    fixtureDeckSource,
    systems,
    fixtureRenderer(),
    document,
    collectDiagnostics()
  );
}

/** The document on the page, its layout settled. */
async function mounted(html: string): Promise<Document> {
  frame = document.createElement("iframe");
  frame.style.width = "1200px";
  frame.style.height = "800px";
  const loaded = new Promise<void>((resolve) =>
    frame!.addEventListener("load", () => resolve())
  );
  frame.srcdoc = html;
  document.body.append(frame);
  await loaded;
  const doc = frame.contentDocument!;
  await doc.fonts.ready;
  return doc;
}

describe.each(["simple", "dragonbane", "eiserne-zeit"])(
  "the %s deck's document",
  (system) => {
    it("measures as the composition says: paper, pages, every cell in place", async () => {
      const deck = await build(system);
      const { pages, grid } = composeDeck(deck);
      const out = deckDocument(deck, `${system} deck`);
      await commands.writeDeckDocument(system, out.html);
      expect(out.pageCount).toBe(pages.length);
      expect(out.paper).toEqual(grid.paper);

      const doc = await mounted(out.html);
      const pageEls = Array.from(doc.querySelectorAll<HTMLElement>(".cf-page"));
      expect(pageEls).toHaveLength(pages.length);

      pageEls.forEach((pageEl, p) => {
        const page = pages[p]!;
        expect(pageEl.dataset["cfSide"]).toBe(page.side);
        const box = pageEl.getBoundingClientRect();
        expect(box.width).toBeCloseTo(grid.paper.width * PX_PER_MM, 0);
        expect(box.height).toBeCloseTo(grid.paper.height * PX_PER_MM, 0);

        const cells = Array.from(pageEl.querySelectorAll<HTMLElement>(".cf-cell"));
        const placed = page.cells.filter((c) => c.html !== undefined);
        expect(cells).toHaveLength(placed.length);
        cells.forEach((cellEl, i) => {
          const cell = placed[i]!;
          const rect = cellEl.getBoundingClientRect();
          expect(rect.left - box.left).toBeCloseTo(cell.x * PX_PER_MM, 0);
          expect(rect.top - box.top).toBeCloseTo(cell.y * PX_PER_MM, 0);
          expect(rect.width).toBeCloseTo(grid.card.width * PX_PER_MM, 0);
          expect(rect.height).toBeCloseTo(grid.card.height * PX_PER_MM, 0);
          // The face fills its cell: the card rendered at the deck's size.
          const root = cellEl.querySelector<HTMLElement>(".card-root")!;
          expect(root.getBoundingClientRect().width).toBeCloseTo(rect.width, 0);
        });
      });
    });

    it("carries every font once, and no script", async () => {
      const deck = await build(system);
      const { html } = deckDocument(deck, system);
      const rules = html.match(/@font-face\s*\{[^}]*\}/g) ?? [];
      expect(new Set(rules).size).toBe(rules.length);
      expect(rules.length).toBeGreaterThan(0);
      expect(html).not.toContain("<script");
    });
  }
);

describe("plain paper", () => {
  it("stamps the pages, and a design that paints a texture drops it", async () => {
    const block = (background: string) =>
      `\`\`\`card-forge-deck\nsystem: dragonbane\ncard-type: gear\ncard-size: poker\npaper-background: ${background}\n\`\`\``;

    const textured = await mounted(
      deckDocument(await build("dragonbane", block("textured")), "t").html
    );
    const texturedRoot = textured.querySelector<HTMLElement>(".card-root")!;
    expect(textured.querySelector(".cf-paper-plain")).toBeNull();
    expect(
      textured.defaultView!.getComputedStyle(texturedRoot).backgroundImage
    ).toContain("url(");
    frame?.remove();

    const plain = await mounted(
      deckDocument(await build("dragonbane", block("plain")), "p").html
    );
    expect(plain.querySelectorAll(".cf-page.cf-paper-plain")).toHaveLength(
      plain.querySelectorAll(".cf-page").length
    );
    const plainRoot = plain.querySelector<HTMLElement>(".card-root")!;
    expect(plain.defaultView!.getComputedStyle(plainRoot).backgroundImage).toBe("none");
  });
});
