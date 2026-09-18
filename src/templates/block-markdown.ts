import { Marked, type TokenizerAndRendererExtension } from "marked";
import { escapeHtml } from "./inline-markdown";

/**
 * Block-level markdown — a note's own text on a card.
 *
 * Where `inline-markdown.ts` renders a value (emphasis, a short list, a
 * link), this renders a body: paragraphs, headings, lists, tables, embedded
 * pictures, and the two comment markers an author steers the pagination
 * with. It is what `markdown="block"` on a `{{slot}}` call produces, and the
 * one place `marked` is used — pinned, because a golden fixture is only
 * worth keeping if the same text renders the same way tomorrow.
 *
 * Four things Obsidian's markdown has that CommonMark does not, each an
 * extension below:
 *
 *   `[[target|alias]]`         a `.cs-wikilink` span showing the alias — the
 *                              same span a value's link becomes
 *   `![[picture.png|alt]]`     the embed hook: the caller says what an
 *                              embedded picture becomes, since it has the
 *                              picture's bytes and the design's markup
 *   `%% card-break %%`         a hard break: a marker block the overflow
 *                              splitter starts a new face at
 *   `%% keep-together %%` …    a region the splitter does not cut inside;
 *   `%% /keep-together %%`     likewise `keep-with-next` and `keep-with-prev`
 *
 * The markers are Obsidian comments, so the note reads clean in Obsidian's
 * own view, and the markdown between them keeps rendering in its editor —
 * which a raw `<div class="cs-keep-together">` would not.
 *
 * Raw HTML in the body is text: a note's `<b>` prints as `<b>`, and a
 * `<img onerror>` never reaches the preview. Two things an author may
 * write stay markup — `<br>`, a line break where markdown would need two
 * trailing spaces (the one tag a value keeps too), and an inline `<svg>`,
 * a small drawing in the prose: a credit line's icon, a symbol no font
 * has. See `keptHtml` for what of an SVG gets through.
 */

/** What an embedded picture becomes. `target` and `alt` are as the note wrote them. */
export type EmbedRenderer = (target: string, alt: string) => string;

/** A renderer of bodies, given what to do with an embedded picture. */
export function blockMarkdown(embed: EmbedRenderer): (text: string) => string {
  const marked = new Marked({ gfm: true });
  marked.use({
    extensions: [imageEmbed(embed), wikilink, cardBreak, bodyMarker],
    renderer: { html: ({ text }) => keptHtml(text) },
  });
  return (text) => marked.parse(text, { async: false });
}

// ── Raw HTML ──────────────────────────────────────────────────────

/**
 * The tags that stay tags: `<br>`, and the elements that draw an SVG —
 * the `<svg>` itself, a group, and the shapes. Everything an SVG can do
 * beyond drawing is left out, so the list is closed: no `<script>`, no
 * `<a>`, no `<image>` or `<use>` reaching for another file, no
 * `<foreignObject>` with HTML inside, no `<style>`, no animation. A tag
 * outside the list prints as text, wherever it stands.
 */
const KEPT_TAGS = new Set([
  "br",
  "svg",
  "g",
  "path",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
]);

/** An attribute a kept element may not carry: an event handler, or a link. */
function droppedAttribute(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.startsWith("on") || lower.endsWith("href");
}

/** A tag, or a run of text between tags — `marked` hands over either, or a whole block of both. */
const TAG_OR_TEXT = /<[^<>]*>|[^<]+|</g;
/** One tag taken apart: closing slash, name, attributes, self-closing slash. */
const TAG = /^<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>$/;
/** One attribute, its value quoted or bare. */
const ATTRIBUTE = /([^\s"'<>=/]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'<>=`]+))?/g;

/**
 * Raw HTML as the card gets it: a kept tag as markup, minus its dropped
 * attributes; every other tag, and the text between tags, escaped. A
 * `<br>` comes out as the value pipeline writes it, whatever the note's
 * spelling.
 */
function keptHtml(raw: string): string {
  return raw.replace(TAG_OR_TEXT, (piece) => {
    const tag = TAG.exec(piece);
    if (!tag) return escapeHtml(piece);
    const closing = tag[1] as string;
    const name = tag[2] as string;
    const selfClosing = tag[4] as string;
    const lower = name.toLowerCase();
    if (!KEPT_TAGS.has(lower)) return escapeHtml(piece);
    if (lower === "br") return "<br>";
    if (closing) return `</${lower}>`;
    let attributes = "";
    for (const attribute of (tag[3] as string).matchAll(ATTRIBUTE)) {
      const attributeName = attribute[1] as string;
      if (droppedAttribute(attributeName)) continue;
      const value = attribute[2];
      attributes +=
        value === undefined ? ` ${attributeName}` : ` ${attributeName}=${value}`;
    }
    return `<${name}${attributes}${selfClosing}>`;
  });
}

// ── Links and pictures ────────────────────────────────────────────

const WIKILINK_AT_START = /^\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/;
const EMBED_AT_START = /^!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/;

const wikilink: TokenizerAndRendererExtension = {
  name: "wikilink",
  level: "inline",
  start: (src) => src.indexOf("[["),
  tokenizer(src) {
    const match = WIKILINK_AT_START.exec(src);
    if (!match) return undefined;
    return { type: "wikilink", raw: match[0], text: match[2] ?? match[1] };
  },
  renderer: (token) =>
    `<span class="cs-wikilink">${escapeHtml(String(token["text"]))}</span>`,
};

function imageEmbed(embed: EmbedRenderer): TokenizerAndRendererExtension {
  return {
    name: "imageEmbed",
    level: "inline",
    start: (src) => src.indexOf("![["),
    tokenizer(src) {
      const match = EMBED_AT_START.exec(src);
      if (!match) return undefined;
      return {
        type: "imageEmbed",
        raw: match[0],
        target: match[1],
        alt: match[2] ?? match[1],
      };
    },
    renderer: (token) => embed(String(token["target"]), String(token["alt"])),
  };
}

// ── The pagination markers ────────────────────────────────────────

/** Each name is the `cs-<name>` class the splitter reads; the list is closed on purpose. */
export const BODY_MARKERS = [
  "keep-together",
  "keep-with-next",
  "keep-with-prev",
] as const;

const MARKER_NAMES = BODY_MARKERS.join("|");
const MARKER_OPEN = new RegExp(
  `^[ \\t]*%%[ \\t]*(${MARKER_NAMES})[ \\t]*%%[ \\t]*(?:\\n|$)`,
  "i"
);
const MARKER_CLOSE = new RegExp(
  `^[ \\t]*%%[ \\t]*/[ \\t]*(?:${MARKER_NAMES})[ \\t]*%%[ \\t]*(?:\\n|$)`,
  "i"
);
const CARD_BREAK = /^[ \t]*%%[ \t]*card-break[ \t]*%%[ \t]*(?:\n|$)/i;

/**
 * Where a block extension may start: at a line that looks like one of our
 * markers, never at any `%%`. The hint is what `marked` cuts a paragraph
 * at, so an ordinary comment in prose must not give one.
 */
const MARKER_START = new RegExp(
  `(^|\n)[ \t]*%%[ \t]*/?[ \t]*(?:${MARKER_NAMES}|card-break)[ \t]*%%`,
  "i"
);
function markerStart(src: string): number | undefined {
  const match = MARKER_START.exec(src);
  return match ? match.index + (match[1] as string).length : undefined;
}

/** A whole line that opens (`closing: false`) or closes one named marker. */
function markerLine(marker: string, closing: boolean): RegExp {
  return new RegExp(
    `^[ \\t]*%%[ \\t]*${closing ? "/[ \\t]*" : ""}${marker}[ \\t]*%%[ \\t]*$`,
    "i"
  );
}

/** `%% card-break %%` on a line of its own: an invisible block the splitter breaks at. */
const cardBreak: TokenizerAndRendererExtension = {
  name: "cardBreak",
  level: "block",
  start: markerStart,
  tokenizer(src) {
    const match = CARD_BREAK.exec(src);
    if (!match) return undefined;
    return { type: "cardBreak", raw: match[0] };
  },
  renderer: () => `<div class="cs-card-break"></div>`,
};

/**
 * A paired marker wraps the blocks between its lines in `<div class="cs-…">`.
 * Same-name markers nest by depth; an unterminated one runs to the end of
 * the text rather than printing itself; a stray closer is swallowed.
 */
const bodyMarker: TokenizerAndRendererExtension = {
  name: "bodyMarker",
  level: "block",
  start: markerStart,
  tokenizer(src) {
    const stray = MARKER_CLOSE.exec(src);
    if (stray) return { type: "bodyMarker", raw: stray[0], marker: "", tokens: [] };

    const open = MARKER_OPEN.exec(src);
    if (!open) return undefined;
    const marker = (open[1] as string).toLowerCase();
    const opens = markerLine(marker, false);
    const closes = markerLine(marker, true);

    const lines = src.slice(open[0].length).split("\n");
    const inner: string[] = [];
    let length = open[0].length;
    let depth = 0;
    for (const line of lines) {
      if (closes.test(line)) {
        if (depth === 0) {
          length += line.length + 1;
          break;
        }
        depth--;
      } else if (opens.test(line)) {
        depth++;
      }
      inner.push(line);
      length += line.length + 1;
    }

    const text = inner.join("\n").trim();
    return {
      type: "bodyMarker",
      raw: src.slice(0, Math.min(length, src.length)),
      marker,
      tokens: text ? this.lexer.blockTokens(text, []) : [],
    };
  },
  renderer(token) {
    const tokens = token["tokens"];
    if (!token["marker"] || !Array.isArray(tokens) || tokens.length === 0) return "";
    return `<div class="cs-${String(token["marker"])}">${this.parser.parse(tokens)}</div>`;
  },
};
