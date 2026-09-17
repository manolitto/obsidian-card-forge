import { describe, expect, it } from "vitest";
import { commands } from "vitest/browser";
import { buildDeck, type DeckProgress } from "../../src/deck/pipeline";
import type { DeckSource } from "../../src/deck/source";
import { collectDiagnostics } from "../../src/definitions/diagnostics";
import { composeDeck, compositionText } from "../../src/export/compose";
import { parseNote } from "../../src/render/note";
import { loadedSystem } from "../helpers/render";
import { deckNote, fixtureDeckSource, fixtureRenderer } from "./helpers/fixtures";

declare module "vitest/browser" {
  interface BrowserCommands {
    deckGolden(system: string, actual: string): Promise<string | undefined>;
  }
}

/**
 * The deck pipeline over each bundled system's fixture folder: the `_deck.md`
 * beside the fixtures is the deck note, every other note is a candidate, and
 * what comes out is the physical cards in print order. Run in the browser
 * because every card is laid out on the way.
 */

const systems = { get: (id: string) => loadedSystem(id) };

async function build(system: string, text?: string, progress?: DeckProgress) {
  const deck = await deckNote(system);
  const diagnostics = collectDiagnostics();
  const built = await buildDeck(
    text ?? deck.text,
    deck.path,
    fixtureDeckSource,
    systems,
    fixtureRenderer(),
    document,
    diagnostics,
    progress
  );
  return { built, diagnostics };
}

const names = (cards: { name: string }[]): string[] => cards.map((c) => c.name);

describe("buildDeck over the fixture folders", () => {
  it("simple: every note, one card each, in name order, clean", async () => {
    const { built, diagnostics } = await build("simple");
    expect(diagnostics.messages).toEqual([]);
    expect(names(built.cards)).toEqual([
      "lantern-of-revealing",
      "laterne-der-enthuellung",
      "linked-reference",
      "no-card-type-label",
      "no-card-type-named",
      "Rope of Climbing",
    ]);
    expect(built.cardSize).toEqual({ width: 63, height: 88 });
    expect(built.stylesheets).toHaveLength(1);
    expect(built.settings.paperSize).toEqual({
      width: 210,
      height: 297,
      orientation: "auto",
    });
    expect(built.outputPath).toEqual({
      pdf: "../../fixtures/simple/_deck.pdf",
      html: "../../fixtures/simple/_deck.html",
    });
    expect(built.cards.every((c) => c.front && c.back)).toBe(true);
  });

  it("dragonbane: grouped as card-type: lists them, every card on the deck's poker", async () => {
    const { built, diagnostics } = await build("dragonbane");
    expect(diagnostics.messages).toEqual([]);
    expect(built.cards.map((c) => `${c.cardTypeId}/${c.name}`)).toEqual([
      "generic/Deckblatt",
      "generic/Hausregel",
      "gear/Fischspeer",
      "creature/Knochensammler",
      "creature/Knochensammler",
      "creature/Moorschleicher",
      "rule/Glutfunken",
      "rule/language-in-block",
      "roll-table/Fischfang",
      "roll-table/Fischfang",
      "roll-table/Fischfang",
    ]);
    expect(built.cardSize).toEqual({ width: 63, height: 88 });
    expect(built.stylesheets).toHaveLength(5);
  });

  it("eiserne-zeit: the German cards only, plain paper, no cut marks", async () => {
    const { built, diagnostics } = await build("eiserne-zeit");
    expect(diagnostics.messages).toEqual([]);
    expect(names(built.cards)).not.toContain("hawk-hood");
    expect(names(built.cards)).toContain("Beizjagd");
    expect(built.settings.paperBackground).toBe("plain");
    expect(built.settings.cutMarks?.enabled).toBe(false);
    expect(built.settings.cutMarks?.length).toBe(3); // the baseline's geometry, kept
  });

  it("reports progress once per note rendered and once per card laid out", async () => {
    const calls: [string, number, number][] = [];
    const { built } = await build("simple", undefined, (phase, done, total) =>
      calls.push([phase, done, total])
    );
    const render = calls.filter(([phase]) => phase === "render");
    const layout = calls.filter(([phase]) => phase === "layout");
    expect(render.map(([, done]) => done)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(render.every(([, , total]) => total === 6)).toBe(true);
    expect(layout.map(([, done]) => done)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(built.cards).toHaveLength(6);
  });

  it("applies a card-copies override and warns about one that names nothing", async () => {
    const { built, diagnostics } = await build(
      "simple",
      "```card-forge-deck\nsystem: simple\ncard-copies:\n  - { name: linked-reference, copies: 3 }\n  - { name: Nobody, copies: 2 }\n```"
    );
    expect(names(built.cards).filter((n) => n === "linked-reference")).toHaveLength(3);
    expect(built.cards).toHaveLength(8);
    expect(diagnostics.matching('card-copies: "Nobody" names no card')).toHaveLength(1);
  });

  it("fails a deck of two card sizes, naming both types and both sizes and the fix", async () => {
    const deck = await deckNote("dragonbane");
    await expect(
      buildDeck(
        "```card-forge-deck\nsystem: dragonbane\n```",
        deck.path,
        fixtureDeckSource,
        systems,
        fixtureRenderer(),
        document,
        collectDiagnostics()
      )
    ).rejects.toThrow(
      "two sizes — gear at 63 × 88 mm, creature at 88.9 × 127 mm. Set card-size: on the deck block"
    );
  });

  it("fails a note without a deck block, and a deck that matches no card", async () => {
    const deck = await deckNote("simple");
    const run = (text: string) =>
      buildDeck(
        text,
        deck.path,
        fixtureDeckSource,
        systems,
        fixtureRenderer(),
        document,
        collectDiagnostics()
      );
    await expect(run("# Not a deck")).rejects.toThrow("no card-forge-deck block");
    await expect(
      run("```card-forge-deck\nsystem: simple\ninclude-tags-all: nothing-has-this\n```")
    ).rejects.toThrow("no cards");
  });

  it("takes its notes from the source it is given", async () => {
    // Two notes of one size are a deck; the source decides what is under a folder.
    const memory: DeckSource = {
      listNotes: (_folder, _recursive, diagnostics) =>
        Promise.resolve(
          ["Zwerg", "Elf"].map((name) => ({
            note: parseNote(
              `\`\`\`card-forge\ncard:\n  system: simple\ndata:\n  name: ${name}\n\`\`\``,
              `Volk/${name}.md`,
              diagnostics
            )!,
            tags: [],
          }))
        ),
    };
    const built = await buildDeck(
      "```card-forge-deck\nsystem: simple\ncopies: 2\n```",
      "Volk/Deck.md",
      memory,
      systems,
      fixtureRenderer(),
      document,
      collectDiagnostics()
    );
    expect(names(built.cards)).toEqual(["Elf", "Elf", "Zwerg", "Zwerg"]);
    expect(built.outputPath.pdf).toBe("Volk/Deck.pdf");
  });
});

/**
 * The composition goldens: each fixture deck onto pages, as text —
 * `tests/fixtures/<system>/_deck.compose.txt`. Page count, then per page
 * each cell's side, place and name, so a card that moved reads as one
 * line. `UPDATE_GOLDENS=1` rewrites them.
 */
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
])("the %s deck composes", (system) => {
  it("as its composition golden says", async () => {
    const { built } = await build(system);
    const { pages, grid } = composeDeck(built);
    const actual = compositionText(pages, grid);
    const golden = await commands.deckGolden(system, actual);
    expect(
      golden,
      `${system}/_deck.compose.txt is missing — run with UPDATE_GOLDENS=1 to write it`
    ).toBeDefined();
    expect(actual).toBe(golden);
  });
});
