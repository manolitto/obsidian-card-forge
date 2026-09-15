import { markdownInline, wikilinkInline } from "./inline-markdown";

/**
 * How a slot's value becomes the HTML at its place on the card.
 *
 * Each field is one switch on the `{{slot}}` call, with a default, and the
 * pipeline below is the order they apply in. There are no named render
 * modes: a mode would be a name for a combination of these, and the
 * combinations do not need names when each step is a switch.
 */
export interface RenderSpec {
  /** Inline markdown and lists. Off, the text is escaped and only wikilinks are styled. */
  markdown: boolean;
  /** A newline becomes `<br>`. Off by default: markdown leaves a newline alone, and an author who wants a break writes one. */
  linebreaks: boolean;
}

export const DEFAULT_SPEC: RenderSpec = { markdown: true, linebreaks: false };

/** What `{{slot}}` accepts as a hash key, and the field each one sets. */
export const RENDER_SWITCHES: readonly (keyof RenderSpec)[] = ["markdown", "linebreaks"];

/**
 * Render one value. `""` for an empty one — `null`, `undefined`, `""` — so a
 * template's `{{#if (slot "x")}}` sees an empty slot as absent.
 *
 * The order is the contract: raw → join → wikilinks to spans → markdown or
 * escape → linebreaks. A list joins its scalar items with `", "`; an object
 * has no scalar rendering and yields `""`. A wikilink is always rendered as
 * its display text in a `.cf-wikilink` span, before either switch — nothing
 * on a printed card can be clicked, and the span is the hook a system styles
 * a reference by.
 */
export function renderValue(value: unknown, spec: RenderSpec): string {
  const text = scalarText(value);
  if (text === "") return "";
  let html = spec.markdown ? markdownInline(text) : wikilinkInline(text);
  if (spec.linebreaks) html = html.replace(/\n/g, "<br>");
  return html;
}

/** The value as the text the pipeline reads, or `""` when there is nothing to show. */
function scalarText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) {
    return value
      .map(scalarText)
      .filter((item) => item !== "")
      .join(", ");
  }
  if (typeof value === "object") return "";
  return String(value);
}
