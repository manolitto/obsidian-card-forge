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
  /**
   * A number with its sign — `+5`, `-2`, `0` as it is. YAML reads an unquoted
   * `+5` as the integer 5, so a modifier written the way the rulebook writes
   * it loses its sign on the way in; this puts it back. A value that already
   * starts with a sign is left alone, and one that is not a number at all is
   * left alone and reported.
   */
  signed: boolean;
  /** What a list's items are joined with. */
  join: string;
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
  signed: false,
  join: ", ",
  image: false,
  plain: false,
};

/** What `{{slot}}` accepts as a hash key, and the field each one sets. */
export const RENDER_SWITCHES: readonly (keyof RenderSpec)[] = [
  "markdown",
  "linebreaks",
  "glyph",
  "signed",
  "join",
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
  /** A switch that could not do what it was asked — `signed=true` on a word. */
  report(message: string): void;
}

/** For a caller with nothing to resolve: no glyphs, no pictures, no bodies, nowhere to report. */
export const BARE_ENVIRONMENT: RenderEnvironment = {
  glyph: (text) => text,
  image: () => undefined,
  block: (text) => markdownInline(text),
  report: () => undefined,
};

/**
 * Render one value. `""` for an empty one — `null`, `undefined`, `""` — so a
 * template's `{{#if (slot "x")}}` sees an empty slot as absent.
 *
 * The order is the contract:
 *
 *     raw → glyph → signed → join → fallback → image | plain | markdown or escape → linebreaks
 *
 * A list joins its scalar items with `join`, each through the glyph table
 * and the sign; an object has no scalar rendering and yields `""`. The fallback steps in
 * after the empty check and goes through the same switches a real value
 * would. A wikilink is always rendered as its display text in a
 * `.cs-wikilink` span, before either switch — nothing on a printed card can
 * be clicked, and the span is the hook a system styles a reference by —
 * unless `plain` asks for the text alone.
 */
export function renderValue(
  value: unknown,
  spec: RenderSpec,
  env: RenderEnvironment = BARE_ENVIRONMENT
): string {
  const scalar = scalarStep(spec, env);
  let text = scalarText(value, scalar, spec.join);
  if (text === "") {
    if (spec.fallback === undefined) return "";
    text = scalarText(spec.fallback, scalar, spec.join);
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

/**
 * The steps that act on one scalar — the glyph table, then the sign — as one
 * function, or none when neither switch is on.
 */
export function scalarStep(
  spec: Pick<RenderSpec, "glyph" | "signed">,
  env: RenderEnvironment
): ((text: string) => string) | undefined {
  if (!spec.glyph && !spec.signed) return undefined;
  return (text) => {
    if (spec.glyph) text = env.glyph(text);
    if (spec.signed) text = signedText(text, env);
    return text;
  };
}

/**
 * The value as the text the pipeline reads, or `""` when there is nothing to
 * show. A list is its items, each through `step`, the empty ones left out,
 * joined with `separator`.
 */
export function scalarText(
  value: unknown,
  step?: (text: string) => string,
  separator = DEFAULT_SPEC.join
): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) {
    return value
      .map((item) => scalarText(item, step, separator))
      .filter((item) => item !== "")
      .join(separator);
  }
  if (typeof value === "object") return "";
  const text = String(value);
  return step && text !== "" ? step(text) : text;
}

/** `5` → `+5`, `-2` and `0` as they are; a value that already carries a sign likewise; a word is reported. */
function signedText(text: string, env: RenderEnvironment): string {
  const trimmed = text.trim();
  if (/^[+-]/.test(trimmed)) return text;
  const number = Number(trimmed);
  if (trimmed === "" || !Number.isFinite(number)) {
    env.report(`signed=true on "${text}", which is not a number; leaving it as it is`);
    return text;
  }
  return number > 0 ? `+${trimmed}` : trimmed;
}
