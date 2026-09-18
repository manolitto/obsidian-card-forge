import type { PaperBackground } from "../definitions/deck-settings";

/** Plugin UI language. `"auto"` follows Obsidian's own setting. */
export type UiLanguage = "auto" | "en" | "de";

/** A system shipped with the plugin. */
export interface BundledSystemEntry {
  type: "bundled";
  id: string;
  active: boolean;
}

/** A system the user registered from a root document in their vault. */
export interface VaultSystemEntry {
  type: "vault";
  /**
   * Id read from the root document when the system was registered.
   *
   * The yaml stays the authority — it is read again on load and a divergence is
   * reported, never silently accepted. The copy kept here is what lets the
   * settings list, the on/off switch and the duplicate-id check work without
   * touching the disk, and what lets a system whose folder has gone missing
   * still appear as a named, broken entry instead of vanishing.
   */
  id: string;
  /**
   * Vault-relative path of the root document. The folder holding it is the
   * system; the file's name is whatever the user gave it.
   */
  path: string;
  active: boolean;
}

/**
 * One entry per system, whatever its source. A discriminated union rather than
 * one shape with optional fields, so `path` exists exactly where it means
 * something.
 */
export type SystemEntry = BundledSystemEntry | VaultSystemEntry;

export interface CardsmithSettings {
  /**
   * The system registry. Systems are registered, never searched for: an
   * explicit entry is validated when it is added and its error reported where
   * someone is looking, where a folder walk would meet half-built systems at a
   * moment nobody is watching.
   *
   * Bundled entries are reconciled against the systems the build actually ships
   * (`reconcileSystemEntries`), so a system added by a plugin update arrives
   * active instead of invisibly missing.
   */
  systems: SystemEntry[];
  language: UiLanguage;
  /**
   * Height of a card in the in-note preview, in pixels — the layer under a
   * note's own `display-height`.
   */
  previewHeight: number;
  /**
   * Whether a deck prints the system's textures — the layer under a deck's
   * own `paper-background`. A reader's preference, not a system's: a system
   * ships the textures, but whether they are printed is not its call.
   */
  paperBackground: PaperBackground;
}

export const DEFAULT_SETTINGS: CardsmithSettings = {
  systems: [],
  language: "auto",
  previewHeight: 350,
  paperBackground: "textured",
};
