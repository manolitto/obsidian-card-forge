import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";
import { describe, expect, it } from "vitest";

/**
 * The documentation's examples are pieces of the tree, not prose about it.
 * A fenced block whose info string carries `from=<path>` claims to be a
 * verbatim excerpt of that file, and this test holds it to that: the block's
 * text must occur in the file, byte for byte. An example that drifts from
 * what it quotes fails the build instead of the reader.
 *
 *   ```yaml from=resources/systems/simple/simple.yaml
 *   …
 *   ```
 *
 * A fence of four backticks holds an example that is itself a fenced block.
 *
 * Every page under `docs/` and the README are read. A page is meant to stay
 * short — one topic, under 200 lines — and a page over the line is printed,
 * not failed: length is a smell, not a defect.
 */

const ROOT = join(__dirname, "..");
/** `from=` runs to the end of the info string, so a path may hold a space. */
const FENCE = /^(`{3,})[^\n]*\bfrom=([^\n]+?)\s*\n([\s\S]*?)\n\1$/gm;

function pages(): string[] {
  const out = ["README.md", "CONTRIBUTING.md"].filter((f) => existsSync(join(ROOT, f)));
  const walk = (dir: string) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (entry.endsWith(".md")) out.push(relative(ROOT, path));
    }
  };
  walk(join(ROOT, "docs"));
  return out;
}

interface Example {
  page: string;
  from: string;
  text: string;
}

function examples(page: string): Example[] {
  const text = readFileSync(join(ROOT, page), "utf-8");
  return [...text.matchAll(FENCE)].map((m) => ({ page, from: m[2]!, text: m[3]! }));
}

describe("the documentation", () => {
  const all = pages();

  it("has pages", () => {
    expect(all.length).toBeGreaterThan(0);
  });

  describe.each(all)("%s", (page) => {
    it("quotes the tree verbatim in every from= example", () => {
      for (const example of examples(page)) {
        const file = join(ROOT, example.from);
        expect(existsSync(file), `${page}: ${example.from} does not exist`).toBe(true);
        const source = readFileSync(file, "utf-8");
        expect(
          source.includes(example.text),
          `${page}: the example said to be from ${example.from} is not in it:\n${example.text}`
        ).toBe(true);
      }
    });

    it("speaks to a reader of the repository, not to its authors", () => {
      // What only makes sense with the development history in hand — an
      // absolute path from a developer's machine, a schedule, the plugin
      // this one grew out of — does not belong on a page a user reads.
      const text = readFileSync(join(ROOT, page), "utf-8");
      for (const pattern of [/\/Users\//, /\bphase \d/i, /card-forge/i, /predecessor/i]) {
        expect(pattern.test(text), `${page} matches ${pattern}`).toBe(false);
      }
    });

    it("stays on one topic", () => {
      const lines = readFileSync(join(ROOT, page), "utf-8").split("\n").length;
      if (lines > 200)
        console.warn(
          `${page} runs to ${lines} lines — over the 200 a page should keep to`
        );
    });
  });
});
