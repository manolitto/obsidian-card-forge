import { FileSystemAdapter, Notice, type App, type TFile } from "obsidian";
import { buildDeck, type Deck } from "../deck/pipeline";
import { VaultDeckSource } from "../deck/vault-source";
import { collectDiagnostics } from "../definitions/diagnostics";
import { CardRenderer } from "../render/renderer";
import { VaultImageSource } from "../render/vault-images";
import type { SystemLibrary } from "../systems/library";
import { TemplateEngine } from "../templates/engine";
import { deckDocument } from "./document";
import { printDeckPdf } from "./pdf";

export type ExportFormat = "pdf" | "html";

/**
 * The export command: the active note's deck, built, composed, written
 * beside it as a PDF or an HTML file. Everything the pipeline needs from
 * the vault is wired here once — the renderer over the vault's pictures,
 * the deck source over its files — and what the user hears is a notice:
 * progress while it runs, the saved path when it is done, the cards cut at
 * the type floor, and why when it could not be done.
 */
export class DeckExporter {
  private readonly renderer: CardRenderer;
  private readonly source: VaultDeckSource;

  constructor(
    private readonly app: App,
    private readonly systems: SystemLibrary,
    /** The plugin's folder, vault-relative, for the print window's temp file. */
    private readonly pluginDir: string
  ) {
    this.renderer = new CardRenderer(new TemplateEngine(), new VaultImageSource(app));
    this.source = new VaultDeckSource(app);
  }

  async run(file: TFile, format: ExportFormat): Promise<void> {
    const progress = new Notice("Card Forge: reading the deck…", 0);
    try {
      const deck = await this.build(file, progress);
      const doc = deckDocument(deck, file.basename);
      const path = deck.outputPath[format];

      progress.setMessage(`Card Forge: writing ${path}…`);
      if (format === "pdf") {
        await this.write(path, await printDeckPdf(doc, this.tempPath()));
      } else {
        await this.write(path, doc.html);
      }

      new Notice(
        `Card Forge: ${deck.cards.length} cards on ${doc.pageCount} pages — ${path}`,
        8000
      );
      if (deck.clipped.length > 0) {
        new Notice(
          `Card Forge: cut at the type floor — ${deck.clipped.join(", ")}`,
          12000
        );
      }
    } catch (error) {
      new Notice(
        `Card Forge: ${error instanceof Error ? error.message : String(error)}`,
        12000
      );
    } finally {
      progress.hide();
    }
  }

  private async build(file: TFile, progress: Notice): Promise<Deck> {
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
        progress.setMessage(
          `Card Forge: ${phase === "render" ? "rendering" : "laying out"} ${done} / ${total}…`
        );
      }
    );
    if (diagnostics.messages.length > 0) {
      for (const message of diagnostics.messages) console.warn(`[Card Forge] ${message}`);
      new Notice(
        `Card Forge: ${diagnostics.messages.length} ${
          diagnostics.messages.length === 1 ? "warning" : "warnings"
        } — see the developer console`,
        8000
      );
    }
    return deck;
  }

  /** Write into the vault, creating the folder on the way. */
  private async write(path: string, content: string | ArrayBuffer): Promise<void> {
    const adapter = this.app.vault.adapter;
    const folder = path.slice(0, path.lastIndexOf("/"));
    if (folder && !(await adapter.exists(folder))) await adapter.mkdir(folder);
    if (typeof content === "string") await adapter.write(path, content);
    else await adapter.writeBinary(path, content);
  }

  /** An absolute path under the plugin's folder; the PDF export is desktop-only, where the adapter has one. */
  private tempPath(): string {
    const adapter = this.app.vault.adapter;
    if (!(adapter instanceof FileSystemAdapter)) {
      throw new Error(
        "The PDF export needs Obsidian's desktop app; the HTML export works everywhere."
      );
    }
    return `${adapter.getBasePath()}/${this.pluginDir}/tmp/deck.html`;
  }
}
