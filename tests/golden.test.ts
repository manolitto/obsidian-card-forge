import { existsSync, readFileSync, unlinkSync } from "fs";
import { relative } from "path";
import { describe, expect, it } from "vitest";
import {
  FACES,
  FIXTURES_DIR,
  goldenPath,
  listFixtures,
  orphanGoldens,
  renderFixture,
  writeGoldens,
} from "./helpers/render-fixture";

const UPDATE = process.env["UPDATE_GOLDENS"] === "1";
const fixtures = listFixtures();

describe.each(fixtures.map((f) => [`${f.system}/${f.name}`, f] as const))(
  "fixture %s",
  (_label, fixture) => {
    it("renders byte-exact against its goldens", async () => {
      const faces = await renderFixture(fixture);
      if (UPDATE) writeGoldens(fixture, faces);
      for (const face of FACES) {
        const path = goldenPath(fixture, face);
        const html = faces[face];
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
