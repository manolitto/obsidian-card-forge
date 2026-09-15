import { existsSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { load } from "js-yaml";
import { join } from "path";
import { prepareCardProps } from "../../src/definitions/card-props";
import { collectDiagnostics } from "../../src/definitions/diagnostics";
import { BUNDLED_SYSTEMS } from "../../src/generated/bundled-systems";
import { BundledSystemSource } from "../../src/systems/bundled-source";
import { loadSystem, type LoadedSystem } from "../../src/systems/loader";
import { CARD_PRESETS, DEFAULT_CARD_PRESET } from "../../src/model/card-size";
import { TemplateEngine } from "../../src/templates/engine";

/**
 * The golden-render harness.
 *
 * A fixture is a note under `tests/fixtures/<system>/` — a markdown file with
 * a `card-forge` block, exactly what a user writes. Each renders through the
 * real loader and the real engine, and the HTML of every face the card type
 * declares is compared byte for byte against the committed golden beside it.
 * A change to a template, a stylesheet, or a binding then shows up as a diff
 * someone can read, rather than as a card that looks slightly off.
 *
 *   UPDATE_GOLDENS=1 npx vitest run tests/golden.test.ts
 *
 * regenerates the goldens and prunes any whose fixture is gone. Without the
 * flag, such an orphan is a failure.
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

export function goldenPath(fixture: Fixture, face: Face): string {
  return join(FIXTURES_DIR, fixture.system, `${fixture.name}.${face}.html`);
}

/** Every golden file that has no fixture note. */
export function orphanGoldens(): string[] {
  const fixtures = new Set(listFixtures().map((f) => `${f.system}/${f.name}`));
  const out: string[] = [];
  for (const system of readdirSync(FIXTURES_DIR).sort()) {
    for (const file of readdirSync(join(FIXTURES_DIR, system)).sort()) {
      const match = /^(.+)\.(front|back)\.html$/.exec(file);
      if (match && !fixtures.has(`${system}/${match[1]}`)) {
        out.push(join(FIXTURES_DIR, system, file));
      }
    }
  }
  return out;
}

/** Render every face the fixture's card type declares. */
export async function renderFixture(
  fixture: Fixture
): Promise<Partial<Record<Face, string>>> {
  const system = await loadedSystem(fixture.system);
  const note = readFileSync(fixture.path, "utf-8");
  const { card, data } = cardBlock(note, fixture.path);
  const cardTypeId = card["card-type"];
  const cardType = system.cardTypes[cardTypeId];
  if (!cardType)
    throw new Error(
      `${fixture.path}: ${fixture.system} has no card type "${cardTypeId}"`
    );

  const props = prepareCardProps(data, {
    aliases: cardType.aliases,
    defs: cardType.properties,
    fileName: fixture.name,
  });
  const language = card.language ?? system.declaration.languages[0] ?? "";

  const out: Partial<Record<Face, string>> = {};
  for (const face of FACES) {
    const declared =
      face === "front"
        ? cardType.declaration.frontTemplate
        : cardType.declaration.backTemplate;
    if (!declared) continue;
    const diagnostics = collectDiagnostics();
    out[face] = await engine.renderFace(
      {
        system,
        cardTypeId,
        face,
        props,
        language,
        cardSize: cardType.cardSettings.cardSize ?? CARD_PRESETS[DEFAULT_CARD_PRESET],
      },
      diagnostics
    );
    if (diagnostics.messages.length > 0) {
      throw new Error(
        `${fixture.path} (${face}):\n  ${diagnostics.messages.join("\n  ")}`
      );
    }
  }
  return out;
}

/** Write the goldens for one fixture. */
export function writeGoldens(
  fixture: Fixture,
  faces: Partial<Record<Face, string>>
): void {
  for (const face of FACES) {
    const path = goldenPath(fixture, face);
    const html = faces[face];
    if (html !== undefined) writeFileSync(path, html);
    else if (existsSync(path)) unlinkSync(path);
  }
}

// ── The pieces ──────────────────────────────────────────────────────

const engine = new TemplateEngine();
const systems = new Map<string, Promise<LoadedSystem>>();

/** A bundled system, loaded once per run with nothing to report. */
function loadedSystem(id: string): Promise<LoadedSystem> {
  let pending = systems.get(id);
  if (!pending) {
    pending = (async () => {
      const bundled = BUNDLED_SYSTEMS.find((s) => s.id === id);
      if (!bundled)
        throw new Error(`no bundled system "${id}" for the fixtures under ${id}/`);
      const diagnostics = collectDiagnostics();
      const system = await loadSystem(new BundledSystemSource(bundled), id, diagnostics);
      if (!system || diagnostics.messages.length > 0) {
        throw new Error(
          `${id} loads with problems:\n  ${diagnostics.messages.join("\n  ")}`
        );
      }
      return system;
    })();
    systems.set(id, pending);
  }
  return pending;
}

interface CardBlock {
  card: { "card-type": string; language?: string };
  data: Record<string, unknown>;
}

/**
 * The `card-forge` block of a note, read with a regex and a YAML parse. That is
 * all a fixture needs; the note's frontmatter and body are the renderer's to
 * read, and this harness grows those steps with it.
 */
function cardBlock(note: string, path: string): CardBlock {
  const match = /^```card-forge[ \t]*\n([\s\S]*?)\n```[ \t]*$/m.exec(note);
  if (!match) throw new Error(`${path}: no card-forge block`);
  const doc = load(match[1] as string) as Partial<CardBlock> | undefined;
  const cardType = doc?.card?.["card-type"];
  if (typeof cardType !== "string")
    throw new Error(`${path}: the block names no card-type`);
  return {
    card: { "card-type": cardType, language: doc?.card?.language },
    data: doc?.data ?? {},
  };
}
