/** Plugin UI language. `"auto"` follows Obsidian's own setting. */
export type UiLanguage = "auto" | "en" | "de";

/** A system shipped with the plugin. */
export interface BundledSystemEntry {
  type: "bundled";
  id: string;
  active: boolean;
}

/** A system the user registered from a folder in their vault. */
export interface VaultSystemEntry {
  type: "vault";
  /**
   * Id read from the folder's `rpg-system.yaml` when the system was registered.
   *
   * The yaml stays the authority — it is read again on load and a divergence is
   * reported, never silently accepted. The copy kept here is what lets the
   * settings list, the on/off switch and the duplicate-id check work without
   * touching the disk, and what lets a system whose folder has gone missing
   * still appear as a named, broken entry instead of vanishing.
   */
  id: string;
  /** Vault-relative folder holding the system. */
  path: string;
  active: boolean;
}

/**
 * One entry per system, whatever its source. A discriminated union rather than
 * one shape with optional fields, so `path` exists exactly where it means
 * something.
 */
export type SystemEntry = BundledSystemEntry | VaultSystemEntry;

export interface CardForgeSettings {
  /**
   * The system registry. Systems are registered, never searched for — see
   * `.claude/plans/reimplementation.md` and the scope notes.
   *
   * Bundled entries are reconciled against the systems the build actually ships
   * (`reconcileSystemEntries`), so a system added by a plugin update arrives
   * active instead of invisibly missing.
   */
  systems: SystemEntry[];
  language: UiLanguage;
}

export const DEFAULT_SETTINGS: CardForgeSettings = {
  systems: [],
  language: "auto",
};
