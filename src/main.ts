import {
  getLanguage,
  MarkdownView,
  Platform,
  Plugin,
  type Editor,
  type TAbstractFile,
} from "obsidian";
import { DeckExporter, type ExportFormat } from "./export/exporter";
import { VaultDeckSource } from "./deck/vault-source";
import { CardsmithSettingTab } from "./settings/settings-tab";
import { reconcileSystemEntries } from "./settings/system-registry";
import { DEFAULT_SETTINGS, type CardsmithSettings } from "./settings/types";
import { CardRenderer } from "./render/renderer";
import { VaultImageSource } from "./render/vault-images";
import { BUNDLED_IDS, SystemLibrary } from "./systems/library";
import { TemplateEngine } from "./templates/engine";
import { cardBlockProcessor } from "./ui/card-block";
import { deckBlockProcessor } from "./ui/deck-block";
import { DECK_VIEW_TYPE, DeckView, openDeckView } from "./ui/deck-view";
import { notice, runExport } from "./ui/export-run";
import { buildDeckBlock } from "./ui/insert-deck";
import { buildCardBlock, insertAtCursor, type InsertMode } from "./ui/insert-card";
import { pickSystemAndCardType } from "./ui/pickers";
import { PropertyReferenceModal } from "./ui/property-reference";
import { resolveUiLanguage, setUiLanguage, t, uiLanguage } from "./ui/strings";

export default class CardsmithPlugin extends Plugin {
  override settings: CardsmithSettings = { ...DEFAULT_SETTINGS };
  systems!: SystemLibrary;
  /** One renderer for every surface — the preview, the deck view, the export. */
  renderer!: CardRenderer;
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

    this.renderer = new CardRenderer(
      new TemplateEngine(),
      new VaultImageSource(this.app)
    );
    this.registerMarkdownCodeBlockProcessor(
      "cardsmith",
      cardBlockProcessor({
        app: this.app,
        systems: this.systems,
        renderer: this.renderer,
        previewHeight: () => this.settings.previewHeight,
      })
    );

    const source = new VaultDeckSource(this.app);
    this.exporter = new DeckExporter(
      this.app,
      this.systems,
      this.renderer,
      source,
      () => this.settings.paperBackground,
      this.manifest.dir ?? ""
    );
    this.registerMarkdownCodeBlockProcessor(
      "cardsmith-deck",
      deckBlockProcessor({
        app: this.app,
        systems: this.systems,
        source,
        exporter: this.exporter,
        openPreview: (file) => openDeckView(this.app, file),
      })
    );
    this.registerView(DECK_VIEW_TYPE, (leaf) => new DeckView(leaf, this.exporter));
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

    this.addCommand({
      id: "preview-deck",
      name: t("command.preview-deck"),
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || file.extension !== "md") return false;
        if (!checking) void openDeckView(this.app, file);
        return true;
      },
    });
    this.addCommand({
      id: "insert-empty-card",
      name: t("command.insert-empty"),
      editorCallback: (editor) => void this.insertCard(editor, "empty"),
    });
    this.addCommand({
      id: "insert-sample-card",
      name: t("command.insert-sample"),
      editorCallback: (editor) => void this.insertCard(editor, "sample"),
    });
    this.addCommand({
      id: "insert-deck-block",
      name: t("command.insert-deck"),
      editorCallback: (editor) => void this.insertDeck(editor),
    });
    this.addCommand({
      id: "property-reference",
      name: t("command.property-reference"),
      callback: () => void this.showReference(),
    });

    this.addSettingTab(new CardsmithSettingTab(this.app, this));
  }

  private async insertCard(editor: Editor, mode: InsertMode): Promise<void> {
    const picked = await pickSystemAndCardType(
      this.app,
      this.systems,
      this.settings.systems
    );
    if (!picked) return;
    insertAtCursor(
      editor,
      buildCardBlock(picked.system, picked.cardType, uiLanguage(), mode)
    );
  }

  private async showReference(): Promise<void> {
    // Captured before the pickers open: they take the focus with them.
    const target = this.app.workspace.getActiveViewOfType(MarkdownView);
    const picked = await pickSystemAndCardType(
      this.app,
      this.systems,
      this.settings.systems
    );
    if (!picked) return;
    new PropertyReferenceModal(
      this.app,
      picked.system,
      picked.cardType,
      uiLanguage(),
      target
    ).open();
  }

  /** The active note is the deck; the command is offered when there is one and the platform can. */
  private exportDeck(
    format: ExportFormat,
    checking: boolean,
    available: boolean
  ): boolean {
    const file = this.app.workspace.getActiveFile();
    if (!available || !file || file.extension !== "md") return false;
    if (!checking) {
      const progress = notice(t("progress.reading"), 0);
      void runExport(this.exporter, file, format, (message) =>
        progress.setMessage(`Cardsmith: ${message}`)
      ).finally(() => progress.hide());
    }
    return true;
  }

  private async insertDeck(editor: Editor): Promise<void> {
    const picked = await pickSystemAndCardType(
      this.app,
      this.systems,
      this.settings.systems
    );
    if (!picked) return;
    insertAtCursor(
      editor,
      buildDeckBlock(picked.system.id, [picked.cardType.declaration.id], uiLanguage())
    );
  }

  async loadSettings(): Promise<void> {
    const saved = Object.assign(
      {},
      DEFAULT_SETTINGS,
      await this.loadData()
    ) as CardsmithSettings;
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
