import { FileSystemAdapter, normalizePath, Platform, TFile, type App } from "obsidian";
import { buildDeck, type Deck } from "../deck/pipeline";
import type { DeckSource } from "../deck/source";
import type { PaperBackground } from "../definitions/deck-settings";
import { collectDiagnostics } from "../definitions/diagnostics";
import type { CardRenderer } from "../render/renderer";
import type { SystemLibrary } from "../systems/library";
import { t } from "../ui/strings";
import { deckDocument, type DeckDocument } from "./document";
import { printDeckPdf, type TempFile } from "./pdf";

export type ExportFormat = "pdf" | "html";

/** What an export produced, for whoever started it to announce. */
export interface ExportResult {
  path: string;
  /** The written file, in the vault's index the moment it exists. */
  file: TFile;
  cards: number;
  pages: number;
  /** Names of the cards cut at the type floor. */
  clipped: string[];
  /** Everything the build reported. */
  warnings: string[];
}

/** Progress as words, for the caller to put wherever it draws — a notice, a button, a toolbar. */
export type ExportProgress = (message: string) => void;

/**
 * A deck note built and written: the deck, composed into its document, as
 * a PDF or an HTML file in the vault. Every surface that exports a deck
 * goes through `run`; a surface that only wants to look at one goes
 * through `build`. Progress is drawn by the caller; the PDF is opened
 * beside the deck note, since a printed sheet is what one exports a deck
 * for.
 */
export class DeckExporter {
  constructor(
    private readonly app: App,
    private readonly systems: SystemLibrary,
    private readonly renderer: CardRenderer,
    private readonly source: DeckSource,
    /** The reader's default for `paper-background` — the layer under a deck's own. */
    private readonly paperBackground: () => PaperBackground,
    /** The plugin's folder, vault-relative, for the print window's temp file. */
    private readonly pluginDir: string
  ) {}

  /** The deck and its document, without writing anything. Throws the message the user should see. */
  async build(
    file: TFile,
    progress: ExportProgress
  ): Promise<{ deck: Deck; doc: DeckDocument; warnings: string[] }> {
    progress(t("progress.reading"));
    const diagnostics = collectDiagnostics();
    const deck = await buildDeck(
      await this.app.vault.cachedRead(file),
      file.path,
      this.source,
      this.systems,
      this.renderer,
      document,
      diagnostics,
      (phase, done, total) => {
        progress(
          t(phase === "render" ? "progress.rendering" : "progress.layout", {
            done,
            total,
          })
        );
      }
    );
    deck.settings.paperBackground ??= this.paperBackground();
    return {
      deck,
      doc: deckDocument(deck, file.basename),
      warnings: [...diagnostics.messages],
    };
  }

  async run(
    file: TFile,
    format: ExportFormat,
    progress: ExportProgress
  ): Promise<ExportResult> {
    const { deck, doc, warnings } = await this.build(file, progress);
    const path = normalizePath(deck.outputPath[format]);
    progress(t("progress.writing", { path }));

    const written =
      format === "pdf"
        ? await this.write(path, await printDeckPdf(doc, this.tempFile()))
        : await this.write(path, doc.html);
    if (format === "pdf") {
      await this.app.workspace.getLeaf("split").openFile(written);
    } else {
      await this.openHtml(written);
    }

    return {
      path,
      file: written,
      cards: deck.cards.length,
      pages: doc.pageCount,
      clipped: deck.clipped,
      warnings,
    };
  }

  /** Write into the vault, creating the folders on the way; the result is indexed at once. */
  private async write(path: string, content: string | ArrayBuffer): Promise<TFile> {
    const vault = this.app.vault;
    const segments = path.split("/").slice(0, -1);
    for (let i = 1; i <= segments.length; i++) {
      const folder = segments.slice(0, i).join("/");
      if (!vault.getAbstractFileByPath(folder)) await vault.createFolder(folder);
    }
    const existing = vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) {
      if (typeof content === "string") await vault.modify(existing, content);
      else await vault.modifyBinary(existing, content);
      return existing;
    }
    return typeof content === "string"
      ? vault.create(path, content)
      : vault.createBinary(path, content);
  }

  /**
   * Where an HTML export goes once it is written. Obsidian shows no HTML
   * itself, so on the desktop the file opens in whatever the system opens
   * HTML with — the browser, where the print dialog is — and on a phone it
   * goes to the share sheet, from where it reaches a browser, a printer or
   * the file system. Where neither is possible the notice's path is all
   * there is, and the file waits beside the note.
   */
  private async openHtml(file: TFile): Promise<void> {
    const adapter = this.app.vault.adapter;
    if (Platform.isDesktopApp && adapter instanceof FileSystemAdapter) {
      const shell = loadShell();
      if (shell) {
        await shell.openPath(`${adapter.getBasePath()}/${file.path}`);
        return;
      }
    }
    if (typeof navigator.share === "function") {
      const shared = new File([await this.app.vault.read(file)], file.name, {
        type: "text/html",
      });
      if (navigator.canShare?.({ files: [shared] })) {
        // A share sheet the user closes again is not an error.
        await navigator
          .share({ files: [shared], title: file.basename })
          .catch(() => undefined);
      }
    }
  }

  /**
   * The document's file for the print window, under the plugin's own folder
   * so it lands in no one's way — through the adapter, which on the desktop
   * is the file system and knows its absolute root.
   */
  private tempFile(): TempFile {
    const adapter = this.app.vault.adapter;
    if (!(adapter instanceof FileSystemAdapter)) {
      throw new Error(
        "The PDF export needs Obsidian's desktop app; the HTML export works everywhere."
      );
    }
    const folder = normalizePath(`${this.pluginDir}/tmp`);
    const path = `${folder}/deck.html`;
    return {
      absolutePath: `${adapter.getBasePath()}/${path}`,
      write: async (html) => {
        if (!(await adapter.exists(folder))) await adapter.mkdir(folder);
        await adapter.write(path, html);
      },
      remove: () => adapter.remove(path),
    };
  }
}

/** What of Electron's shell the exporter touches. */
interface Shell {
  openPath(path: string): Promise<string>;
}

/** The renderer's `require`, which the desktop app provides and a phone does not. */
declare const require: (id: string) => unknown;

/** Electron's shell on the desktop, `undefined` anywhere else. */
function loadShell(): Shell | undefined {
  try {
    // A dynamic require: the module exists only in Obsidian's desktop app.
    return (require("electron") as { shell: Shell }).shell;
  } catch {
    return undefined;
  }
}
