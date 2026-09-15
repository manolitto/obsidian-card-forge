import { existsSync, readFileSync, unlinkSync } from "fs";
import { relative } from "path";
import { afterAll, describe, expect, it } from "vitest";
import type { RenderedCard } from "../src/render/renderer";
import {
  FIXTURES_DIR,
  goldenPaths,
  listFixtures,
  orphanGoldens,
  renderFixture,
  writeGoldens,
  writePreview,
  type Fixture,
} from "./helpers/render-fixture";

const UPDATE = process.env["UPDATE_GOLDENS"] === "1";
const fixtures = listFixtures();
const rendered = new Map<string, { fixture: Fixture; cards: RenderedCard[] }[]>();

describe.each(fixtures.map((f) => [`${f.system}/${f.name}`, f] as const))(
  "fixture %s",
  (_label, fixture) => {
    it("renders byte-exact against its goldens", async () => {
      const cards = await renderFixture(fixture);
      if (UPDATE) {
        writeGoldens(fixture, cards);
        const list = rendered.get(fixture.system) ?? [];
        list.push({ fixture, cards });
        rendered.set(fixture.system, list);
      }
      for (const { path, html } of goldenPaths(fixture, cards)) {
        if (html === undefined) {
          expect(
            existsSync(path),
            `${relative(FIXTURES_DIR, path)} exists for an undeclared face`
          ).toBe(false);
          continue;
        }
        expect(
          existsSync(path),
          `${relative(FIXTURES_DIR, path)} is missing — run with UPDATE_GOLDENS=1 to write it`
        ).toBe(true);
        expect(html).toBe(readFileSync(path, "utf-8"));
      }
    });
  }
);

it("has a fixture note for every golden", () => {
  const orphans = orphanGoldens();
  if (UPDATE) {
    for (const path of orphans) {
      // Pruned rather than kept: a golden without a fixture asserts nothing.
      unlinkSync(path);
    }
    return;
  }
  expect(orphans.map((p) => relative(FIXTURES_DIR, p))).toEqual([]);
});

it("has at least one fixture", () => {
  expect(fixtures.length).toBeGreaterThan(0);
});

afterAll(async () => {
  if (!UPDATE) return;
  for (const [system, list] of rendered) await writePreview(system, list);
});
