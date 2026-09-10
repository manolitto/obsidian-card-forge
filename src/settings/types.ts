/** Plugin UI language. `"auto"` follows Obsidian's own setting. */
export type UiLanguage = "auto" | "en" | "de";

/**
 * A system the user registered from a folder in their vault.
 *
 * Only the path is stored: the system's id and name come from its own
 * `rpg-system.yaml`, so they cannot drift from what the settings claim.
 */
export interface VaultSystemEntry {
  /** Vault-relative folder holding the system. */
  path: string;
  enabled: boolean;
}

export interface CardForgeSettings {
  /**
   * Bundled systems the user switched off. Storing the *disabled* ones rather
   * than the enabled ones means a system added by a plugin update arrives
   * enabled instead of invisibly missing.
   */
  disabledBundledSystems: string[];

  /**
   * Systems registered from vault folders. There is no auto-detection — a
   * folder becomes a system only by being listed here, which is what lets the
   * plugin validate it at the moment it is added rather than silently
   * half-loading it later.
   */
  vaultSystems: VaultSystemEntry[];

  language: UiLanguage;
}

export const DEFAULT_SETTINGS: CardForgeSettings = {
  disabledBundledSystems: [],
  vaultSystems: [],
  language: "auto",
};
