import { ItemView, TFile, type App, type WorkspaceLeaf } from "obsidian";
import type { DeckExporter } from "../export/exporter";
import { reportWarnings } from "./export-run";
import { t } from "./strings";

/*
 * The deck preview: the export document — every page, fronts and backs
 * in print order — in a frame scaled to the pane, with a toolbar naming
 * the card and page counts and the cards cut at the type floor. The
 * document is the one the PDF is printed from and the HTML export saves,
 * self-contained and static, so showing it whole is showing what prints.
 *
 * The view builds when it is opened for a note and when *Rebuild* is
 * pressed, never on its own: a keystroke in a 200-card deck is not a
 * reason to lay out 200 cards, and neither is a restart. Its state is the
 * deck note's path, so it comes back after one with a *Rebuild* waiting.
 */

export const DECK_VIEW_TYPE = "card-forge-deck-preview";

/** CSS pixels per millimetre at the 96 dpi a browser renders `mm` at. */
const PX_PER_MM = 96 / 25.4;
const GUTTER = 16;

interface DeckViewState {
  path?: string;
  /** Set by `openDeckView` and never saved: build now, rather than wait for *Rebuild*. */
  build?: boolean;
}

export class DeckView extends ItemView {
  private path?: string;
  private status!: HTMLElement;
  private sheet!: HTMLElement;
  private frame?: HTMLIFrameElement;
  private paperWidth = 0;
  private building = false;
  private pendingBuild = false;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly exporter: DeckExporter
  ) {
    super(leaf);
  }

  override getViewType(): string {
    return DECK_VIEW_TYPE;
  }

  override getDisplayText(): string {
    const name = this.path?.split("/").pop()?.replace(/\.md$/, "");
    return name ? `${t("view.title")}: ${name}` : t("view.title");
  }

  override getIcon(): string {
    return "layout-grid";
  }

  override async onOpen(): Promise<void> {
    const root = this.contentEl;
    root.empty();
    root.addClass("cf-deck-view");
    const toolbar = root.createDiv({ cls: "cf-deck-view-toolbar" });
    this.status = toolbar.createSpan({ cls: "cf-deck-view-status" });
    const rebuild = toolbar.createEl("button", { text: t("view.rebuild") });
    rebuild.addEventListener("click", () => void this.build());
    this.sheet = root.createDiv({ cls: "cf-deck-view-sheet" });

    const observer = new ResizeObserver(() => this.fit());
    observer.observe(this.sheet);
    this.register(() => observer.disconnect());
    this.settle();
  }

  override getState(): Record<string, unknown> {
    return { path: this.path };
  }

  override async setState(state: unknown, result: { history: boolean }): Promise<void> {
    const next = state as DeckViewState | null;
    if (next?.path) this.path = next.path;
    if (next?.build) this.pendingBuild = true;
    // The state may arrive before the view has opened; `onOpen` settles it then.
    if (this.status) this.settle();
    await super.setState(state, result);
  }

  /** Build if asked to; otherwise say what the view is waiting for. */
  private settle(): void {
    if (this.pendingBuild) {
      this.pendingBuild = false;
      void this.build();
    } else if (!this.frame) {
      this.status.setText(this.path ? t("view.waiting") : t("view.no-file"));
    }
  }

  /** Build the deck and show its document; one build at a time. */
  private async build(): Promise<void> {
    if (this.building || !this.status) return;
    const file = this.path && this.app.vault.getAbstractFileByPath(this.path);
    if (!(file instanceof TFile)) {
      this.status.setText(t("view.no-file"));
      return;
    }
    this.building = true;
    try {
      const { deck, doc, warnings } = await this.exporter.build(file, (message) =>
        this.status.setText(message)
      );
      this.show(doc.html, doc.paper.width);
      const summary = [
        t("view.summary", { cards: deck.cards.length, pages: doc.pageCount }),
      ];
      if (deck.clipped.length > 0) {
        summary.push(t("notice.clipped", { names: deck.clipped.join(", ") }));
      }
      this.status.setText(summary.join(" · "));
      reportWarnings(warnings);
    } catch (error) {
      this.status.setText(error instanceof Error ? error.message : String(error));
    } finally {
      this.building = false;
    }
  }

  /** The document into a fresh frame at paper width, then scaled to the pane. */
  private show(html: string, paperWidthMm: number): void {
    this.sheet.empty();
    this.paperWidth = paperWidthMm * PX_PER_MM;
    const frame = this.sheet.createEl("iframe", { cls: "cf-deck-view-frame" });
    this.frame = frame;
    frame.addEventListener("load", () => {
      const doc = frame.contentDocument;
      if (!doc) return;
      // The view's own look for the sheets, inside the frame: a gap and a
      // shadow between pages. The export document itself carries neither.
      const style = doc.createElement("style");
      style.textContent =
        "html, body { background: transparent !important; } " +
        ".cf-page { margin: 0 auto 16px; box-shadow: 0 1px 4px rgba(0,0,0,.35); }";
      doc.head.appendChild(style);
      frame.style.height = `${doc.documentElement.scrollHeight}px`;
      this.fit();
    });
    frame.srcdoc = html;
  }

  /** Lay the frame out at paper width and scale it to the pane's. */
  private fit(): void {
    const frame = this.frame;
    if (!frame || this.paperWidth === 0) return;
    const available = this.sheet.clientWidth - GUTTER;
    const scale = Math.min(1, available / this.paperWidth);
    const height = frame.offsetHeight;
    frame.style.width = `${this.paperWidth}px`;
    frame.style.transform = `scale(${scale})`;
    frame.style.transformOrigin = "top left";
    // The frame keeps its layout box at paper size; the sheet reserves
    // only the scaled one.
    frame.style.marginRight = `${-(this.paperWidth * (1 - scale))}px`;
    frame.style.marginBottom = `${-(height * (1 - scale))}px`;
  }
}

/**
 * Show the deck of `file` in a view beside it: the one already showing it,
 * or a new split. Used by the command and by the deck block's button.
 */
export async function openDeckView(app: App, file: TFile): Promise<void> {
  const existing = app.workspace
    .getLeavesOfType(DECK_VIEW_TYPE)
    .find((leaf) => (leaf.view as DeckView).getState()["path"] === file.path);
  if (existing) {
    await app.workspace.revealLeaf(existing);
    return;
  }
  const leaf = app.workspace.getLeaf("split");
  await leaf.setViewState({
    type: DECK_VIEW_TYPE,
    state: { path: file.path, build: true } satisfies DeckViewState,
    active: true,
  });
  await app.workspace.revealLeaf(leaf);
}
