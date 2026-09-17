import Handlebars from "handlebars";
import { helperArgs, stateOf, type RenderState } from "./context";
import { slotClassHelper, slotHelper, slotLabelHelper } from "./slot";

/**
 * The helpers a face template may call. Five lookups and two comparisons:
 *
 *   {{slot "name" …}}      the value at a place, rendered — see `slot.ts`
 *   {{slot-label "name"}}  its caption, or nothing
 *   {{slot-class "name"}}  a class token chosen by what it shows
 *   {{t "key"}}            a translation, or the KEY when there is none — a
 *                          visible marker an author can spot on the card
 *   {{asset "path"}}       a file of the system as a `data:` URI; with
 *                          `inline=true`, an SVG's markup itself, so the
 *                          icon takes the text colour
 *   (or a b …)             the first argument that is present — for a hull
 *                          around several places, `{{#if (or (slot "a") (slot "b"))}}`
 *   (eq a b)               whether two values read the same — for a plaque
 *                          that would only repeat the title
 *
 * Registered on an isolated instance, never the global one, so that two
 * engines — or two tests — cannot leak a helper into each other.
 */
export function registerHelpers(hb: typeof Handlebars): void {
  hb.registerHelper("slot", slotHelper);
  hb.registerHelper("slot-label", slotLabelHelper);
  hb.registerHelper("slot-class", slotClassHelper);

  // Handlebars' own truthiness: `""`, `0`, `[]` and `false` are absent. A
  // rendered slot is a `SafeString` when it shows anything, `0` included.
  hb.registerHelper("or", function (...args: unknown[]) {
    const { positional } = helperArgs(args);
    return positional.find((value) => Handlebars.Utils.isEmpty(value) === false) ?? "";
  });

  hb.registerHelper("eq", function (...args: unknown[]) {
    const { positional } = helperArgs(args);
    return String(positional[0] ?? "") === String(positional[1] ?? "");
  });

  hb.registerHelper("t", function (...args: unknown[]) {
    const { argument: key, options } = helperArgs(args);
    const state = stateOf(options);
    if (typeof key !== "string") {
      state.diagnostics.warn(`{{t}} without a key in ${state.where}; rendering nothing`);
      return "";
    }
    return state.translations[key] ?? key;
  });

  // Helpers are synchronous and the source is not, so a file cannot be read
  // here: the engine reads every `{{asset "…"}}` literal it finds in a
  // template before the render, and this is the lookup. A path that is not
  // in the map was either reported missing when the system loaded, or is not
  // a literal — which the scan cannot see, so it cannot exist.
  hb.registerHelper("asset", function (...args: unknown[]) {
    const { argument: path, options } = helperArgs(args);
    const state = stateOf(options);
    if (typeof path !== "string") {
      state.diagnostics.warn(
        `{{asset}} without a path in ${state.where}; rendering nothing`
      );
      return "";
    }
    const call = `{{asset "${path}"}}`;
    const inline = inlineSwitch(options.hash, call, state);
    const asset = state.assets.get(path);
    if (asset === undefined) {
      state.diagnostics.warn(
        `${call} in ${state.where}: no such file, or the path is not a literal; rendering nothing`
      );
      return "";
    }
    if (!inline) return new Handlebars.SafeString(asset.uri);
    if (asset.text === undefined) {
      state.diagnostics.warn(
        `${call} in ${state.where}: inline=true, but only an SVG can be written into the markup; rendering nothing`
      );
      return "";
    }
    return new Handlebars.SafeString(asset.text);
  });
}

/**
 * The one switch `{{asset}}` takes: `inline`, as `true`, `false` or the
 * same as a string. Anything else in the hash is reported and ignored,
 * the way `{{slot}}` treats its hash.
 */
function inlineSwitch(
  hash: Record<string, unknown> | undefined,
  call: string,
  state: RenderState
): boolean {
  let inline = false;
  for (const [key, raw] of Object.entries(hash ?? {})) {
    if (key !== "inline") {
      state.diagnostics.warn(
        `${call}: "${key}" is not a switch (inline is); ignoring it`
      );
    } else if (raw === true || raw === "true") inline = true;
    else if (raw !== false && raw !== "false") {
      const shown = raw === undefined ? "(nothing)" : String(raw);
      state.diagnostics.warn(
        `${call}: inline=${shown} is neither true nor false; using the default`
      );
    }
  }
  return inline;
}
