/**
 * The markup a card value may carry, and how it becomes HTML.
 *
 * A value on a card is prose more often than it is a literal: a description
 * with a bold term, a short list of effects, a reference to another note.
 * This module renders that — inline emphasis, the two list kinds, wikilinks
 * as styled display text — and nothing block-level beyond a list. It is pure
 * text processing with its own escaping, so it is testable from a string
 * literal and owes the template engine nothing.
 *
 * Three readings of the same text, from plainest to richest:
 *
 *   `wikilinkDisplayText`  no markup at all — what a link SHOWS, for comparisons
 *   `wikilinkInline`       links styled, everything else escaped verbatim
 *   `markdownInline`       links styled, then the inline markdown
 *
 * A wikilink always becomes `<span class="cf-wikilink">display text</span>`:
 * a printed card has nothing to click, so what remains of a link is its text
 * and a hook a system may style. An Obsidian `#tag` is vault metadata, not
 * card content, and is dropped everywhere.
 */

/** Every `[[target|alias]]`, and the embed form `![[…]]`; capture 2 is what it shows. */
const WIKILINK = /!?\[\[([^\]|]+\|)?([^\]]+)\]\]/g;

/**
 * A tag candidate: `#` + body, after the start of the text, whitespace, or
 * an explicit `<br>`. The prefix is what keeps every other `#` intact — a
 * heading's `## ` (the body excludes `#` and a heading's is followed by a
 * space), `[[Note#Heading]]` (preceded by a letter or `[`), a URL fragment.
 */
const TAG = /(^|\s|<br\s*\/?>)#([\p{L}\p{N}_/-]+)/giu;

/** Fenced blocks and code spans, whose contents are left alone. */
const CODE = /(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)/g;

/** A purely numeric body is not a tag in Obsidian (`#1`, `#2024`). */
const ALL_DIGITS = /^\p{N}+$/u;

/** Drop every Obsidian tag, leaving the surrounding text and any code untouched. */
export function stripTags(text: string): string {
  if (!text.includes("#")) return text;
  // A split on a capturing group keeps the code segments, at the odd indices.
  return text
    .split(CODE)
    .map((segment, i) =>
      i % 2 === 1
        ? segment
        : segment.replace(TAG, (match, prefix: string, body: string) =>
            ALL_DIGITS.test(body) ? match : prefix
          )
    )
    .join("");
}

/** What the text shows once every wikilink is reduced to its display text. */
export function wikilinkDisplayText(text: string): string {
  return stripTags(text).replace(WIKILINK, "$2");
}

/** A text that is one wikilink or embed, as its target; any other text, trimmed. */
const ONE_WIKILINK = /^!?\[\[([^\]|]+)(?:\|[^\]]*)?\]\]$/;

/**
 * Where a link points: `[[Beil.png|the axe]]` and `![[Beil.png]]` both name
 * `Beil.png`, and a bare `Beil.png` names itself. The key a resolved picture
 * is looked up under.
 */
export function linkTarget(text: string): string {
  const trimmed = text.trim();
  const match = ONE_WIKILINK.exec(trimmed);
  return match ? (match[1] as string).trim() : trimmed;
}

/** Wikilinks as styled spans; everything else is literal text, escaped. */
export function wikilinkInline(text: string): string {
  return escapeHtml(stripTags(text)).replace(
    WIKILINK,
    '<span class="cf-wikilink">$2</span>'
  );
}

/**
 * Inline markdown: bold, italic, bold-italic, a run of `- ` / `* ` lines as a
 * `<ul>`, a run of `1. ` / `1) ` lines as an `<ol>`, wikilinks as spans, and
 * an explicit `<br>` passed through. Everything else is escaped; a newline
 * stays a newline — breaking on it is the caller's switch.
 */
export function markdownInline(text: string): string {
  // An explicit `<br>` is the one tag an author may write. It survives the
  // escape as a token — a private-use character no text carries — and comes
  // back as itself.
  const BR = "\uE000";
  let html = escapeHtml(stripTags(text).replace(/<br\s*\/?>/gi, BR))
    .split(BR)
    .join("<br>");

  html = renderLists(html);

  html = html.replace(WIKILINK, '<span class="cf-wikilink">$2</span>');
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  html = html.replace(/___(.+?)___/g, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__(.+?)__/g, "<strong>$1</strong>");
  // An opening marker cannot be followed by whitespace (CommonMark), which is
  // what keeps a `* ` list marker from pairing with a later asterisk.
  html = html.replace(/\*([^\s*][^*]*?)\*/g, "<em>$1</em>");
  html = html.replace(/_([^\s_][^_]*?)_/g, "<em>$1</em>");
  return html;
}

/**
 * Consecutive lines that start with a list marker become one list; a change
 * of marker kind closes the list and opens the other. Lines outside a run
 * pass through with their newline.
 *
 * The space after a marker is a space or a tab, never `\s`: that class
 * includes the no-break space, and `-<NBSP>1` is a signed value keeping its
 * sign glued to its digit, not a bullet. A bare number or a decimal (`2024`,
 * `1.50`) never matches, since the delimiter and the space are both required.
 */
function renderLists(html: string): string {
  const out: string[] = [];
  let open: "ul" | "ol" | null = null;
  const close = (): void => {
    if (open) out.push(`</${open}>`);
    open = null;
  };
  const lines = html.split("\n");
  lines.forEach((line, i) => {
    const ul = /^[ \t]*[-*][ \t]+(.*)$/.exec(line);
    const ol = ul ? null : /^[ \t]*\d+[.)][ \t]+(.*)$/.exec(line);
    const item = ul ?? ol;
    if (item) {
      const kind = ul ? "ul" : "ol";
      if (open !== kind) {
        close();
        out.push(`<${kind}>`);
        open = kind;
      }
      // An item absorbs the newline that ended it.
      out.push(`<li>${item[1]}</li>`);
    } else {
      close();
      out.push(line);
      if (i < lines.length - 1) out.push("\n");
    }
  });
  close();
  return out.join("");
}

const ESCAPES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** The five characters that must not reach HTML as themselves. */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ESCAPES[c] as string);
}
