import { App, PluginSettingTab, Setting } from "obsidian";
import type CardForgePlugin from "../main";
import type { UiLanguage } from "./types";

export class CardForgeSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private readonly plugin: CardForgePlugin
  ) {
    super(app, plugin);
  }

  override display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // The system list — bundled systems with an on/off switch, registered vault
    // systems, and the "copy a bundled system into the vault" action — lands
    // here in phase 7. See .claude/plans/reimplementation.md.

    new Setting(containerEl)
      .setName("Language")
      .setDesc("Language of the plugin's own interface.")
      .addDropdown((dropdown) =>
        dropdown
          .addOptions({ auto: "Follow Obsidian", en: "English", de: "Deutsch" })
          .setValue(this.plugin.settings.language)
          .onChange(async (value) => {
            this.plugin.settings.language = value as UiLanguage;
            await this.plugin.saveSettings();
          })
      );
  }
}
