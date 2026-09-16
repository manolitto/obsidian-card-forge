import type { LaidOutCard } from "../../../src/layout/engine";
import { readScaleFromTransform } from "../../../src/layout/font-scaler";

/**
 * A laid-out card as text: the settled face sequence a reviewer wants to
 * read when a split moves, and nothing a browser's sub-pixel drift would
 * change. Per face its role, the layout class and every marker the engine
 * stamped, the committed body scale to two decimals, and the blocks the
 * body holds — tag, classes, and the first words of each — so that a
 * paragraph crossing onto another face, a table pulled back by a keep
 * marker or a scale that moved by a hundredth all show as a one-line diff.
 *
 *     Beizjagd · 1 card · 2 faces · clipped: no
 *     1. front [cf-overflow-active cf-layout-default cf-front-first cf-front-has-next] scale 0.89
 *        div.ez-body.cf-split-head
 *          p "Eine Beizjagd dauert einen Tag und …"
 *          p "Wird die Probe mit Vorteil abgelegt …"
 *     2. back-as-front [cf-overflow-back-as-front cf-overflow-active cf-layout-default cf-front-continued] scale 0.89
 *        div.ez-body.cf-split-continuation
 *          div.cf-keep-together
 *            h3 "Beute (1w6)"
 *            table (7 rows) "1w6 Beute 1 Nichts als Federn …"
 *        div.ez-logo-band
 *          img.ez-logo
 *
 * A face's role is where it sits and what it is: `front`, `back` (the
 * designed back), or `back-as-front` (the copy of the front that replaced
 * it under `back-then-cards`). The scale is `—` on a face without a
 * scalable body.
 */
export function layoutGoldenText(name: string, out: LaidOutCard): string {
  const faces: { role: string; root: HTMLElement }[] = [];
  for (const pair of out.cards) {
    if (pair.front !== undefined) faces.push({ role: "front", root: parse(pair.front) });
    if (pair.back !== undefined) {
      const root = parse(pair.back);
      const role = root.classList.contains("cf-overflow-back-as-front")
        ? "back-as-front"
        : root.classList.contains("card-front")
          ? "front"
          : "back";
      faces.push({ role, root });
    }
  }
  const lines = [
    `${name} · ${out.cards.length} ${out.cards.length === 1 ? "card" : "cards"} · ${faces.length} faces · clipped: ${out.clipped ? "yes" : "no"}`,
  ];
  faces.forEach(({ role, root }, i) => {
    const hooks = Array.from(root.classList).filter((c) => c.startsWith("cf-"));
    const body = root.querySelector<HTMLElement>(".card-body-scalable");
    // A body the scaler never had to shrink carries no transform: scale 1.
    const scale = body ? (readScaleFromTransform(body) || 1).toFixed(2) : "—";
    lines.push(`${i + 1}. ${role} [${hooks.join(" ")}] scale ${scale}`);
    if (body) for (const child of Array.from(body.children)) describe(child, 1, lines);
  });
  return lines.join("\n") + "\n";
}

/**
 * Tags a face's text is set in. An element is walked into only when it holds
 * at least one of these — a wrapper around blocks — and is otherwise a leaf
 * whose first words are shown: a paragraph with its inline markup, a stat
 * row of spans, a list, a table.
 */
const BLOCK_TAGS = new Set([
  "div",
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "table",
  "hr",
  "img",
  "pre",
  "blockquote",
  "figure",
  "section",
]);
/** Blocks that are always leaves, however they nest inside. */
const LEAF_TAGS = new Set([
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "table",
  "pre",
]);

const WORDS = 6;

function describe(el: Element, depth: number, lines: string[]): void {
  const indent = "   " + "  ".repeat(depth - 1);
  const tag = el.tagName.toLowerCase();
  const classes = Array.from(el.classList)
    .map((c) => "." + c)
    .join("");
  let line = `${indent}${tag}${classes}`;
  const children = Array.from(el.children);
  const blocks = children.filter((c) => BLOCK_TAGS.has(c.tagName.toLowerCase()));
  if (!LEAF_TAGS.has(tag) && blocks.length > 0) {
    // A wrapper. Text of its own — inline markdown beside a list — reads on
    // the wrapper's line; the blocks follow, each on its own.
    const ownText = blocks.length < children.length || hasOwnText(el);
    const text = ownText ? firstWords(el) : "";
    lines.push(text ? `${line} "${text}"` : line);
    for (const child of blocks) describe(child, depth + 1, lines);
    return;
  }
  if (tag === "ul" || tag === "ol") line += ` (${children.length} items)`;
  if (tag === "table") line += ` (${el.querySelectorAll("tr").length} rows)`;
  if (tag !== "img" && el.querySelector("img")) line += " [img]";
  const text = firstWords(el);
  lines.push(text ? `${line} "${text}"` : line);
}

/** Whether an element has text directly in it, not only inside its children. */
function hasOwnText(el: Element): boolean {
  for (let n = el.firstChild; n; n = n.nextSibling) {
    if (n.nodeType === Node.TEXT_NODE && /\S/.test((n as Text).data)) return true;
  }
  return false;
}

/** The first words of an element's text, its text nodes joined by a space so adjacent spans keep apart. */
function firstWords(el: Element): string {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const words: string[] = [];
  for (let n = walker.nextNode(); n && words.length <= WORDS; n = walker.nextNode()) {
    words.push(...(n as Text).data.split(/\s+/).filter(Boolean));
  }
  if (words.length === 0) return "";
  const head = words.slice(0, WORDS).join(" ");
  return words.length > WORDS ? head + " …" : head;
}

function parse(html: string): HTMLElement {
  const el = document.createElement("div");
  el.innerHTML = html;
  const root = el.querySelector<HTMLElement>(".card-root");
  if (!root) throw new Error("layoutGoldenText: a face without a .card-root");
  return root;
}

/**
 * `actual` with every committed scale that lies within `tolerance` of the
 * golden's on the same line replaced by the golden's value. Chromium lays
 * the same font out a fraction of a pixel differently from one platform to
 * the next — advances and line boxes round differently under FreeType and
 * CoreText — and that fraction moves a committed scale by a hundredth,
 * which is the digit the golden prints. The comparison therefore ignores a
 * drift of that size and nothing else: a scale that moved further, or a
 * block that moved to another face, still shows in the diff.
 */
export function withScalesAligned(
  actual: string,
  golden: string,
  tolerance = 0.015
): string {
  const goldenLines = golden.split("\n");
  const scaleOf = (line: string) => {
    const m = /\bscale (\d+\.\d+)$/.exec(line);
    return m ? { text: m[1]!, value: parseFloat(m[1]!) } : undefined;
  };
  return actual
    .split("\n")
    .map((line, i) => {
      const a = scaleOf(line);
      const g = goldenLines[i] === undefined ? undefined : scaleOf(goldenLines[i]!);
      if (!a || !g || Math.abs(a.value - g.value) > tolerance) return line;
      return line.slice(0, line.length - a.text.length) + g.text;
    })
    .join("\n");
}
