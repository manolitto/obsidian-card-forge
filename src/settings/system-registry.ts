import type { SystemEntry } from "./types";

/**
 * Bring the saved registry in line with the systems this build ships.
 *
 * The saved list is the authority on *state* (order, active flags), never on
 * which bundled systems exist — that is decided at build time. So:
 *
 *   - a bundled system the user has never seen is appended, active
 *   - a bundled entry for a system no longer shipped is dropped
 *   - vault entries pass through untouched, in place
 *
 * Without this, a system added by a plugin update would simply be absent from
 * every picker, with nothing to point at.
 */
export function reconcileSystemEntries(
  saved: readonly SystemEntry[],
  bundledIds: readonly string[]
): SystemEntry[] {
  const shipped = new Set(bundledIds);
  const kept = saved.filter((e) => e.type !== "bundled" || shipped.has(e.id));
  const known = new Set(kept.filter((e) => e.type === "bundled").map((e) => e.id));

  const added: SystemEntry[] = bundledIds
    .filter((id) => !known.has(id))
    .map((id) => ({ type: "bundled", id, active: true }));

  return [...kept, ...added];
}

/**
 * Ids claimed by more than one *active* entry, in first-seen order.
 *
 * The invariant is about what is switched on, not about ids in the abstract:
 * that is what lets a vault copy carry the original's id while the bundled
 * original sits switched off. A duplicate is a hard error naming both entries,
 * never a silent "first one wins" — that would be shadowing through the back
 * door, which is the mechanism this design removed.
 */
export function findDuplicateActiveIds(entries: readonly SystemEntry[]): string[] {
  const seen = new Set<string>();
  const duplicated = new Set<string>();
  for (const entry of entries) {
    if (!entry.active) continue;
    if (seen.has(entry.id)) duplicated.add(entry.id);
    seen.add(entry.id);
  }
  return [...duplicated];
}
