import { Plugin } from "obsidian";
import { CardForgeSettingTab } from "./settings/settings-tab";
import { DEFAULT_SETTINGS, type CardForgeSettings } from "./settings/types";

export default class CardForgePlugin extends Plugin {
  override settings: CardForgeSettings = { ...DEFAULT_SETTINGS };

  override async onload(): Promise<void> {
    await this.loadSettings();
    this.addSettingTab(new CardForgeSettingTab(this.app, this));
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
