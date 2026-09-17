import { describe, expect, it } from "vitest";
import { commands } from "vitest/browser";
import { buildDeck } from "../../src/deck/pipeline";
import { collectDiagnostics } from "../../src/definitions/diagnostics";
import { deckDocument } from "../../src/export/document";
import { loadedSystem } from "../helpers/render";
import type { PrintedPdf } from "../helpers/pdf-commands";
import { deckNote, fixtureDeckSource, fixtureRenderer } from "./helpers/fixtures";

/**
 * Each fixture deck printed to PDF through Chromium's print engine — the
 * one Electron's `printToPDF` uses — and held to the composition: as many
 * pages as it composed, on the paper it said. Under `UPDATE_GOLDENS=1` the
 * PDFs are written beside the decks for looking at.
 */

declare module "vitest/browser" {
  interface BrowserCommands {
    printPdf(system: string, html: string): Promise<PrintedPdf>;
  }
}

const POINTS_PER_MM = 72 / 25.4;
const systems = { get: (id: string) => loadedSystem(id) };

describe.each([
  "simple",
  "dragonbane",
  "eiserne-zeit",
  "pf2e",
  "mini-d20",
  "dcc",
  "dino-island",
  "tor2e",
  "sw",
  "troubleshooters",
  "5e",
  "dftq",
])("the %s deck prints", (system) => {
  it("to as many pages as it composed, on the paper it said", async () => {
    const deck = await deckNote(system);
    const built = await buildDeck(
      deck.text,
      deck.path,
      fixtureDeckSource,
      systems,
      fixtureRenderer(),
      document,
      collectDiagnostics()
    );
    const out = deckDocument(built, `${system} deck`);
    const pdf = await commands.printPdf(system, out.html);
    expect(pdf.pageCount).toBe(out.pageCount);
    expect(pdf.mediaBox.width).toBeCloseTo(out.paper.width * POINTS_PER_MM, 0);
    expect(pdf.mediaBox.height).toBeCloseTo(out.paper.height * POINTS_PER_MM, 0);
    expect(pdf.bytes).toBeGreaterThan(10_000);
  });
});
