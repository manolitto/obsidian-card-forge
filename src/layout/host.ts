import { FACE_CLASS } from "./overflow-splitter";

/*
 * The measurement host: a card's faces on the page, hidden, under the
 * card's stylesheet, so the layout engine can read real boxes.
 *
 * The host is an off-screen `div` with a shadow root. The shadow root
 * keeps the card's stylesheet from touching the page and the page's from
 * touching the card; the `div` is `visibility: hidden` rather than
 * `display: none`, since a face that is not displayed has no layout to
 * measure. Inside, one `.cf-face` wrapper per face in print order, in a
 * container the overflow splitter appends further wrappers to.
 *
 * One thing the shadow root cannot do is load a font: an `@font-face` rule
 * inside a shadow tree never registers with the document, and the text lays
 * out in the fallback face. The host therefore lifts every `@font-face` out
 * of the stylesheet into one `<style>` per system in the document's head,
 * kept across cards — the rules carry the font files as data URIs, and a
 * deck would otherwise parse them once per card.
 *
 * DOM only. No Obsidian, no globals: the document is the caller's, so the
 * engine runs in the plugin window and in the browser test alike.
 */

export interface LayoutHost {
  /** What the splitter is handed: the shadow root the faces lay out in. */
  root: ShadowRoot;
  /** Every face's `.card-root` in print order, as HTML, wrappers dropped. */
  faces(): string[];
  /** Take the host off the page. */
  remove(): void;
}

/**
 * Put the faces on the page. `stylesheet` is the card's whole cascade —
 * baseline, system, card type — as `LoadedSystem.stylesheet` assembles it;
 * `systemId` keys the hoisted fonts.
 */
export function mountLayoutHost(
  doc: Document,
  systemId: string,
  stylesheet: string,
  faces: readonly string[]
): LayoutHost {
  const css = hoistFontFaces(doc, systemId, stylesheet);

  const host = doc.createElement("div");
  host.style.position = "absolute";
  host.style.left = "-99999px";
  host.style.top = "0";
  host.style.visibility = "hidden";
  host.setAttribute("aria-hidden", "true");
  doc.body.appendChild(host);

  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `<style>${css}</style><div>${faces
    .map((face) => `<div class="${FACE_CLASS}">${face}</div>`)
    .join("")}</div>`;

  return {
    root,
    faces() {
      const out: string[] = [];
      const wrappers = root.querySelectorAll(`.${FACE_CLASS}`);
      for (let i = 0; i < wrappers.length; i++) {
        const cardRoot = wrappers[i]!.querySelector(".card-root");
        if (cardRoot) out.push(cardRoot.outerHTML);
      }
      return out;
    },
    remove() {
      host.remove();
    },
  };
}

const FONT_FACE_RULE = /@font-face\s*\{[^}]*\}/g;
const FONTS_ATTR = "data-cf-fonts";

/**
 * Move a stylesheet's `@font-face` rules into the document's head, under
 * one `<style>` per system, and return the stylesheet without them. A rule
 * already there is not added twice, so a system's fonts are parsed once
 * however many cards and card types share them. Exported for the tests.
 */
export function hoistFontFaces(doc: Document, systemId: string, css: string): string {
  const { fonts, rest } = splitFontFaces(css);
  if (fonts.length === 0) return css;

  let style = doc.head.querySelector<HTMLStyleElement>(
    `style[${FONTS_ATTR}="${systemId}"]`
  );
  if (!style) {
    style = doc.createElement("style");
    style.setAttribute(FONTS_ATTR, systemId);
    doc.head.appendChild(style);
  }
  const held = style.textContent ?? "";
  const missing = fonts.filter((rule) => !held.includes(rule));
  if (missing.length > 0)
    style.textContent = [held, ...missing].filter(Boolean).join("\n");

  return rest;
}

/**
 * A stylesheet's `@font-face` rules, and the stylesheet without them. The
 * export document uses the same split to carry a deck's fonts once however
 * many card-type stylesheets declare them.
 */
export function splitFontFaces(css: string): { fonts: string[]; rest: string } {
  return {
    fonts: css.match(FONT_FACE_RULE) ?? [],
    rest: css.replace(FONT_FACE_RULE, "").replace(/\n{3,}/g, "\n\n"),
  };
}

/**
 * Resolve once the layout in `root` has SETTLED — the first `.card-root`
 * has a height, the web fonts its text is set in have loaded, and every
 * image has decoded — capped at `maxFrames` frames so a font that never
 * arrives or a broken image URL degrades to "measure with what we have"
 * instead of hanging the render.
 *
 * The scaler measures text height to decide how far to shrink a body, so it
 * must run with the final font metrics, and `document.fonts.ready` alone
 * does not give it that. A web font only starts loading once laid-out
 * content requests it, so awaiting `fonts.ready` before the faces have laid
 * out resolves against an empty pending set: the scaler measures with the
 * compact fallback, finds the body fits, commits no transform, and the
 * taller real font overflows once a visible surface renders it. This host is
 * hidden and off-screen, so nothing loads its fonts eagerly. Hence: wait for
 * layout first (which requests the fonts), then poll `fonts.check` for the
 * families the faces actually use, re-awaiting `fonts.ready` between frames.
 *
 * Images are the other half, and the gap is a real defect rather than a
 * theoretical one: an `<img>` that has not decoded yet lays out at its CSS
 * floor instead of its final height, so the scaler measures a body shorter
 * than the one the reader gets and commits a scale a fraction too large — a
 * race, so it is intermittent. `error` counts as decoded: a broken image
 * will not get any taller.
 */
export async function waitForSettledLayout(
  root: ShadowRoot,
  maxFrames = 40
): Promise<void> {
  const doc = root.ownerDocument;
  const win = doc.defaultView;
  if (!win) return;
  const frame = () =>
    new Promise<void>((resolve) => win.requestAnimationFrame(() => resolve()));

  for (let i = 0; i < maxFrames; i++) {
    const probe = root.querySelector<HTMLElement>(".card-root");
    if (probe && probe.clientHeight > 0) {
      if (fontsLoadedFor(root) && imagesLoadedIn(root)) return;
      // Layout kicked off the font and image requests; this now waits for
      // them, capped, then one frame so the reflow is in the box model.
      const waits: Promise<unknown>[] = [doc.fonts.ready];
      const imgs = root.querySelectorAll("img");
      for (let k = 0; k < imgs.length; k++) {
        if (!imgs[k]!.complete) waits.push(imageSettled(imgs[k]!));
      }
      const settled = Promise.all(waits).then(frame);
      const cap = new Promise<void>((resolve) => win.setTimeout(resolve, 3000));
      await Promise.race([settled, cap]);
      if (fontsLoadedFor(root) && imagesLoadedIn(root)) return;
    }
    await frame();
  }
}

/** One image's load, resolving on `error` too. */
function imageSettled(img: HTMLImageElement): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      img.removeEventListener("load", done);
      img.removeEventListener("error", done);
      resolve();
    };
    img.addEventListener("load", done);
    img.addEventListener("error", done);
  });
}

/** True when every `<img>` in the host has finished loading, or failed. */
function imagesLoadedIn(root: ShadowRoot): boolean {
  const imgs = root.querySelectorAll("img");
  for (let i = 0; i < imgs.length; i++) {
    if (!imgs[i]!.complete) return false;
  }
  return true;
}

/**
 * True when every web font the faces' text-bearing elements are set in has
 * loaded. Reads the first family off each element's computed `font-family`
 * and asks the document's font set; a family that has no `@font-face` — a
 * system font — always checks true, so this only blocks on genuinely
 * pending web fonts.
 */
function fontsLoadedFor(root: ShadowRoot): boolean {
  const doc = root.ownerDocument;
  const win = doc.defaultView;
  if (!win) return true;
  const els = root.querySelectorAll<HTMLElement>(
    ".card-title, .text-scalable, .card-body-scalable, .card-body-scalable *"
  );
  for (let i = 0; i < els.length; i++) {
    const cs = win.getComputedStyle(els[i]!);
    const family = (cs.fontFamily.split(",")[0] ?? "").trim().replace(/^['"]|['"]$/g, "");
    if (!family || !cs.fontSize) continue;
    try {
      if (!doc.fonts.check(`${cs.fontSize} "${family}"`)) return false;
    } catch {
      // A malformed family or size is not a font to wait for.
    }
  }
  return true;
}
