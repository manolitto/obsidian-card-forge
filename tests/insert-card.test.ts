import { existsSync, readFileSync, writeFileSync } from "fs";
import { join, relative } from "path";
import { describe, expect, it } from "vitest";
import { collectDiagnostics } from "../src/definitions/diagnostics";
import { BUNDLED_SYSTEMS } from "../src/generated/bundled-systems";
import { parseNote } from "../src/render/note";
import { resolveCards } from "../src/render/card";
import type { LoadedCardType, LoadedSystem } from "../src/systems/loader";
import { buildCardBlock, type InsertMode } from "../src/ui/insert-card";
import { FIXTURES_DIR } from "./helpers/render-fixture";
import { loadedSystem } from "./helpers/render";

/**
 * The block the insert commands write, held as a golden per card type and
 * mode beside the fixtures: `tests/fixtures/<system>/_insert-<type>-<mode>.md`.
 * A changed description or sample fails exactly the card types that carry
 * it. `UPDATE_GOLDENS=1` rewrites them.
 */

const UPDATE = process.env["UPDATE_GOLDENS"] === "1";

/** The sample table the builder writes for the card type, in `en` or the system's first language. */
function sampleTableOf(system: LoadedSystem, cardType: LoadedCardType) {
  const tables = cardType.declaration.sampleTable;
  return tables?.["en"] ?? tables?.[system.declaration.languages[0] ?? ""];
}
const MODES: InsertMode[] = ["empty", "sample"];

const cases = BUNDLED_SYSTEMS.flatMap((system) =>
  MODES.map((mode) => [system.id, mode] as const)
);

describe.each(cases)("buildCardBlock for %s, %s", (systemId, mode) => {
  it("matches the golden of every card type", async () => {
    const system = await loadedSystem(systemId);
    for (const cardType of Object.values(system.cardTypes)) {
      const block = buildCardBlock(system, cardType, "en", mode);
      const path = join(
        FIXTURES_DIR,
        systemId,
        `_insert-${cardType.declaration.id}-${mode}.md`
      );
      if (UPDATE) writeFileSync(path, block);
      expect(
        existsSync(path),
        `${relative(FIXTURES_DIR, path)} is missing — run with UPDATE_GOLDENS=1 to write it`
      ).toBe(true);
      expect(block, relative(FIXTURES_DIR, path)).toBe(readFileSync(path, "utf-8"));
    }
  });
});

describe("the sample block", () => {
  it("is a card note the renderer resolves, for every bundled card type", async () => {
    for (const bundled of BUNDLED_SYSTEMS) {
      const system: LoadedSystem = await loadedSystem(bundled.id);
      for (const cardType of Object.values(system.cardTypes)) {
        const diagnostics = collectDiagnostics();
        const note = parseNote(
          buildCardBlock(system, cardType, "en", "sample"),
          `${bundled.id}/${cardType.declaration.id}.md`,
          diagnostics
        );
        expect(note, cardType.declaration.id).toBeDefined();
        const cards = resolveCards(note!, system, diagnostics);
        // A card type with a sample table is at least one card per row — more
        // when a row's roll range expands; any other card type is one.
        const rows = sampleTableOf(system, cardType)?.rows.length ?? 1;
        expect(cards.length, cardType.declaration.id).toBeGreaterThanOrEqual(rows);
        if (rows === 1) expect(cards, cardType.declaration.id).toHaveLength(1);
        for (const card of cards) expect(card.cardTypeId).toBe(cardType.declaration.id);
        expect(diagnostics.messages, cardType.declaration.id).toEqual([]);
      }
    }
  });

  it("writes only the properties bound to a place on the card, canonical names only", async () => {
    const system = await loadedSystem("simple");
    const cardType = system.cardTypes["simple"]!;
    const block = buildCardBlock(system, cardType, "en", "empty");
    expect(block).toContain("  name:\n");
    expect(block).toContain("  content:\n");
    expect(block).not.toContain("  body:");
    expect(block).not.toContain("  image:");
    expect(block).not.toContain("  titel:");
  });

  it("falls back to the language the system documents in", async () => {
    const system = await loadedSystem("eiserne-zeit");
    const cardType = Object.values(system.cardTypes)[0]!;
    const de = buildCardBlock(system, cardType, "de", "sample");
    const fr = buildCardBlock(system, cardType, "fr", "sample");
    expect(fr).toBe(de);
  });
});

describe("a sample table", () => {
  it("is written as a table note: the table, the columns under table:, the rest under data:", async () => {
    const system = await loadedSystem("dragonbane");
    const block = buildCardBlock(system, system.cardTypes["roll-table"]!, "de", "sample");
    const lines = block.split("\n");
    expect(lines[0]).toMatch(
      /^\| Würfelwurf +\| Wurf-Min \| Wurf-Max \| Name +\| Voraussetzungen \| Rationen \| Beschreibung +\|$/
    );
    expect(lines[1]).toMatch(/^\| -+ \| -+ \| -+ \| -+ \| -+ \| -+ \| -+ \|$/);
    expect(lines[2]).toMatch(/^\| 1 +\| 1 +\| 1 +\| Nebelbarsch/);
    expect(block).toContain("table:\n");
    expect(block).toContain("  roll: Würfelwurf\n");
    expect(block).toContain("  stats:\n    - Voraussetzungen\n    - Rationen\n");
    // A column property is not repeated under data:.
    expect(block.slice(block.indexOf("data:"))).not.toMatch(
      /^ {2}(name|roll|stats|description):/m
    );
    expect(block.slice(block.indexOf("data:"))).toMatch(/^ {2}category:/m);
  });

  it("is a headed, empty table in the empty mode", async () => {
    const system = await loadedSystem("dino-island");
    const block = buildCardBlock(system, system.cardTypes["roll-table"]!, "de", "empty");
    const lines = block.split("\n");
    expect(lines[0]).toMatch(/^\| Wurf \| Gerücht \|$/);
    expect(lines[2]).toMatch(/^\| +\| +\|$/);
    expect(block).toContain("table:\n");
    expect(block).toMatch(/^ {2}heading:$/m);
  });

  it("reports a column that is not a property of the card type", async () => {
    const { loadSystem } = await import("../src/systems/loader");
    const { MemorySource, completeSystem } = await import("./helpers/systems");
    const files = completeSystem();
    files["game-system.yaml"] = files["game-system.yaml"]!.toString().replace(
      "card-types:\n  gear:\n",
      "card-types:\n  gear:\n    sample-table:\n      en:\n        columns: { nosuch: Header }\n        rows: [{ Header: x }]\n"
    );
    const diagnostics = collectDiagnostics();
    await loadSystem(new MemorySource(files), "demo", diagnostics);
    expect(
      diagnostics.matching(
        'demo: card-types.gear.sample-table.en names the column "nosuch", which is not a property of the card type'
      )
    ).toHaveLength(1);
  });
});
