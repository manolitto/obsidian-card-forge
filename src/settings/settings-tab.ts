import { App, Notice, normalizePath, PluginSettingTab, Setting } from "obsidian";
import type { PaperBackground } from "../definitions/deck-settings";
import type CardsmithPlugin from "../main";
import { copySystemIntoVault } from "../ui/copy-system";
import { SystemFileSuggest } from "../ui/system-file-suggest";
import { t } from "../ui/strings";
import { entriesAfterAdd, entriesAfterToggle } from "./system-registry";
import type { SystemEntry, UiLanguage } from "./types";

/*
 * The settings page: the system registry, then three preferences.
 *
 * Every registered system is one row — its name as its document says it
 * now, whatever its switch says, where it comes from, its switch, and
 * under it every message loading it produced, in the library's own
 * words, so a duplicate id shows its error on both rows and a broken
 * vault system says what is wrong with it. A bundled row offers *Copy into
 * vault*; a vault row *Remove*. A vault system is added by its root
 * document, read and checked on the spot, and either registered or refused
 * with the messages under the field.
 */
export class CardsmithSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private readonly plugin: CardsmithPlugin
  ) {
    super(app, plugin);
  }

  override display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName(t("settings.systems.heading"))
      .setDesc(t("settings.systems.desc"))
      .setHeading();
    for (const entry of this.plugin.settings.systems) this.systemRow(containerEl, entry);
    this.addField(containerEl);

    new Setting(containerEl).setName(t("settings.preferences.heading")).setHeading();
    this.preferences(containerEl);
  }

  private systemRow(parent: HTMLElement, entry: SystemEntry): void {
    const row = new Setting(parent).setClass("cs-system-row");
    // The name, and beside it the id a note writes in `system:`. Set as one,
    // since `setName` replaces the element's content.
    const name = (text: string): void => {
      row.setName(text);
      row.nameEl.createSpan({ cls: "cs-system-id", text: entry.id });
    };
    name(entry.id);
    // A block, not `=> name(text)` returning a component: every Obsidian
    // component has a `then(cb)` for chaining, so a promise resolved with
    // one is resolved with a thenable that resolves with itself — an
    // endless microtask loop no debugger can interrupt.
    void this.plugin.systems.nameOf(entry).then((text) => {
      name(text);
    });
    row.setDesc(
      entry.type === "bundled"
        ? t("settings.system.bundled")
        : t("settings.system.file", { path: entry.path })
    );
    row.addToggle((toggle) =>
      toggle.setValue(entry.active).onChange(async (value) => {
        // Switching on takes the id: any other entry claiming it goes off.
        this.plugin.settings.systems = entriesAfterToggle(
          this.plugin.settings.systems,
          entry,
          value
        );
        await this.plugin.saveSettings();
        this.display();
      })
    );
    if (entry.type === "bundled") {
      row.addButton((button) =>
        button
          .setButtonText(t("settings.system.copy"))
          .onClick(() => void this.copy(entry))
      );
    } else {
      row.addButton((button) =>
        button
          .setButtonText(t("settings.system.remove"))
          .setWarning()
          .onClick(async () => {
            this.plugin.settings.systems = this.plugin.settings.systems.filter(
              (candidate) => candidate !== entry
            );
            await this.plugin.saveSettings();
            this.display();
          })
      );
    }
    const messages = parent.createEl("ul", { cls: "cs-system-messages" });
    if (!entry.active) return;
    void this.plugin.systems.load(entry.id).then((result) => {
      for (const message of result.messages) messages.createEl("li", { text: message });
    });
  }

  /** The bundled system, loaded whatever its switch says, handed to the copy dialog. */
  private async copy(entry: SystemEntry): Promise<void> {
    const result = await this.plugin.systems.loadBundled(entry.id);
    if (!result.system) return;
    copySystemIntoVault(
      {
        app: this.app,
        entries: () => this.plugin.settings.systems,
        save: async (entries) => {
          this.plugin.settings.systems = entries;
          await this.plugin.saveSettings();
          this.display();
        },
        inspect: (path) => this.plugin.systems.inspectVaultDocument(path),
      },
      result.system
    );
  }

  private addField(parent: HTMLElement): void {
    let typed = "";
    const setting = new Setting(parent)
      .setClass("cs-system-row")
      .setName(t("settings.add.name"))
      .setDesc(t("settings.add.desc"));
    const messages = parent.createEl("ul", { cls: "cs-system-messages" });
    setting.addText((text) => {
      text
        .setPlaceholder(t("settings.add.placeholder"))
        .onChange((value) => (typed = value));
      new SystemFileSuggest(this.app, text.inputEl);
    });
    setting.addButton((button) =>
      button
        .setButtonText(t("settings.add.button"))
        .setCta()
        .onClick(async () => {
          messages.empty();
          const path = normalizePath(typed.trim());
          if (!path || path === "/") {
            messages.createEl("li", { text: t("settings.add.no-file") });
            return;
          }
          if (
            this.plugin.settings.systems.some(
              (entry) => entry.type === "vault" && entry.path === path
            )
          ) {
            messages.createEl("li", { text: t("settings.add.already", { path }) });
            return;
          }
          const verdict = await this.plugin.systems.inspectVaultDocument(path);
          if (!verdict.id) {
            for (const message of verdict.messages)
              messages.createEl("li", { text: message });
            return;
          }
          const { entries, switchedOff } = entriesAfterAdd(
            this.plugin.settings.systems,
            verdict.id,
            path
          );
          this.plugin.settings.systems = entries;
          await this.plugin.saveSettings();
          new Notice(t("settings.add.registered", { id: verdict.id, path }));
          if (switchedOff.length > 0) {
            new Notice(
              t("settings.add.replaced", { id: verdict.id, count: switchedOff.length })
            );
          }
          this.display();
        })
    );
  }

  private preferences(containerEl: HTMLElement): void {
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
