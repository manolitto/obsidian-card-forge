import type Handlebars from "handlebars";
import type { Diagnostics } from "../definitions/diagnostics";
import type { Translations } from "../definitions/translations";

/**
 * What a template sees, and what the helpers see. Two objects on purpose.
 *
 * The context is what a template author may read as a path — and there is
 * nothing in it yet. Every read a face makes goes through a helper: `slot`
 * for a value, `slot-label` for its caption, `t` for a translation, `asset`
 * for a file. The template never names a property, which is what lets a card
 * type rename, alias or re-bind its data without a face noticing.
 *
 * The state is what those helpers need, and it travels in the Handlebars
 * data frame rather than in the context, so that a template cannot reach it
 * as a path and the context stays exactly what an author is meant to see.
 */
export type TemplateContext = Record<string, never>;

export interface RenderState {
  /** `<system>/<card type>`, for messages. */
  where: string;
  /** The note's values, prepared — read through the alias proxy, so a slot name reaches its property. */
  props: Record<string, unknown>;
  /** The slot vocabulary: every `slot:` target across the card type's properties. */
  slots: ReadonlySet<string>;
  /** Resolved for the card's language, with the system's primary language behind it. */
  translations: Translations;
  /** Every `{{asset "…"}}` literal the engine found, read as a `data:` URI. */
  assets: ReadonlyMap<string, string>;
  diagnostics: Diagnostics;
}

/** The key the state travels under in the data frame. */
export const STATE_KEY = "cardForge";

/**
 * A helper's arguments, taken apart: Handlebars always passes the options
 * object last, and a call with no argument at all — a bare `{{slot}}` —
 * passes only that. So the one positional argument is whatever comes before
 * it, or `undefined`.
 */
export function helperArgs(args: unknown[]): {
  argument: unknown;
  options: Handlebars.HelperOptions;
} {
  return {
    argument: args.length > 1 ? args[0] : undefined,
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
  if (!state) throw new Error("a card-forge helper was called outside a face render");
  return state as RenderState;
}
