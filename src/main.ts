import { getLanguage, Platform, Plugin, type TAbstractFile } from "obsidian";
import { DeckExporter, type ExportFormat } from "./export/exporter";
import { CardForgeSettingTab } from "./settings/settings-tab";
import { reconcileSystemEntries } from "./settings/system-registry";
import { DEFAULT_SETTINGS, type CardForgeSettings } from "./settings/types";
import { BUNDLED_IDS, SystemLibrary } from "./systems/library";
import { resolveUiLanguage, setUiLanguage, t } from "./ui/strings";

export default class CardForgePlugin extends Plugin {
  override settings: CardForgeSettings = { ...DEFAULT_SETTINGS };
  systems!: SystemLibrary;
  exporter!: DeckExporter;

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

    this.exporter = new DeckExporter(this.app, this.systems, this.manifest.dir ?? "");
    this.addCommand({
      id: "export-deck-pdf",
      name: t("command.export-pdf"),
      checkCallback: (checking) => this.exportDeck("pdf", checking, Platform.isDesktop),
    });
    this.addCommand({
      id: "export-deck-html",
      name: t("command.export-html"),
      checkCallback: (checking) => this.exportDeck("html", checking, true),
    });

    this.addSettingTab(new CardForgeSettingTab(this.app, this));
  }

  /** The active note is the deck; the command is offered when there is one and the platform can. */
  private exportDeck(
    format: ExportFormat,
    checking: boolean,
    available: boolean
  ): boolean {
    const file = this.app.workspace.getActiveFile();
    if (!available || !file || file.extension !== "md") return false;
    if (!checking) void this.exporter.run(file, format);
    return true;
  }

  async loadSettings(): Promise<void> {
    const saved = Object.assign(
      {},
      DEFAULT_SETTINGS,
      await this.loadData()
    ) as CardForgeSettings;
    saved.systems = reconcileSystemEntries(saved.systems, BUNDLED_IDS);
    this.settings = saved;
    setUiLanguage(resolveUiLanguage(saved.language, getLanguage()));
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    this.systems.setEntries(this.settings.systems);
    setUiLanguage(resolveUiLanguage(this.settings.language, getLanguage()));
  }
}
