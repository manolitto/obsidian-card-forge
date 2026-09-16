import { existsSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { join, relative } from "path";
import type { BrowserCommand } from "vitest/node";

/**
 * The layout goldens' file side, run by vitest in node on behalf of the
 * browser project. A browser test has no file system, so it hands the
 * settled text of a fixture to `layoutGolden` and gets back what to compare
 * it with — the committed golden, or under `UPDATE_GOLDENS=1` the text it
 * just sent, written first. The whole switch is on this side, so a test
 * only ever compares two strings and `process.env` never reaches the page.
 *
 *   UPDATE_GOLDENS=1 npx vitest run --project browser tests/browser/layout-goldens.test.ts
 *
 * The goldens are `tests/fixtures/<system>/<name>.layout.txt` beside the
 * render goldens (`<name>.<n>.layout.txt` for a table note's rows), and a
 * gitignored `_layout-preview.html` per system shows the settled faces.
 */

const UPDATE = process.env["UPDATE_GOLDENS"] === "1";
const FIXTURES_DIR = join(__dirname, "..", "fixtures");
const LAYOUT_GOLDEN = /\.layout\.txt$/;

/** The text a fixture's layout is compared against; `undefined` when no golden exists yet. */
export const layoutGolden: BrowserCommand<
  [system: string, name: string, actual: string]
> = (_ctx, system, name, actual): string | undefined => {
  const path = join(FIXTURES_DIR, system, `${name}.layout.txt`);
  if (UPDATE) {
    writeFileSync(path, actual);
    return actual;
  }
  return existsSync(path) ? readFileSync(path, "utf-8") : undefined;
};

/**
 * Every layout golden that no fixture produces, as `<system>/<file>`. Under
 * `UPDATE_GOLDENS=1` they are pruned instead — a golden without a fixture
 * asserts nothing — and the answer is empty.
 */
export const orphanLayoutGoldens: BrowserCommand<[keep: string[]]> = (
  _ctx,
  keep
): string[] => {
  const wanted = new Set(keep.map((k) => `${k}.layout.txt`));
  const out: string[] = [];
  for (const system of readdirSync(FIXTURES_DIR).sort()) {
    for (const file of readdirSync(join(FIXTURES_DIR, system)).sort()) {
      if (!LAYOUT_GOLDEN.test(file)) continue;
      const path = join(FIXTURES_DIR, system, file);
      if (wanted.has(relative(FIXTURES_DIR, path))) continue;
      if (UPDATE) unlinkSync(path);
      else out.push(relative(FIXTURES_DIR, path));
    }
  }
  return out;
};

/**
 * The text a fixture deck's composition is compared against —
 * `tests/fixtures/<system>/_deck.compose.txt`; the same switch as
 * `layoutGolden`. One per system, always produced, so no orphan check.
 */
export const deckGolden: BrowserCommand<[system: string, actual: string]> = (
  _ctx,
  system,
  actual
): string | undefined => {
  const path = join(FIXTURES_DIR, system, "_deck.compose.txt");
  if (UPDATE) {
    writeFileSync(path, actual);
    return actual;
  }
  return existsSync(path) ? readFileSync(path, "utf-8") : undefined;
};

/** The settled faces of a system's fixtures as a page to look at; written under `UPDATE_GOLDENS=1` only. */
export const writeLayoutPreview: BrowserCommand<[system: string, html: string]> = (
  _ctx,
  system,
  html
): void => {
  if (UPDATE) writeFileSync(join(FIXTURES_DIR, system, "_layout-preview.html"), html);
};
