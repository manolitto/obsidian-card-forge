import { existsSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { basename, join } from "path";
import type { ImageSource } from "../../src/render/images";
import type { RenderedCard } from "../../src/render/renderer";
import { dataUri } from "../../src/systems/assets";
import { escapeHtml } from "../../src/templates/inline-markdown";
import { loadedSystem, renderNote } from "./render";

/**
 * The golden-render harness.
 *
 * A fixture is a note under `tests/fixtures/<system>/` — a markdown file with
 * a `card-forge` block, exactly what a user writes. Each renders through the
 * real note parser, the real loader and the real renderer, and the HTML of
 * every face of every card it yields is compared byte for byte against the
 * committed golden beside it. A change to a template, a stylesheet, a
 * binding or the parser then shows up as a diff someone can read, rather
 * than as a card that looks slightly off.
 *
 * A note is one card and its goldens are `<name>.front.html` and
 * `<name>.back.html`; a table note is several, numbered from 1:
 * `<name>.1.front.html`. Pictures resolve against the fixture folder by
 * basename, so a fixture that embeds `![[Beil.png]]` keeps `Beil.png` beside
 * it.
 *
 *   UPDATE_GOLDENS=1 npx vitest run tests/golden.test.ts
 *
 * regenerates the goldens, prunes any whose fixture is gone, and writes a
 * gitignored `_preview.html` per system — every face at card size under the
 * system's stylesheet — for looking at in a browser. Without the flag, an
 * orphan golden is a failure.
 */

export const FIXTURES_DIR = join(__dirname, "..", "fixtures");
export const FACES = ["front", "back"] as const;
export type Face = (typeof FACES)[number];

export interface Fixture {
  system: string;
  /** The note's basename without `.md` — which is also the name a card falls back to. */
  name: string;
  path: string;
}

/** Every fixture note, in path order. */
export function listFixtures(): Fixture[] {
  const out: Fixture[] = [];
  for (const system of readdirSync(FIXTURES_DIR).sort()) {
    const dir = join(FIXTURES_DIR, system);
    for (const file of readdirSync(dir).sort()) {
      if (!file.endsWith(".md")) continue;
      out.push({ system, name: file.slice(0, -3), path: join(dir, file) });
    }
  }
  return out;
}

/** `<name>.<face>.html` for a one-card note, `<name>.<n>.<face>.html` for a table's rows. */
export function goldenPath(fixture: Fixture, face: Face, index?: number): string {
  const number = index === undefined ? "" : `.${index + 1}`;
  return join(FIXTURES_DIR, fixture.system, `${fixture.name}${number}.${face}.html`);
}

const GOLDEN_FILE = /^(.+?)(?:\.(\d+))?\.(front|back)\.html$/;

/** Every golden file that no fixture note produces. */
export function orphanGoldens(): string[] {
  const fixtures = new Set(listFixtures().map((f) => `${f.system}/${f.name}`));
  const out: string[] = [];
  for (const system of readdirSync(FIXTURES_DIR).sort()) {
    for (const file of readdirSync(join(FIXTURES_DIR, system)).sort()) {
      const match = GOLDEN_FILE.exec(file);
      if (match && !fixtures.has(`${system}/${match[1]}`)) {
        out.push(join(FIXTURES_DIR, system, file));
      }
    }
  }
  return out;
}

/** The cards a fixture note yields, each with every face its card type declares. */
export function renderFixture(fixture: Fixture): Promise<RenderedCard[]> {
  const text = readFileSync(fixture.path, "utf-8");
  return renderNote(text, fixture.path, fixture.system, fixtureImages);
}

/** The goldens a fixture's cards are compared against, in the order the cards come. */
export function goldenPaths(
  fixture: Fixture,
  cards: RenderedCard[]
): { path: string; html?: string }[] {
  const single = cards.length === 1;
  return cards.flatMap((card, index) =>
    FACES.map((face) => ({
      path: goldenPath(fixture, face, single ? undefined : index),
      html: card.faces[face],
    }))
  );
}

/** Write the goldens for one fixture, removing any for a face the card type does not declare. */
export function writeGoldens(fixture: Fixture, cards: RenderedCard[]): void {
  for (const { path, html } of goldenPaths(fixture, cards)) {
    if (html !== undefined) writeFileSync(path, html);
    else if (existsSync(path)) unlinkSync(path);
  }
}

// ── The preview sheet ────────────────────────────────────────────

/**
 * Every face of every card of a system's fixtures, at card size, under the
 * stylesheet each card renders with. Written beside the goldens, gitignored:
 * a face can be looked at before there is a UI to show it in.
 */
export async function writePreview(
  systemId: string,
  rendered: { fixture: Fixture; cards: RenderedCard[] }[]
): Promise<void> {
  const system = await loadedSystem(systemId);
  const styles = new Map<string, string>();
  const faces: string[] = [];
  for (const { fixture, cards } of rendered) {
    for (const [index, card] of cards.entries()) {
      if (!styles.has(card.cardTypeId)) {
        styles.set(card.cardTypeId, await system.stylesheet(card.cardTypeId));
      }
      const label = cards.length === 1 ? fixture.name : `${fixture.name} · ${index + 1}`;
      for (const face of FACES) {
        const html = card.faces[face];
        if (html === undefined) continue;
        faces.push(
          `<figure><figcaption>${escapeHtml(label)} — ${face}</figcaption>${html}</figure>`
        );
      }
    }
  }
  const sheet = [
    "<!doctype html>",
    `<html><head><meta charset="utf-8"><title>${escapeHtml(systemId)} fixtures</title>`,
    "<style>",
    "body { margin: 2rem; background: #888; font: 12px system-ui, sans-serif; color: #fff; }",
    "main { display: flex; flex-wrap: wrap; gap: 2rem; align-items: flex-start; }",
    "figure { margin: 0; }",
    "figcaption { margin-bottom: .4rem; }",
    ".card-root { background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,.4); }",
    "</style>",
    ...[...styles.values()].map((css) => `<style>\n${css}\n</style>`),
    "</head><body><main>",
    ...faces,
    "</main></body></html>",
  ].join("\n");
  writeFileSync(join(FIXTURES_DIR, systemId, "_preview.html"), sheet);
}

// ── The pieces ──────────────────────────────────────────────────────

/** Pictures come from the fixture folder, by the link's basename. */
const fixtureImages: ImageSource = {
  async resolve(link, fromNotePath) {
    const file = join(fromNotePath, "..", basename(link.replace(/#.*$/, "")));
    if (!existsSync(file)) return undefined;
    return dataUri(new Uint8Array(readFileSync(file)), file);
  },
};
