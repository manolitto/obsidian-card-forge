/// <reference types="vite/client" />
import type { ImageSource } from "../../../src/render/images";
import type { RenderedCard } from "../../../src/render/renderer";
import { renderNote } from "../../helpers/render";

/**
 * The fixture notes under `tests/fixtures/`, as the browser sees them. There
 * is no file system on this side: vite hands every note over as text and
 * every picture beside one as a `data:` URI, both through `import.meta.glob`,
 * and the render itself is the same one the node harness runs.
 */

const notes = import.meta.glob("../../fixtures/*/*.md", {
  query: "?raw",
  import: "default",
}) as Record<string, () => Promise<string>>;

const images = import.meta.glob("../../fixtures/*/*.{png,jpg,jpeg,webp,gif,svg}", {
  query: "?inline",
  import: "default",
}) as Record<string, () => Promise<string>>;

export interface Fixture {
  system: string;
  /** The note's basename without `.md` — which is also the name a card falls back to. */
  name: string;
  /** The note's path as vite keys it, relative to this file. */
  path: string;
}

/** Every fixture note, in path order. */
export function listFixtures(): Fixture[] {
  return Object.keys(notes)
    .sort()
    .map((path) => {
      const [system = "", file = ""] = path.split("/").slice(-2);
      return { system, name: file.slice(0, -3), path };
    });
}

/** The cards a fixture note yields, each with every face its card type declares. */
export async function renderFixture(fixture: Fixture): Promise<RenderedCard[]> {
  const load = notes[fixture.path];
  if (!load) throw new Error(`${fixture.path}: not a fixture`);
  return renderNote(await load(), fixture.path, fixture.system, fixtureImages);
}

/** Pictures come from the fixture folder, by the link's basename. */
const fixtureImages: ImageSource = {
  async resolve(link, fromNotePath) {
    const folder = fromNotePath.slice(0, fromNotePath.lastIndexOf("/"));
    const file = link.replace(/#.*$/, "").split("/").pop() ?? "";
    return images[`${folder}/${file}`]?.();
  },
};
