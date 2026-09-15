/// <reference types="vite/client" />
import sourceSans from "../../../resources/systems/simple/fonts/source-sans-3-normal-latin.woff2?inline";
import { FACE_CLASS } from "../../../src/layout/overflow-splitter";
import { BASELINE } from "../../../src/systems/baseline";

/**
 * A face on the page, under the base stylesheet and whatever a test adds —
 * the smallest thing the layout engine can measure. `unmount` takes the
 * face and its styles down again so one test's card never lays out inside
 * another's.
 */
export interface MountedFace {
  root: HTMLElement;
  unmount(): void;
}

export function mountFace(html: string, css = ""): MountedFace {
  const style = document.createElement("style");
  style.textContent = `${BASELINE.stylesheet}\n${css}`;
  const host = document.createElement("div");
  host.innerHTML = html;
  document.head.append(style);
  document.body.append(host);
  const root = host.querySelector<HTMLElement>(".card-root");
  if (!root) throw new Error("mountFace: the HTML has no .card-root");
  return {
    root,
    unmount() {
      host.remove();
      style.remove();
    },
  };
}

/**
 * The host the overflow splitter works in: one `.cf-face` wrapper per face,
 * in print order, inside one container the splitter appends to. Same
 * stylesheet handling as `mountFace`.
 */
export interface MountedHost {
  container: HTMLElement;
  unmount(): void;
}

export function mountHost(faces: string[], css = ""): MountedHost {
  const style = document.createElement("style");
  style.textContent = `${BASELINE.stylesheet}\n${css}`;
  const container = document.createElement("div");
  container.innerHTML = faces
    .map((face) => `<div class="${FACE_CLASS}">${face}</div>`)
    .join("");
  document.head.append(style);
  document.body.append(container);
  return {
    container,
    unmount() {
      container.remove();
      style.remove();
    },
  };
}

/**
 * A poker-size face with the three-part column the base stylesheet lays
 * out: a title in the header, a scalable body, a footer. The card's own type
 * — sizes, floors — is the caller's `css`.
 */
export function faceHtml(opts: {
  title?: string;
  body: string;
  footer?: string;
}): string {
  return `<div class="card-root card-front" style="--card-width: 63mm; --card-height: 88mm;">
  <div class="card-header">
    <div class="card-title"><span class="text-scalable">${opts.title ?? "Title"}</span></div>
  </div>
  <div class="card-content-container">
    <div class="card-body-scalable">${opts.body}</div>
  </div>
  <div class="card-footer">${opts.footer ?? "Footer"}</div>
</div>`;
}

/** A designed back the size of `faceHtml`'s front: a body holding one logo line. */
export function backHtml(): string {
  return `<div class="card-root card-back" style="--card-width: 63mm; --card-height: 88mm;">
  <div class="card-body-scalable"><p class="logo">Logo</p></div>
</div>`;
}

/** `n` short paragraphs of filler, enough alike that their height scales with `n`. */
export function paragraphs(n: number): string {
  const text =
    "The lantern sheds a steady light across the chamber, and what was hidden steps forward.";
  return Array.from({ length: n }, () => `<p>${text}</p>`).join("");
}

/**
 * A type face for the tests that count lines and paragraphs, inlined so
 * every machine measures the same glyphs; a system font would make a
 * paragraph count on one machine a different count on the next. `fontReady`
 * installs it on the page once and resolves when it has decoded; a test
 * awaits it before measuring anything set in `TEST_FONT_FAMILY`.
 */
export const TEST_FONT_FAMILY = "Test Sans";

export async function fontReady(): Promise<void> {
  if (!document.getElementById("test-font")) {
    const style = document.createElement("style");
    style.id = "test-font";
    style.textContent = `@font-face { font-family: "${TEST_FONT_FAMILY}"; src: url("${sourceSans}") format("woff2"); }`;
    document.head.append(style);
  }
  await document.fonts.load(`12px "${TEST_FONT_FAMILY}"`);
}
