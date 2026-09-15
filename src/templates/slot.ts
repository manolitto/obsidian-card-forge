import Handlebars from "handlebars";
import type { Diagnostics } from "../definitions/diagnostics";
import { helperArgs, stateOf, type RenderState } from "./context";
import {
  DEFAULT_SPEC,
  RENDER_SWITCHES,
  renderValue,
  type RenderSpec,
} from "./render-value";

/**
 * `{{slot "name"}}` — the one way a template reads a value.
 *
 *   <span class="text-scalable">{{slot "front-title"}}</span>
 *   {{slot "front-body" linebreaks=true}}
 *   {{#if (slot "front-reference")}}<div class="card-footer">{{slot "front-reference"}}</div>{{/if}}
 *   {{slot for}}                       in a partial called with for="front-stat-1a"
 *
 * A slot is a place on the card. Which property fills it is said in YAML, by
 * `slot:` on the property; what the place is and how its value renders is
 * said here, by the call and its hash. The hash IS the spec — there is no
 * declaration to override — and each key is a switch of `RenderSpec`.
 *
 * The name is checked against the card type's vocabulary, the set of `slot:`
 * targets across its properties. A name nothing fills is almost always a typo
 * and is reported, naming the system and the card type; it renders nothing.
 *
 * An empty value returns the empty string rather than a `SafeString`: a
 * `SafeString` is an object and therefore truthy, and `""` is what lets the
 * hull idiom `{{#if (slot "x")}}` see an empty slot as absent.
 */
export function slotHelper(...args: unknown[]): unknown {
  const { argument: name, options } = helperArgs(args);
  const state = stateOf(options);
  const slot = slotName(name, "slot", state);
  if (slot === undefined) return "";
  const spec = parseRenderSpec(options.hash, `{{slot "${slot}"}}`, state.diagnostics);
  const html = renderValue(readSlot(state, slot), spec);
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
 * The value at a slot. One function on purpose: the helper's business is how
 * a value renders, not where it comes from. Today it is a read through the
 * alias proxy — the slot name reaches the property, the property reaches the
 * note's own spelling.
 */
export function readSlot(state: RenderState, slot: string): unknown {
  return state.props[slot];
}

/**
 * The name argument, checked. A bare `{{slot}}` has none, and a partial
 * called without its `for=` hands in `undefined`; both are reported and
 * yield nothing.
 */
function slotName(name: unknown, helper: string, state: RenderState): string | undefined {
  if (typeof name !== "string" && typeof name !== "number") {
    state.diagnostics.warn(
      `{{${helper}}} without a slot name in ${state.where}; rendering nothing`
    );
    return undefined;
  }
  const slot = String(name).trim().toLowerCase();
  if (!state.slots.has(slot)) {
    state.diagnostics.warn(
      `{{${helper} "${slot}"}}: "${slot}" is not a slot any property of ${state.where} fills; rendering nothing`
    );
    return undefined;
  }
  return slot;
}

/**
 * Hash arguments → the switches. Each is `true`, `false`, or the same as a
 * string — an author writes `linebreaks=true`, and a partial forwarding a
 * hash it received may hand the string on. Anything else, and any key that
 * is not a switch, is reported: that is what catches `linebreaks=ture`,
 * which Handlebars reads as a path to nothing.
 */
export function parseRenderSpec(
  hash: Record<string, unknown> | undefined,
  call: string,
  diagnostics: Diagnostics
): RenderSpec {
  const spec: RenderSpec = { ...DEFAULT_SPEC };
  for (const [key, raw] of Object.entries(hash ?? {})) {
    if (!RENDER_SWITCHES.includes(key as keyof RenderSpec)) {
      diagnostics.warn(
        `${call}: "${key}" is not a switch (${RENDER_SWITCHES.join(", ")} are); ignoring it`
      );
      continue;
    }
    const value = parseSwitch(raw);
    if (value === undefined) {
      const shown = raw === undefined ? "(nothing)" : String(raw);
      diagnostics.warn(
        `${call}: ${key}=${shown} is neither true nor false; using the default`
      );
      continue;
    }
    spec[key as keyof RenderSpec] = value;
  }
  return spec;
}

function parseSwitch(raw: unknown): boolean | undefined {
  if (raw === true || raw === "true") return true;
  if (raw === false || raw === "false") return false;
  return undefined;
}
