import { collectDiagnostics } from "../../src/definitions/diagnostics";
import { BUNDLED_SYSTEMS } from "../../src/generated/bundled-systems";
import { noteSystemId } from "../../src/render/card";
import type { ImageSource } from "../../src/render/images";
import { parseNote } from "../../src/render/note";
import { CardRenderer, type RenderedCard } from "../../src/render/renderer";
import { BundledSystemSource } from "../../src/systems/bundled-source";
import { loadSystem, type LoadedSystem } from "../../src/systems/loader";
import { TemplateEngine } from "../../src/templates/engine";
import { escapeHtml } from "../../src/templates/inline-markdown";

/**
 * Rendering a fixture note through the real pipeline — the note parser, the
 * loader, the renderer — with nothing allowed to go wrong on the way. Free
 * of any file system so the node harness and the browser suite share it:
 * one reads the note from disk, the other has vite hand it over as text.
 */

/**
 * The cards a note yields, each with every face its card type declares. The
 * note must name `system` — a fixture sits in the folder of the system it
 * renders with — and the render must be clean: a diagnostic or an empty
 * result is a broken fixture, not a case.
 */
export async function renderNote(
  text: string,
  path: string,
  system: string,
  images: ImageSource
): Promise<RenderedCard[]> {
  const diagnostics = collectDiagnostics();
  const note = parseNote(text, path, diagnostics);
  if (!note) throw new Error(`${path}: not a card note`);
  const systemId = noteSystemId(note, diagnostics);
  if (systemId !== system) {
    throw new Error(`${path}: names system "${systemId}" but sits under ${system}/`);
  }
  const renderer = new CardRenderer(new TemplateEngine(), images);
  const cards = await renderer.render(note, await loadedSystem(system), diagnostics);
  if (diagnostics.messages.length > 0 || cards.length === 0) {
    throw new Error(
      `${path}:\n  ${diagnostics.messages.join("\n  ") || "yields no card"}`
    );
  }
  return cards;
}

const systems = new Map<string, Promise<LoadedSystem>>();

/** A bundled system, loaded once per run with nothing to report. */
export function loadedSystem(id: string): Promise<LoadedSystem> {
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

// ── The preview sheet ────────────────────────────────────────────

/**
 * Faces at card size on a grey sheet, each captioned, under the stylesheets
 * they render with: the page a face can be looked at on before there is a
 * UI to show it in. Both goldens write one — the render goldens for the
 * faces as rendered, the layout goldens for the faces as settled.
 */
export function previewSheet(
  title: string,
  stylesheets: Iterable<string>,
  faces: { caption: string; html: string }[]
): string {
  return [
    "<!doctype html>",
    `<html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>`,
    "<style>",
    "body { margin: 2rem; background: #888; font: 12px system-ui, sans-serif; color: #fff; }",
    "main { display: flex; flex-wrap: wrap; gap: 2rem; align-items: flex-start; }",
    "figure { margin: 0; }",
    "figcaption { margin-bottom: .4rem; }",
    ".card-root { background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,.4); }",
    "</style>",
    ...[...stylesheets].map((css) => `<style>\n${css}\n</style>`),
    "</head><body><main>",
    ...faces.map(
      ({ caption, html }) =>
        `<figure><figcaption>${escapeHtml(caption)}</figcaption>${html}</figure>`
    ),
    "</main></body></html>",
  ].join("\n");
}
