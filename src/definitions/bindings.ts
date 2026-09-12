import type { PropertyDefsMap } from "./property-defs";

/**
 * Name → the other names that reach the same value.
 *
 * Two declarations put names in it, and both are on the property: `aliases:`,
 * the other spellings a note may write it under (`grip` → `griff`), and
 * `slot:`, the places on the card it fills (`front-stat-1a` → `grip`). Folding
 * a slot binding into the same map as an alias is what lets one read chain do
 * everything: the template asks for `front-stat-1a`, that reaches `grip`,
 * and `grip` reaches the `Griff:` the note actually wrote.
 *
 * A slot is declared nowhere but in the template that reads it. A card type
 * says which of its values fills a place (`slot:` — data, so YAML); the
 * template says what the place is and how it renders (`{{slot "front-stat-1a"
 * render="markdown"}}` — layout, so the template). No third list.
 */
export type AliasMap = Record<string, string[]>;

/** Build the map the runtime reads through: every alias, then every binding. */
export function buildAliasMap(defs: PropertyDefsMap): AliasMap {
  const out: AliasMap = {};

  for (const [canonical, def] of Object.entries(defs)) {
    if (def.aliases && def.aliases.length > 0) out[canonical] = [...def.aliases];
  }

  // When several properties fill one slot, the first the note actually sets
  // wins — and "first" is the order of the resolved map: inherited properties
  // before a layer's own, each in the order they were written.
  for (const [canonical, def] of Object.entries(defs)) {
    for (const slot of def.slot ?? []) {
      const names = out[slot] ?? (out[slot] = []);
      if (!names.includes(canonical)) names.push(canonical);
    }
  }

  return out;
}

/** Every name reachable from `start` by following alias edges, `start` included. */
export function aliasClosure(start: string, aliases: AliasMap): string[] {
  const seen = new Set<string>([start]);
  const queue = [start];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const next of aliases[current] ?? []) {
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return [...seen];
}

/**
 * alias → the canonical it belongs to. First canonical wins a collision: the
 * rules forbid declaring one name as an alias of two properties, but be
 * deterministic when someone does it anyway.
 */
export function reverseAliasMap(aliases: AliasMap): Map<string, string> {
  const out = new Map<string, string>();
  for (const [canonical, names] of Object.entries(aliases)) {
    for (const name of names) {
      if (!out.has(name)) out.set(name, canonical);
    }
  }
  return out;
}
