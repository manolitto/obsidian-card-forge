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
 *   `[[target|alias]]`         a `.cf-wikilink` span showing the alias — the
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
 * which a raw `<div class="cf-keep-together">` would not. Raw HTML in the
 * body passes through, as markdown has it.
 */

/** What an embedded picture becomes. `target` and `alt` are as the note wrote them. */
export type EmbedRenderer = (target: string, alt: string) => string;

/** A renderer of bodies, given what to do with an embedded picture. */
export function blockMarkdown(embed: EmbedRenderer): (text: string) => string {
  const marked = new Marked({ gfm: true });
  marked.use({ extensions: [imageEmbed(embed), wikilink, cardBreak, bodyMarker] });
  return (text) => marked.parse(text, { async: false });
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
    `<span class="cf-wikilink">${escapeHtml(String(token["text"]))}</span>`,
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

/** Each name is the `cf-<name>` class the splitter reads; the list is closed on purpose. */
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
  renderer: () => `<div class="cf-card-break"></div>`,
};

/**
 * A paired marker wraps the blocks between its lines in `<div class="cf-…">`.
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
    return `<div class="cf-${String(token["marker"])}">${this.parser.parse(tokens)}</div>`;
  },
};
