import { App, PluginSettingTab, Setting } from "obsidian";
import type { PaperBackground } from "../definitions/deck-settings";
import type CardForgePlugin from "../main";
import { t } from "../ui/strings";
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

    // The system registry — bundled systems with an on/off switch, vault
    // systems added by folder, the copy-into-vault action — is not built yet.

    new Setting(containerEl).setName(t("settings.preferences.heading")).setHeading();

    new Setting(containerEl)
      .setName(t("settings.preview-height.name"))
      .setDesc(t("settings.preview-height.desc"))
      .addText((text) =>
        text
          .setValue(String(this.plugin.settings.previewHeight))
          .onChange(async (value) => {
            const height = Number(value);
            if (!Number.isFinite(height) || height <= 0) return;
            this.plugin.settings.previewHeight = height;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(t("settings.paper-background.name"))
      .setDesc(t("settings.paper-background.desc"))
      .addDropdown((dropdown) =>
        dropdown
          .addOptions({
            textured: t("settings.paper-background.textured"),
            plain: t("settings.paper-background.plain"),
          })
          .setValue(this.plugin.settings.paperBackground)
          .onChange(async (value) => {
            this.plugin.settings.paperBackground = value as PaperBackground;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(t("settings.language.name"))
      .setDesc(t("settings.language.desc"))
      .addDropdown((dropdown) =>
        dropdown
          .addOptions({
            auto: t("settings.language.auto"),
            en: t("settings.language.en"),
            de: t("settings.language.de"),
          })
          .setValue(this.plugin.settings.language)
          .onChange(async (value) => {
            this.plugin.settings.language = value as UiLanguage;
            await this.plugin.saveSettings();
            // The page is in the language it was drawn in; redraw it.
            this.display();
          })
      );
  }
}
