import { existsSync, readFileSync, writeFileSync } from "fs";
import { join, relative } from "path";
import { describe, expect, it } from "vitest";
import { collectDiagnostics } from "../src/definitions/diagnostics";
import { BUNDLED_SYSTEMS } from "../src/generated/bundled-systems";
import { parseNote } from "../src/render/note";
import { resolveCards } from "../src/render/card";
import type { LoadedSystem } from "../src/systems/loader";
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
        expect(cards, cardType.declaration.id).toHaveLength(1);
        expect(cards[0]!.cardTypeId).toBe(cardType.declaration.id);
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
