import { afterEach, describe, expect, it } from "vitest";
import { collectDiagnostics } from "../../src/definitions/diagnostics";
import { layoutCard, type LaidOutCard } from "../../src/layout/engine";
import type { RenderedCard } from "../../src/render/renderer";
import type { LoadedSystem } from "../../src/systems/loader";
import {
  mountPreview,
  previewFaces,
  type PreviewMount,
} from "../../src/ui/preview-mount";
import { loadedSystem } from "../helpers/render";
import { listFixtures, renderFixture } from "./helpers/fixtures";

/**
 * The preview mount: settled faces in a shadow root at a display height,
 * their geometry as the reader sees it, their fonts loaded once.
 */

const PX_PER_MM = 96 / 25.4;

const fixture = (system: string, name: string) => {
  const found = listFixtures().find((f) => f.system === system && f.name === name);
  if (!found) throw new Error(`no fixture ${system}/${name}`);
  return found;
};

async function laidOut(
  system: string,
  name: string
): Promise<{ system: LoadedSystem; cards: RenderedCard[]; first: LaidOutCard }> {
  const loaded = await loadedSystem(system);
  const cards = await renderFixture(fixture(system, name));
  const diagnostics = collectDiagnostics();
  const first = await layoutCard(cards[0]!, loaded, document, diagnostics);
  expect(diagnostics.messages).toEqual([]);
  return { system: loaded, cards, first };
}

let host: HTMLElement | undefined;
let mount: PreviewMount | undefined;
afterEach(() => {
  mount?.remove();
  host?.remove();
  mount = host = undefined;
});

function mountAt(
  system: LoadedSystem,
  card: RenderedCard,
  faces: string[],
  height: number,
  stylesheet: string
): PreviewMount {
  host = document.createElement("div");
  document.body.append(host);
  mount = mountPreview(
    host,
    system.id,
    stylesheet,
    faces,
    card.settings.cardSize!,
    height
  );
  return mount;
}

describe("mountPreview", () => {
  it("shows a poker card at the display height, as wide as its ratio says", async () => {
    const { system, cards, first } = await laidOut("dragonbane", "Fischspeer");
    const faces = previewFaces(first);
    expect(faces).toHaveLength(2);
    const stylesheet = await system.stylesheet(cards[0]!.cardTypeId);
    const { root } = mountAt(system, cards[0]!, faces, 350, stylesheet);

    const boxes = root.querySelectorAll<HTMLElement>(".cs-preview-face");
    expect(boxes).toHaveLength(2);
    const box = boxes[0]!.getBoundingClientRect();
    expect(box.height).toBeCloseTo(350, 0);
    expect(box.width).toBeCloseTo((350 * 63) / 88, 0);

    // The face itself lays out at card size and is scaled into the box.
    const face = root.querySelector<HTMLElement>(".card-root")!;
    expect(face.offsetHeight).toBeCloseTo(88 * PX_PER_MM, 0);
    expect(face.getBoundingClientRect().height).toBeCloseTo(350, 0);
  });

  it("sets the title in the system's font, hoisted once for the document", async () => {
    const { system, cards, first } = await laidOut("dragonbane", "Fischspeer");
    const stylesheet = await system.stylesheet(cards[0]!.cardTypeId);
    mountAt(system, cards[0]!, previewFaces(first), 300, stylesheet).remove();
    const { root } = mountAt(system, cards[0]!, previewFaces(first), 300, stylesheet);

    const title = root.querySelector<HTMLElement>(".card-title")!;
    const family = getComputedStyle(title).fontFamily.split(",")[0]!.replace(/["']/g, "");
    expect(family).toBe("Colus");
    await document.fonts.ready;
    expect(document.fonts.check(`12px "${family}"`)).toBe(true);

    expect(root.querySelector("style")!.textContent).not.toContain("@font-face");
    expect(
      document.head.querySelectorAll('style[data-cs-fonts="dragonbane"]')
    ).toHaveLength(1);
  });

  it("mounts one of a table note's cards", async () => {
    const { system, cards, first } = await laidOut("dragonbane", "Fischfang");
    expect(cards.length).toBeGreaterThan(1);
    const stylesheet = await system.stylesheet(cards[0]!.cardTypeId);
    const { root } = mountAt(system, cards[0]!, previewFaces(first), 300, stylesheet);
    expect(root.querySelectorAll(".card-root.card-front")).toHaveLength(1);
  });
});

describe("previewFaces", () => {
  it("keeps the side the card asks for", async () => {
    const { first } = await laidOut("dragonbane", "Fischspeer");
    expect(previewFaces(first, "both")).toHaveLength(2);
    expect(previewFaces(first, "front")).toHaveLength(1);
    expect(previewFaces(first, "front")[0]).toMatch(/card-front/);
    expect(previewFaces(first, "back")).toHaveLength(1);
    expect(previewFaces(first, "back")[0]).toMatch(/card-back/);
  });

  it("lists every face of a card that spilled, in print order", () => {
    const card: LaidOutCard = {
      name: "x",
      cardTypeId: "t",
      settings: {},
      cards: [
        { front: "f1", back: "b1" },
        { front: "f2", back: "b2" },
      ],
      clipped: false,
    };
    expect(previewFaces(card)).toEqual(["f1", "b1", "f2", "b2"]);
    expect(previewFaces(card, "front")).toEqual(["f1", "f2"]);
  });
});
