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

/** `n` short paragraphs of filler, enough alike that their height scales with `n`. */
export function paragraphs(n: number): string {
  const text =
    "The lantern sheds a steady light across the chamber, and what was hidden steps forward.";
  return Array.from({ length: n }, () => `<p>${text}</p>`).join("");
}
