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

    new Setting(containerEl)
      .setName("Definitions folder")
      .setDesc("Vault folder holding system definitions that extend the bundled ones.")
      .addText((text) =>
        text
          .setPlaceholder("card-forge")
          .setValue(this.plugin.settings.definitionsFolder)
          .onChange(async (value) => {
            this.plugin.settings.definitionsFolder = value.trim();
            await this.plugin.saveSettings();
          })
      );

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
