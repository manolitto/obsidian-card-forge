import { afterAll, describe, expect, it } from "vitest";
import { commands } from "vitest/browser";
import { collectDiagnostics } from "../../src/definitions/diagnostics";
import { layoutCard } from "../../src/layout/engine";
import { loadedSystem, previewSheet } from "../helpers/render";
import { listFixtures, renderFixture } from "./helpers/fixtures";
import { layoutGoldenText } from "./helpers/layout-golden";

/**
 * The layout goldens. Every fixture note of every bundled system is
 * rendered and laid out through the real engine, and the settled face
 * sequence — as text, see `layoutGoldenText` — is compared against
 * `<name>.layout.txt` beside the note. A change to a stylesheet, a
 * template, the splitter or the scaler that moves a block onto another
 * face, changes a marker or shifts the committed scale shows up here as a
 * diff a reviewer can read.
 *
 *   UPDATE_GOLDENS=1 npx vitest run --project browser tests/browser/layout-goldens.test.ts
 *
 * writes the goldens, prunes any whose fixture is gone, and writes a
 * gitignored `_layout-preview.html` per system — every settled face at
 * card size. Without the flag an orphan is a failure, and so is a missing
 * golden.
 */

declare module "vitest/browser" {
  interface BrowserCommands {
    layoutGolden(
      system: string,
      name: string,
      actual: string
    ): Promise<string | undefined>;
    orphanLayoutGoldens(keep: string[]): Promise<string[]>;
    writeLayoutPreview(system: string, html: string): Promise<void>;
  }
}

const fixtures = listFixtures();
const produced: string[] = [];
const settled = new Map<string, { caption: string; html: string }[]>();

describe.each(fixtures.map((f) => [`${f.system}/${f.name}`, f] as const))(
  "fixture %s",
  (_label, fixture) => {
    it("lays out as its layout golden says", async () => {
      const system = await loadedSystem(fixture.system);
      const cards = await renderFixture(fixture);
      for (const [index, rendered] of cards.entries()) {
        const diagnostics = collectDiagnostics();
        const out = await layoutCard(rendered, system, document, diagnostics);
        expect(diagnostics.messages).toEqual([]);

        const name = cards.length === 1 ? fixture.name : `${fixture.name}.${index + 1}`;
        produced.push(`${fixture.system}/${name}`);
        const actual = layoutGoldenText(name, out);
        const golden = await commands.layoutGolden(fixture.system, name, actual);
        expect(
          golden,
          `${fixture.system}/${name}.layout.txt is missing — run with UPDATE_GOLDENS=1 to write it`
        ).toBeDefined();
        expect(actual).toBe(golden);

        const faces = settled.get(fixture.system) ?? [];
        out.cards.forEach((pair, i) => {
          if (pair.front)
            faces.push({ caption: `${name} · ${i + 1} — front`, html: pair.front });
          if (pair.back)
            faces.push({ caption: `${name} · ${i + 1} — back`, html: pair.back });
        });
        settled.set(fixture.system, faces);
      }
    });
  }
);

it("has a fixture note for every layout golden", async () => {
  // Under UPDATE_GOLDENS=1 the command prunes them and answers with none.
  expect(await commands.orphanLayoutGoldens(produced)).toEqual([]);
});

afterAll(async () => {
  for (const [systemId, faces] of settled) {
    const system = await loadedSystem(systemId);
    const styles = new Set<string>();
    for (const cardTypeId of Object.keys(system.cardTypes)) {
      styles.add(await system.stylesheet(cardTypeId));
    }
    await commands.writeLayoutPreview(
      systemId,
      previewSheet(`${systemId} fixtures, laid out`, styles, faces)
    );
  }
});
