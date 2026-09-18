import {
  debounce,
  MarkdownRenderChild,
  setIcon,
  TFile,
  type App,
  type MarkdownPostProcessorContext,
} from "obsidian";
import { collectDiagnostics } from "../definitions/diagnostics";
import { layoutCard } from "../layout/engine";
import { CARD_PRESETS, DEFAULT_CARD_PRESET } from "../model/card-size";
import { noteSystemId } from "../render/card";
import { parseNote } from "../render/note";
import type { CardRenderer, RenderedCard } from "../render/renderer";
import type { LoadedSystem } from "../systems/loader";
import { mountPreview, previewFaces } from "./preview-mount";
import { t } from "./strings";

/*
 * The `cardsmith` block in reading view and live preview: the note's
 * cards, one shown at a time, laid out and mounted at the display height.
 *
 * The block is the note's declaration, but the card is the whole note —
 * frontmatter, sections, a table — so the processor reads the note back
 * from the vault and renders it whole. A note that yields several cards (a
 * table's rows, a roll range) gets a stepping bar; the arrows lay the next
 * card out on demand, since rendering N cards is templates and fast and
 * layout is per card and the slow part.
 *
 * The preview follows its note: an edit to the frontmatter or a section
 * changes the card without touching the block, so the child listens for
 * the file's metadata change and re-renders into the same element. A
 * result that arrives after the child unloaded, or after a newer render
 * started, is dropped before it touches the DOM.
 */

/** What the processor needs from the plugin. */
export interface CardBlockContext {
  app: App;
  systems: { get(id: string): Promise<LoadedSystem> };
  renderer: CardRenderer;
  /** The reader's preview height — the layer under a note's `display-height`. */
  previewHeight(): number;
}

/** The processor `registerMarkdownCodeBlockProcessor("cardsmith", …)` takes. */
export function cardBlockProcessor(context: CardBlockContext) {
  return (_source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): void => {
    ctx.addChild(new CardPreview(el, ctx.sourcePath, context));
  };
}

class CardPreview extends MarkdownRenderChild {
  private cards: RenderedCard[] = [];
  private system?: LoadedSystem;
  /** What rendering the note reported; shown under every card it yields. */
  private noteMessages: readonly string[] = [];
  private index = 0;
  /** Bumped per render; a result from an older generation is dropped. */
  private generation = 0;
  private active = false;

  constructor(
    el: HTMLElement,
    private readonly path: string,
    private readonly context: CardBlockContext
  ) {
    super(el);
  }

  override onload(): void {
    this.active = true;
    const rerender = debounce(() => void this.render(), 300, true);
    this.registerEvent(
      this.context.app.metadataCache.on("changed", (file) => {
        if (file.path === this.path) rerender();
      })
    );
    void this.render();
  }

  override onunload(): void {
    this.active = false;
  }

  /** The note, read and rendered whole; then the card at `index` shown. */
  private async render(): Promise<void> {
    const generation = ++this.generation;
    const diagnostics = collectDiagnostics();
    this.containerEl.empty();
    this.containerEl.addClass("cs-card-block");
    const placeholder = this.containerEl.createDiv({
      cls: "cs-card-placeholder",
      text: t("preview.laying-out"),
    });

    try {
      const file = this.context.app.vault.getAbstractFileByPath(this.path);
      if (!(file instanceof TFile)) throw new Error(`${this.path}: not a file`);
      const note = parseNote(
        await this.context.app.vault.cachedRead(file),
        this.path,
        diagnostics
      );
      const systemId = note && noteSystemId(note, diagnostics);
      if (!note || !systemId) {
        this.cards = [];
      } else {
        this.system = await this.context.systems.get(systemId);
        this.cards = await this.context.renderer.render(note, this.system, diagnostics);
      }
    } catch (error) {
      diagnostics.warn(error instanceof Error ? error.message : String(error));
      this.cards = [];
    }
    if (this.stale(generation)) return;
    this.noteMessages = diagnostics.messages;

    if (this.cards.length === 0) {
      placeholder.remove();
      this.containerEl.createDiv({ cls: "cs-card-empty", text: t("preview.no-card") });
      this.showDiagnostics([]);
      return;
    }
    this.index = Math.min(this.index, this.cards.length - 1);
    await this.show(generation);
  }

  /** Lay the card at `index` out and mount it; the stepping bar when there are several. */
  private async show(generation: number): Promise<void> {
    const card = this.cards[this.index];
    const system = this.system;
    if (!card || !system) return;

    const diagnostics = collectDiagnostics();
    const doc = this.containerEl.ownerDocument;
    const laidOut = await layoutCard(card, system, doc, diagnostics);
    const stylesheet = await system.stylesheet(card.cardTypeId);
    if (this.stale(generation)) return;

    this.containerEl.empty();
    if (this.cards.length > 1) this.steppingBar();
    mountPreview(
      this.containerEl,
      system.id,
      stylesheet,
      previewFaces(laidOut, card.settings.side),
      card.settings.cardSize ?? CARD_PRESETS[DEFAULT_CARD_PRESET],
      card.settings.displayHeight ?? this.context.previewHeight()
    );
    if (laidOut.clipped) diagnostics.warn(t("preview.clipped"));
    this.showDiagnostics(diagnostics.messages);
  }

  private steppingBar(): void {
    const bar = this.containerEl.createDiv({ cls: "cs-card-stepping" });
    const step = (delta: number): void => {
      const next = this.index + delta;
      if (next < 0 || next >= this.cards.length) return;
      this.index = next;
      // A step is a new render of the same cards; the note is not re-read.
      void this.show(++this.generation);
    };
    const previous = bar.createEl("button", {
      cls: "clickable-icon",
      attr: { "aria-label": t("preview.previous") },
    });
    setIcon(previous, "chevron-left");
    previous.disabled = this.index === 0;
    previous.addEventListener("click", () => step(-1));
    bar.createSpan({
      text: t("preview.step", { index: this.index + 1, count: this.cards.length }),
    });
    const next = bar.createEl("button", {
      cls: "clickable-icon",
      attr: { "aria-label": t("preview.next") },
    });
    setIcon(next, "chevron-right");
    next.disabled = this.index === this.cards.length - 1;
    next.addEventListener("click", () => step(1));
  }

  /**
   * The note's own problems under the card — what its render reported, then
   * what laying this card out did: where an author looking at the card is
   * looking. The console is for decks.
   */
  private showDiagnostics(layoutMessages: readonly string[]): void {
    const messages = [...this.noteMessages, ...layoutMessages];
    if (messages.length === 0) return;
    const list = this.containerEl.createEl("ul", { cls: "cs-card-diagnostics" });
    for (const message of messages) list.createEl("li", { text: message });
  }

  /** True once this render is not the latest, or the child is gone. */
  private stale(generation: number): boolean {
    return !this.active || generation !== this.generation;
  }
}
