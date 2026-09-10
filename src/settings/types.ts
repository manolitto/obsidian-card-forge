/** Plugin UI language. `"auto"` follows Obsidian's own setting. */
export type UiLanguage = "auto" | "en" | "de";

export interface CardForgeSettings {
  /**
   * Vault folder holding system definitions that extend or override the
   * bundled ones. Relative to the vault root.
   */
  definitionsFolder: string;
  language: UiLanguage;
}

export const DEFAULT_SETTINGS: CardForgeSettings = {
  definitionsFolder: "card-forge",
  language: "auto",
};
