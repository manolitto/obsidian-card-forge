import Handlebars from "handlebars";
import { helperArgs, stateOf } from "./context";
import { slotClassHelper, slotHelper, slotLabelHelper } from "./slot";

/**
 * The helpers a face template may call. Five lookups and two comparisons:
 *
 *   {{slot "name" …}}      the value at a place, rendered — see `slot.ts`
 *   {{slot-label "name"}}  its caption, or nothing
 *   {{slot-class "name"}}  a class token chosen by what it shows
 *   {{t "key"}}            a translation, or the KEY when there is none — a
 *                          visible marker an author can spot on the card
 *   {{asset "path"}}       a file of the system as a `data:` URI
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
    const uri = state.assets.get(path);
    if (uri === undefined) {
      state.diagnostics.warn(
        `{{asset "${path}"}} in ${state.where}: no such file, or the path is not a literal; rendering nothing`
      );
      return "";
    }
    return new Handlebars.SafeString(uri);
  });
}
