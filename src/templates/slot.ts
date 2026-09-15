import Handlebars from "handlebars";
import { classify } from "../definitions/classifiers";
import type { Diagnostics } from "../definitions/diagnostics";
import { applyGlyph } from "../definitions/glyphs";
import { helperArgs, stateOf, type RenderState } from "./context";
import { linkTarget, wikilinkDisplayText } from "./inline-markdown";
import {
  DEFAULT_SPEC,
  RENDER_SWITCHES,
  renderValue,
  scalarText,
  type RenderEnvironment,
  type RenderSpec,
} from "./render-value";

/**
 * `{{slot "name"}}` — the one way a template reads a value.
 *
 *   <span class="text-scalable">{{slot "front-title"}}</span>
 *   {{slot "front-body" markdown="block"}}
 *   {{#if (slot "front-reference")}}<div class="card-footer">{{slot "front-reference"}}</div>{{/if}}
 *   {{slot for}}                       in a partial called with for="front-stat-1a"
 *   {{#each (slot "traits" list=true)}}<p>{{name}}{{desc}}</p>{{/each}}
 *
 * A slot is a place on the card. Which property fills it is said in YAML, by
 * `slot:` on the property; what the place is and how its value renders is
 * said here, by the call and its hash. The hash IS the spec — there is no
 * declaration to override — and each key is a switch of `RenderSpec`, plus
 * `fallback=` (a value) and `list=` (the shape of the answer).
 *
 * A place no property of the card type fills has no value and renders
 * nothing — one face template may serve several card types, each binding
 * the places it has something for. A binding to a place no template reads
 * is what the loader reports, which is the typo check for both sides.
 *
 * An empty value returns the empty string rather than a `SafeString`: a
 * `SafeString` is an object and therefore truthy, and `""` is what lets the
 * hull idiom `{{#if (slot "x")}}` see an empty slot as absent. `0` is a
 * value and renders — and, being a `SafeString` then, counts as present.
 */
export function slotHelper(...args: unknown[]): unknown {
  const { argument: name, options } = helperArgs(args);
  const state = stateOf(options);
  const slot = slotName(name, "slot", state);
  if (slot === undefined) return "";
  const { spec, list } = parseRenderSpec(
    options.hash,
    `{{slot "${slot}"}}`,
    state.diagnostics
  );
  const env = environmentFor(state, slot);
  const value = readSlot(state, slot);
  if (list) return renderList(value, spec, env);
  const html = renderValue(value, spec, env);
  return html === "" ? "" : new Handlebars.SafeString(html);
}

/**
 * `{{slot-label "name"}}` — the caption of a place: `translations["<name>-label"]`.
 *
 * A missing caption is `""`, not the key: most cells are unlabelled, and a
 * system should not have to declare every label as empty to keep the key off
 * the card. The typo is caught by the slot name instead.
 */
export function slotLabelHelper(...args: unknown[]): string {
  const { argument: name, options } = helperArgs(args);
  const state = stateOf(options);
  const slot = slotName(name, "slot-label", state);
  if (slot === undefined) return "";
  return state.translations[`${slot}-label`] ?? "";
}

/**
 * `{{slot-class "name"}}` — a class token chosen by what the place shows,
 * through the card type's classifier for that slot. Buckets the display
 * text — a link as its text, a glyph applied when asked — never the raw
 * source and never HTML. A slot no classifier serves is reported.
 */
export function slotClassHelper(...args: unknown[]): string {
  const { argument: name, options } = helperArgs(args);
  const state = stateOf(options);
  const slot = slotName(name, "slot-class", state);
  if (slot === undefined) return "";
  if (!(slot in state.classifiers)) {
    state.diagnostics.warn(
      `{{slot-class "${slot}"}}: no classifier of ${state.where} serves "${slot}"; rendering nothing`
    );
    return "";
  }
  const { spec } = parseRenderSpec(
    options.hash,
    `{{slot-class "${slot}"}}`,
    state.diagnostics
  );
  const env = environmentFor(state, slot);
  let text = scalarText(readSlot(state, slot), spec.glyph ? env.glyph : undefined);
  if (text === "" && spec.fallback !== undefined) text = scalarText(spec.fallback);
  return classify(state.classifiers, slot, wikilinkDisplayText(text));
}

/**
 * The value at a slot. One function on purpose: the helper's business is how
 * a value renders, not where it comes from. Today it is a read through the
 * alias proxy — the slot name reaches the property, the property reaches the
 * note's own spelling.
 */
export function readSlot(state: RenderState, slot: string): unknown {
  return state.props[slot];
}

/**
 * The name argument. A bare `{{slot}}` has none, and a partial called
 * without its `for=` hands in `undefined`; both are reported and yield
 * nothing.
 */
function slotName(name: unknown, helper: string, state: RenderState): string | undefined {
  if (typeof name !== "string" && typeof name !== "number") {
    state.diagnostics.warn(
      `{{${helper}}} without a slot name in ${state.where}; rendering nothing`
    );
    return undefined;
  }
  return String(name).trim().toLowerCase();
}

/** The pipeline's answers for one slot: its glyph table, the note's pictures, the body renderer. */
function environmentFor(state: RenderState, slot: string): RenderEnvironment {
  return {
    glyph: (text) => applyGlyph(state.glyphs, slot, text),
    image: (link) => {
      const uri = state.images.get(linkTarget(link));
      if (uri === undefined) {
        state.diagnostics.warn(
          `{{slot "${slot}" image=true}} in ${state.where}: "${link}" is not a picture the vault has; rendering nothing`
        );
      }
      return uri;
    },
    block: state.block,
  };
}

/**
 * `list=true`: the value as an array for `{{#each}}`, every string field of
 * every item rendered with the call's switches. A scalar is lifted to one
 * item, so a note that writes one trait where the card shows a list still
 * renders. An empty value is `[]`, which `{{#if}}` sees as absent.
 */
function renderList(value: unknown, spec: RenderSpec, env: RenderEnvironment): unknown[] {
  if (value === null || value === undefined || value === "") return [];
  const items = Array.isArray(value) ? value : [value];
  const out: unknown[] = [];
  for (const item of items) {
    if (item === null || item === undefined) continue;
    if (typeof item !== "object") {
      const html = renderValue(item, spec, env);
      if (html !== "") out.push(new Handlebars.SafeString(html));
      continue;
    }
    const rendered: Record<string, unknown> = {};
    for (const [key, field] of Object.entries(item as Record<string, unknown>)) {
      rendered[key.toLowerCase()] =
        typeof field === "object" && field !== null
          ? field
          : new Handlebars.SafeString(renderValue(field, spec, env));
    }
    out.push(rendered);
  }
  return out;
}

/**
 * Hash arguments → the switches. Each is `true`, `false`, or the same as a
 * string — an author writes `linebreaks=true`, and a partial forwarding a
 * hash it received may hand the string on; `markdown` also takes `"block"`.
 * `fallback=` is a value, not a switch, and `list=` is the shape of the
 * answer. Anything else, and any key that is not one of these, is
 * reported: that is what catches `linebreaks=ture`, which Handlebars reads
 * as a path to nothing.
 */
export function parseRenderSpec(
  hash: Record<string, unknown> | undefined,
  call: string,
  diagnostics: Diagnostics
): { spec: RenderSpec; list: boolean } {
  const spec: RenderSpec = { ...DEFAULT_SPEC };
  let list = false;
  for (const [key, raw] of Object.entries(hash ?? {})) {
    if (key === "fallback") {
      spec.fallback = raw;
      continue;
    }
    const value = key === "markdown" && raw === "block" ? "block" : parseSwitch(raw);
    if (key === "list") {
      if (value === undefined) reportSwitch(call, key, raw, diagnostics);
      else list = value === true;
      continue;
    }
    if (!RENDER_SWITCHES.includes(key as keyof RenderSpec)) {
      diagnostics.warn(
        `${call}: "${key}" is not a switch (${[...RENDER_SWITCHES, "list", "fallback"].join(", ")} are); ignoring it`
      );
      continue;
    }
    if (value === undefined) {
      reportSwitch(call, key, raw, diagnostics);
      continue;
    }
    (spec as unknown as Record<string, unknown>)[key] = value;
  }
  return { spec, list };
}

function reportSwitch(
  call: string,
  key: string,
  raw: unknown,
  diagnostics: Diagnostics
): void {
  const shown = raw === undefined ? "(nothing)" : String(raw);
  const accepted = key === "markdown" ? 'true, false nor "block"' : "true nor false";
  diagnostics.warn(`${call}: ${key}=${shown} is neither ${accepted}; using the default`);
}

function parseSwitch(raw: unknown): boolean | undefined {
  if (raw === true || raw === "true") return true;
  if (raw === false || raw === "false") return false;
  return undefined;
}
