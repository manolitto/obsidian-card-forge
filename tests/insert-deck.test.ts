import { existsSync, readFileSync, writeFileSync } from "fs";
import { join, relative } from "path";
import { describe, expect, it } from "vitest";
import { parseDeckBlock, SELECTION_KEYS } from "../src/deck/block";
import { CARD_SETTING_KEYS } from "../src/definitions/card-settings";
import { DECK_SETTING_KEYS } from "../src/definitions/deck-settings";
import { collectDiagnostics } from "../src/definitions/diagnostics";
import { buildDeckBlock } from "../src/ui/insert-deck";
import { STRINGS } from "../src/ui/strings";
import { FIXTURES_DIR } from "./helpers/render-fixture";

/**
 * The deck block the insert command writes: a golden per language for
 * `simple` and for Dragonbane with two card types, and the rule that the
 * template documents every key the parser accepts and no other — a key
 * added to a setting list fails here until the template describes it.
 */

const UPDATE = process.env["UPDATE_GOLDENS"] === "1";

const cases = [
  ["simple", ["simple"]],
  ["dragonbane", ["gear", "creature"]],
] as const;

describe.each(cases)("buildDeckBlock for %s", (systemId, cardTypeIds) => {
  it.each(["en", "de"] as const)("matches the %s golden", (language) => {
    const block = buildDeckBlock(systemId, cardTypeIds, language);
    const path = join(FIXTURES_DIR, systemId, `_insert-deck-${language}.md`);
    if (UPDATE) writeFileSync(path, block);
    expect(
      existsSync(path),
      `${relative(FIXTURES_DIR, path)} is missing — run with UPDATE_GOLDENS=1 to write it`
    ).toBe(true);
    expect(block).toBe(readFileSync(path, "utf-8"));
  });
});

describe("the deck template", () => {
  const block = buildDeckBlock("dragonbane", ["gear", "creature"], "en");
  const keys = [...block.matchAll(/^(?:# )?([a-z-]+):/gm)].map((m) => m[1]!);

  it("names every key the parser accepts, and no other", () => {
    const accepted = [...SELECTION_KEYS, ...DECK_SETTING_KEYS, ...CARD_SETTING_KEYS];
    expect(keys.sort()).toEqual([...accepted].sort());
  });

  it("names each key once", () => {
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("describes every key in both languages", () => {
    for (const key of DECK_SETTING_KEYS)
      expect(STRINGS.de).toHaveProperty(`deck-key.${key}`);
    for (const key of SELECTION_KEYS) {
      if (key === "system" || key === "card-type") continue;
      expect(STRINGS.de).toHaveProperty(`deck-key.${key}`);
    }
  });

  it("parses as a deck block with nothing reported, the comments inert", () => {
    const diagnostics = collectDiagnostics();
    const deck = parseDeckBlock(block, "Decks/Gear.md", diagnostics);
    expect(diagnostics.messages).toEqual([]);
    expect(deck?.selection.systemId).toBe("dragonbane");
    expect(deck?.selection.cardTypeIds).toEqual(["gear", "creature"]);
    expect(deck?.settings.pageMargin).toBe(10);
  });

  it("writes a default the parser reads back, key by key", () => {
    for (const line of block.split("\n")) {
      const match = /^# ([a-z-]+): (.+)$/.exec(line);
      if (!match) continue;
      const diagnostics = collectDiagnostics();
      const deck = parseDeckBlock(
        `\`\`\`cardsmith-deck\nsystem: simple\n${match[1]}: ${match[2]}\n\`\`\``,
        "Deck.md",
        diagnostics
      );
      expect(diagnostics.messages, line).toEqual([]);
      expect(deck).toBeDefined();
    }
  });
});
