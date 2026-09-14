import { Plugin, type TAbstractFile } from "obsidian";
import { CardForgeSettingTab } from "./settings/settings-tab";
import { reconcileSystemEntries } from "./settings/system-registry";
import { DEFAULT_SETTINGS, type CardForgeSettings } from "./settings/types";
import { BUNDLED_IDS, SystemLibrary } from "./systems/library";

export default class CardForgePlugin extends Plugin {
  override settings: CardForgeSettings = { ...DEFAULT_SETTINGS };
  systems!: SystemLibrary;

  override async onload(): Promise<void> {
    await this.loadSettings();

    this.systems = new SystemLibrary(this.app.vault.adapter);
    this.systems.setEntries(this.settings.systems);

    // A vault system's files change while Obsidian runs; a bundled one's never do.
    const changed = (file: TAbstractFile): void => {
      this.systems.invalidate(file.path);
    };
    this.registerEvent(this.app.vault.on("modify", changed));
    this.registerEvent(this.app.vault.on("create", changed));
    this.registerEvent(this.app.vault.on("delete", changed));
    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        changed(file);
        this.systems.invalidate(oldPath);
      })
    );

    this.addSettingTab(new CardForgeSettingTab(this.app, this));
  }

  async loadSettings(): Promise<void> {
    const saved = Object.assign(
      {},
      DEFAULT_SETTINGS,
      await this.loadData()
    ) as CardForgeSettings;
    saved.systems = reconcileSystemEntries(saved.systems, BUNDLED_IDS);
    this.settings = saved;
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    this.systems.setEntries(this.settings.systems);
  }
}
