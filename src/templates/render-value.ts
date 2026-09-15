import {
  escapeHtml,
  markdownInline,
  wikilinkDisplayText,
  wikilinkInline,
} from "./inline-markdown";

/**
 * How a slot's value becomes the HTML at its place on the card.
 *
 * Each field is one switch on the `{{slot}}` call, with a default, and the
 * pipeline below is the order they apply in. There are no named render
 * modes: a mode would be a name for a combination of these, and the
 * combinations do not need names when each step is a switch.
 */
export interface RenderSpec {
  /**
   * Inline markdown and lists; `"block"` for a body — paragraphs, headings,
   * tables, embedded pictures. Off, the text is escaped and only wikilinks
   * are styled.
   */
  markdown: boolean | "block";
  /** A newline becomes `<br>`. Off by default: markdown leaves a newline alone, and an author who wants a break writes one. */
  linebreaks: boolean;
  /** The raw value through the slot's glyph table first — `1H` printed as `einhändig`. */
  glyph: boolean;
  /** The value is a picture: its link resolved to a `data:` URI, nothing else rendered. */
  image: boolean;
  /** Display text only — a link as its text, no span, no markdown, escaped. For comparisons. */
  plain: boolean;
  /** What renders, through the same switches, when the value is empty. Not a switch: a value. */
  fallback?: unknown;
}

export const DEFAULT_SPEC: RenderSpec = {
  markdown: true,
  linebreaks: false,
  glyph: false,
  image: false,
  plain: false,
};

/** What `{{slot}}` accepts as a hash key, and the field each one sets. */
export const RENDER_SWITCHES: readonly (keyof RenderSpec)[] = [
  "markdown",
  "linebreaks",
  "glyph",
  "image",
  "plain",
];

/**
 * What the pipeline needs from outside — each an answer for the slot being
 * rendered, so the pipeline itself stays pure. A miss is the environment's
 * to report: it knows the slot and the sink, the pipeline knows neither.
 */
export interface RenderEnvironment {
  /** The glyph for a raw scalar, or the scalar itself. */
  glyph(text: string): string;
  /** The `data:` URI a link or path resolves to, or `undefined` for a miss. */
  image(link: string): string | undefined;
  /** A body rendered — `markdown="block"`. */
  block(text: string): string;
}

/** For a caller with nothing to resolve: no glyphs, no pictures, no bodies. */
export const BARE_ENVIRONMENT: RenderEnvironment = {
  glyph: (text) => text,
  image: () => undefined,
  block: (text) => markdownInline(text),
};

/**
 * Render one value. `""` for an empty one — `null`, `undefined`, `""` — so a
 * template's `{{#if (slot "x")}}` sees an empty slot as absent.
 *
 * The order is the contract:
 *
 *     raw → glyph → join → fallback → image | plain | markdown or escape → linebreaks
 *
 * A list joins its scalar items with `", "`, each through the glyph table;
 * an object has no scalar rendering and yields `""`. The fallback steps in
 * after the empty check and goes through the same switches a real value
 * would. A wikilink is always rendered as its display text in a
 * `.cf-wikilink` span, before either switch — nothing on a printed card can
 * be clicked, and the span is the hook a system styles a reference by —
 * unless `plain` asks for the text alone.
 */
export function renderValue(
  value: unknown,
  spec: RenderSpec,
  env: RenderEnvironment = BARE_ENVIRONMENT
): string {
  let text = scalarText(value, spec.glyph ? env.glyph : undefined);
  if (text === "") {
    if (spec.fallback === undefined) return "";
    text = scalarText(spec.fallback, spec.glyph ? env.glyph : undefined);
    if (text === "") return "";
  }

  if (spec.image) {
    const uri = env.image(text);
    return uri === undefined ? "" : escapeHtml(uri);
  }

  let html: string;
  if (spec.plain) html = escapeHtml(wikilinkDisplayText(text));
  else if (spec.markdown === "block") html = env.block(text);
  else if (spec.markdown) html = markdownInline(text);
  else html = wikilinkInline(text);

  if (spec.linebreaks) html = html.replace(/\n/g, "<br>");
  return html;
}

/** The value as the text the pipeline reads, or `""` when there is nothing to show. */
export function scalarText(value: unknown, glyph?: (text: string) => string): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) {
    return value
      .map((item) => scalarText(item, glyph))
      .filter((item) => item !== "")
      .join(", ");
  }
  if (typeof value === "object") return "";
  const text = String(value);
  return glyph && text !== "" ? glyph(text) : text;
}
