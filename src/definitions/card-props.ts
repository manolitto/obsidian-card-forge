import { aliasClosure, reverseAliasMap, type AliasMap } from "./bindings";
import type { PropertyDefsMap } from "./property-defs";

export interface PrepareCardPropsOptions {
  /** Both binding directions, already folded — see `buildAliasMap`. */
  aliases: AliasMap;
  /** The resolved definitions, for `default:`. */
  defs?: PropertyDefsMap;
  /** The note's basename, which `name` falls back to. */
  fileName?: string;
}

/**
 * Turn a note's raw properties into the object a card renders through: keys
 * folded to lowercase, declared defaults filled in, and the whole thing wrapped
 * so canonical and alias names reach the same value.
 *
 * Nothing here reshapes a value. A note that writes one trait where the card
 * shows a list is the template's tolerance to extend — `{{#slot}}` lifts the
 * scalar when it renders — not this function's, which would have to guess the
 * shape from a declaration nothing else reads.
 *
 * The caller's object is not touched — a fresh copy is prepared and wrapped.
 */
export function prepareCardProps(
  raw: Record<string, unknown>,
  options: PrepareCardPropsOptions
): Record<string, unknown> {
  const { aliases, defs, fileName } = options;

  const props: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) props[key.toLowerCase()] = value;

  if (fileName !== undefined) applyNameFallback(props, fileName, aliases);
  if (defs) applyDefaults(props, defs, aliases);

  return aliasResolvingProxy(props, aliases);
}

/**
 * If neither `name` nor any of its aliases carries a value, fill it from the
 * note's filename, so a template can write `{{slots.title}}` without guarding.
 *
 * Runs on the underlying object, before the proxy exists, so it has to consult
 * the alias map by hand rather than read through it.
 */
function applyNameFallback(
  props: Record<string, unknown>,
  fileName: string,
  aliases: AliasMap
): void {
  if (hasUsableValue(props, "name")) return;
  for (const alias of aliases["name"] ?? []) {
    if (hasUsableValue(props, alias)) return;
  }
  props["name"] = fileName;
}

/**
 * Fill in every declared `default:` the note did not answer.
 *
 * "Did not answer" means neither the canonical key nor anything reachable from
 * it carries a usable value — an empty string counts as unset, the same test
 * the filename fallback uses. The alias walk is why this needs care: the
 * default is written onto the canonical, so a note that answered under a German
 * spelling would otherwise be overruled by a value invented here.
 *
 * The value is written onto the object rather than synthesized on read, so
 * everything downstream sees an ordinary property — the slot chain resolves it,
 * the list coercion applies to it, and it answers queries rather than only
 * appearing on the card.
 */
function applyDefaults(
  props: Record<string, unknown>,
  defs: PropertyDefsMap,
  aliases: AliasMap
): void {
  for (const [canonical, def] of Object.entries(defs)) {
    if (!("default" in def)) continue;
    const answered = aliasClosure(canonical, aliases).some((key) =>
      hasUsableValue(props, key)
    );
    if (!answered) props[canonical] = def.default;
  }
}

function hasUsableValue(props: Record<string, unknown>, key: string): boolean {
  if (!Object.prototype.hasOwnProperty.call(props, key)) return false;
  const value = props[key];
  return value !== undefined && value !== null && value !== "";
}

/**
 * Wrap the props so canonical and alias names reach the same value on read.
 *
 * Read order for a name:
 *
 * 1. A direct hit wins. Both a canonical and an alias return their own value
 *    when the note set them explicitly, so a note that sets both keeps both —
 *    unusual, but the author meant it and nothing is silently dropped.
 * 2. A canonical with no value of its own walks its alias list in declaration
 *    order, direct hits first across the whole list, and only then follows each
 *    alias transitively — an alias may itself be a canonical carrying aliases,
 *    which is what makes a slot reach a property's German spelling. Cycle-guarded.
 * 3. An alias with no value of its own walks to its canonical, then to the
 *    canonical's other aliases.
 *
 * Handlebars gates a `props.x` lookup behind `hasOwnProperty`, so `get` alone
 * would never fire for an alias. The `getOwnPropertyDescriptor` trap answers
 * for anything the alias map resolves; `ownKeys` still passes through to the
 * target, so iteration shows the note's real keys and nothing invented.
 */
function aliasResolvingProxy(
  target: Record<string, unknown>,
  aliases: AliasMap
): Record<string, unknown> {
  const reverse = reverseAliasMap(aliases);
  return new Proxy(target, {
    get(t, prop, receiver) {
      if (typeof prop !== "string") return Reflect.get(t, prop, receiver);
      if (Object.prototype.hasOwnProperty.call(t, prop)) return t[prop];
      return resolveByAlias(t, prop, aliases, reverse);
    },
    has(t, prop) {
      if (typeof prop !== "string") return Reflect.has(t, prop);
      if (Object.prototype.hasOwnProperty.call(t, prop)) return true;
      return resolveByAlias(t, prop, aliases, reverse) !== undefined;
    },
    getOwnPropertyDescriptor(t, prop) {
      if (typeof prop !== "string") return Reflect.getOwnPropertyDescriptor(t, prop);
      const direct = Object.getOwnPropertyDescriptor(t, prop);
      if (direct) return direct;
      const resolved = resolveByAlias(t, prop, aliases, reverse);
      if (resolved === undefined) return undefined;
      return { value: resolved, writable: true, enumerable: false, configurable: true };
    },
  });
}

function resolveByAlias(
  target: Record<string, unknown>,
  key: string,
  aliases: AliasMap,
  reverse: Map<string, string>,
  visited?: Set<string>
): unknown {
  const seen = visited ?? new Set<string>();
  if (seen.has(key)) return undefined;
  seen.add(key);

  const names = aliases[key];
  if (names) {
    // Direct hits first, across the whole list, so declaration order decides
    // between two names the note could plausibly have written. Only when all of
    // them miss does the walk go a level deeper.
    for (const name of names) {
      if (Object.prototype.hasOwnProperty.call(target, name)) return target[name];
    }
    for (const name of names) {
      const value = resolveByAlias(target, name, aliases, reverse, seen);
      if (value !== undefined) return value;
    }
    return undefined;
  }

  const canonical = reverse.get(key);
  if (canonical === undefined) return undefined;
  if (Object.prototype.hasOwnProperty.call(target, canonical)) return target[canonical];
  for (const sibling of aliases[canonical] ?? []) {
    if (sibling === key) continue;
    if (Object.prototype.hasOwnProperty.call(target, sibling)) return target[sibling];
  }
  return undefined;
}
