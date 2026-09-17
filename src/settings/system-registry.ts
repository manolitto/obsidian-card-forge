import type { SystemEntry } from "./types";

/**
 * Bring the saved registry in line with the systems this build ships.
 *
 * The saved list is the authority on *state* (order, active flags), never on
 * which bundled systems exist — that is decided at build time — and never on
 * an entry's shape. So:
 *
 *   - a bundled system the user has never seen is appended, active
 *   - a bundled entry for a system no longer shipped is dropped
 *   - vault entries stay, in place
 *   - every entry is rebuilt from its known keys, so a key the saved file
 *     carries beyond them — written by another version of the plugin, or by
 *     hand — is gone after the next save rather than kept forever
 *
 * Without this, a system added by a plugin update would simply be absent from
 * every picker, with nothing to point at.
 */
export function reconcileSystemEntries(
  saved: readonly SystemEntry[],
  bundledIds: readonly string[]
): SystemEntry[] {
  const shipped = new Set(bundledIds);
  const kept = saved.flatMap((e): SystemEntry[] => {
    if (e.type === "vault")
      return [{ type: "vault", id: e.id, path: e.path, active: e.active }];
    return shipped.has(e.id) ? [{ type: "bundled", id: e.id, active: e.active }] : [];
  });
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

/**
 * The registry after switching `entry` on or off. Switching on is the one
 * act with a single meaning — use this one now — so every other active
 * entry claiming the same id goes off with it, as it does after a copy
 * that keeps the id; the settings page then never produces the state the
 * library refuses. Switching off touches nothing else.
 */
export function entriesAfterToggle(
  entries: readonly SystemEntry[],
  entry: SystemEntry,
  active: boolean
): SystemEntry[] {
  return entries.map((candidate) => {
    if (candidate === entry) return { ...candidate, active };
    return active && candidate.active && candidate.id === entry.id
      ? { ...candidate, active: false }
      : candidate;
  });
}

/**
 * The registry after a copy: a vault entry for the copied root document, active. With
 * the original's id kept, the bundled entry goes inactive — the invariant
 * is about enabled systems, and switching back is one click. With a new
 * id both stay active; nothing is duplicated.
 */
export function entriesAfterCopy(
  entries: readonly SystemEntry[],
  bundledId: string,
  copyId: string,
  path: string
): SystemEntry[] {
  const kept = entries.map((entry) =>
    entry.type === "bundled" && entry.id === bundledId && copyId === bundledId
      ? { ...entry, active: false }
      : entry
  );
  return [...kept, { type: "vault", id: copyId, path, active: true }];
}

/** What a system id may be: lowercase letters, digits and hyphens, as every bundled one is. */
export function isSystemId(id: string): boolean {
  return /^[a-z0-9][a-z0-9-]*$/.test(id);
}
