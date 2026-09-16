import { describe, expect, it } from "vitest";
import { collectDiagnostics } from "../src/definitions/diagnostics";
import type { ImageSource } from "../src/render/images";
import { parseNote } from "../src/render/note";
import { CardRenderer } from "../src/render/renderer";
import { TemplateEngine } from "../src/templates/engine";
import { loadedSystem } from "./helpers/render";

const noImages: ImageSource = { resolve: () => Promise.resolve(undefined) };

describe("the renderer", () => {
  it("hands the deck's layer to the chain and the roll bound on to the deck", async () => {
    const diagnostics = collectDiagnostics();
    const note = parseNote(
      [
        "```card-forge",
        "card:",
        "  system: dragonbane",
        "  card-type: roll-table",
        "data:",
        "  name: Nebelbarsch",
        "  würfelwurf: 1–2",
        "  wurf-min: 1",
        "  wurf-max: 2",
        "```",
      ].join("\n"),
      "Tabellen/Fang.md",
      diagnostics
    );
    if (!note) throw new Error("not a card note");

    const renderer = new CardRenderer(new TemplateEngine(), noImages);
    const cards = await renderer.render(
      note,
      await loadedSystem("dragonbane"),
      diagnostics,
      { language: "en", cardSize: { width: 44, height: 63 } }
    );

    expect(diagnostics.messages).toEqual([]);
    expect(cards.map((c) => [c.name, c.rollMin, c.settings.language])).toEqual([
      ["Fang", 1, "en"],
      ["Fang", 2, "en"],
    ]);
    expect(cards[0]?.faces.front).toContain('lang="en"');
    expect(cards.every((c) => c.faces.front && c.faces.back)).toBe(true);
  });
});
