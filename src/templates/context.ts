import type Handlebars from "handlebars";
import type { Classifiers } from "../definitions/classifiers";
import type { Diagnostics } from "../definitions/diagnostics";
import type { GlyphTables } from "../definitions/glyphs";
import type { Translations } from "../definitions/translations";
import type { Asset } from "../systems/assets";

/**
 * What a template sees, and what the helpers see. Two objects on purpose.
 *
 * The context is what a template author may read as a path, and it holds
 * three things about the card and nothing about its values: which card
 * type, which system, which language — for a class on the root, a branch a
 * design needs. Every value a face shows goes through a helper: `slot` for
 * a value, `slot-label` for its caption, `slot-class` for a class chosen by
 * it, `t` for a translation, `asset` for a file. The template never names a
 * property, which is what lets a card type rename, alias or re-bind its data
 * without a face noticing.
 *
 * The state is what those helpers need, and it travels in the Handlebars
 * data frame rather than in the context, so that a template cannot reach it
 * as a path and the context stays exactly what an author is meant to see.
 */
export interface TemplateContext {
  "card-type": string;
  system: string;
  language: string;
}

export interface RenderState {
  /** `<system>/<card type>`, for messages. */
  where: string;
  /** The note's values, prepared — read through the alias proxy, so a slot name reaches its property. */
  props: Record<string, unknown>;
  /** Resolved for the card's language, with the system's primary language behind it. */
  translations: Translations;
  /** Every `{{asset "…"}}` literal the engine found, read: its `data:` URI, and an SVG's text. */
  assets: ReadonlyMap<string, Asset>;
  /** Every picture the note refers to that the vault could answer: link target → `data:` URI. */
  images: ReadonlyMap<string, string>;
  /** Per slot, system then card type. */
  glyphs: GlyphTables;
  classifiers: Classifiers;
  /** A body rendered — `markdown="block"` — with the system's embed markup. */
  block(text: string): string;
  diagnostics: Diagnostics;
}

/** The key the state travels under in the data frame. */
export const STATE_KEY = "cardsmith";

/**
 * A helper's arguments, taken apart: Handlebars always passes the options
 * object last, and a call with no argument at all — a bare `{{slot}}` —
 * passes only that. So the positional arguments are whatever comes before
 * it, and the first of them is the one most helpers read.
 */
export function helperArgs(args: unknown[]): {
  argument: unknown;
  positional: unknown[];
  options: Handlebars.HelperOptions;
} {
  const positional = args.slice(0, -1);
  return {
    argument: positional[0],
    positional,
    options: args[args.length - 1] as Handlebars.HelperOptions,
  };
}

/**
 * The state behind a helper call. A helper is only ever invoked by the
 * engine, which puts the state in the frame; anything else is a programming
 * error and says so.
 */
export function stateOf(options: Handlebars.HelperOptions): RenderState {
  const state = (options.data as Record<string, unknown> | undefined)?.[STATE_KEY];
  if (!state) throw new Error("a cardsmith helper was called outside a face render");
  return state as RenderState;
}
