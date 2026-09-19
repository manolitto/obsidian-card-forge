import { Platform, TFile, type App, type MarkdownPostProcessorContext } from "obsidian";
import { parseDeckBlock } from "../deck/block";
import { selectNotes } from "../deck/select";
import type { DeckSource } from "../deck/source";
import { collectDiagnostics } from "../definitions/diagnostics";
import type { BuiltDeck, DeckExporter, ExportFormat } from "../export/exporter";
import type { PaperSize } from "../model/paper-size";
import { noteCardTypeId } from "../render/card";
import type { LoadedSystem } from "../systems/loader";
import { notice, runExport } from "./export-run";
import { t, type StringKey } from "./strings";

/*
 * The `cardsmith-deck` block in reading view and live preview: a summary
 * of what the deck will print, and the buttons that print it.
 *
 * The summary is what parsing and filtering yield — the system, the card
 * types, the folder, the notes the selection keeps by card type, the paper
 * and the card size — which is cheap enough to run on every render of the
 * block. The number of cards is known only after rendering (rows, roll
 * ranges, copies) and is what the export's notice says. Whatever the block
 * gets wrong is listed inline, in the parser's own words. The YAML itself
 * is edited in the editor, as cards are; *Insert deck block* writes it
 * documented.
 *
 * A button that starts an export is disabled while it runs and shows the
 * progress in its own label.
 */

export interface DeckBlockContext {
  app: App;
  systems: { get(id: string): Promise<LoadedSystem> };
  source: DeckSource;
  exporter: DeckExporter;
  openPreview(file: TFile, built: BuiltDeck): Promise<void>;
}

export function deckBlockProcessor(context: DeckBlockContext) {
  return async (
    source: string,
    el: HTMLElement,
    ctx: MarkdownPostProcessorContext
  ): Promise<void> => {
    el.addClass("cs-deck-block");
    const file = context.app.vault.getAbstractFileByPath(ctx.sourcePath);
    const diagnostics = collectDiagnostics();
    // The parser reads a note; the block is handed over as one.
    const block = parseDeckBlock(
      `\`\`\`cardsmith-deck\n${source}\n\`\`\``,
      ctx.sourcePath,
      diagnostics
    );

    const rows = el.createEl("dl", { cls: "cs-deck-summary" });
    const row = (label: StringKey, value: string): HTMLElement => {
      rows.createEl("dt", { text: t(label) });
      return rows.createEl("dd", { text: value });
    };

    if (block) {
      const { selection, settings, cardLayer } = block;
      let system: LoadedSystem | undefined;
      try {
        system = await context.systems.get(selection.systemId);
      } catch (error) {
        diagnostics.warn(error instanceof Error ? error.message : String(error));
      }
      row("deck.system", system?.declaration.name ?? selection.systemId);
      row(
        "deck.card-types",
        selection.cardTypeIds.length > 0
          ? selection.cardTypeIds.join(", ")
          : t("deck.all-card-types")
      );
      row("deck.folder", selection.folder || t("deck.root-folder"));
      const notes = row("deck.notes", "…");
      row("deck.paper", paperText(settings.paperSize));
      const sizes = new Set<string>();
      const cardTypes =
        selection.cardTypeIds.length > 0
          ? selection.cardTypeIds
          : Object.keys(system?.cardTypes ?? {});
      for (const id of cardTypes) {
        const size = cardLayer.cardSize ?? system?.cardTypes[id]?.cardSettings.cardSize;
        if (size) sizes.add(`${size.width} × ${size.height} mm`);
      }
      row("deck.card-size", [...sizes].join(", "));
      if (cardLayer.side === "front" || cardLayer.side === "back") {
        row("deck.sides", t(`deck.sides.${cardLayer.side}`));
      }

      if (system) {
        const listed = await context.source.listNotes(
          selection.folder,
          settings.folderRecursive ?? false,
          diagnostics
        );
        const kept = selectNotes(listed, selection, system, diagnostics);
        notes.setText(
          breakdown(kept.map(({ note }) => noteCardTypeId(note, system) ?? "?"))
        );
      } else {
        notes.setText("—");
      }
    }

    if (diagnostics.messages.length > 0) {
      const list = el.createEl("ul", { cls: "cs-deck-diagnostics" });
      for (const message of diagnostics.messages) list.createEl("li", { text: message });
    }

    if (block && file instanceof TFile) {
      const buttons = el.createDiv({ cls: "cs-deck-buttons" });
      const preview = buttons.createEl("button", { text: t("deck.preview") });
      preview.addEventListener("click", () => {
        // The block builds the deck and counts the cards in the button, as
        // the export buttons do, and hands the view the result — so the
        // button that was pressed is where the work is seen.
        preview.disabled = true;
        preview.setText(t("progress.starting"));
        void context.exporter
          .build(file, (message) => preview.setText(message))
          .then((built) => context.openPreview(file, built))
          .catch((error: unknown) =>
            notice(error instanceof Error ? error.message : String(error), 12000)
          )
          .finally(() => {
            preview.disabled = false;
            preview.setText(t("deck.preview"));
          });
      });
      if (Platform.isDesktop)
        exportButton(buttons, "deck.export-pdf", "pdf", file, context);
      exportButton(buttons, "deck.export-html", "html", file, context);
    }
  };
}

/** "24 notes — 20 gear, 4 npc", or that none matches. */
function breakdown(cardTypes: readonly string[]): string {
  if (cardTypes.length === 0) return t("deck.notes.none");
  const counts = new Map<string, number>();
  for (const id of cardTypes) counts.set(id, (counts.get(id) ?? 0) + 1);
  const parts = [...counts].map(([id, count]) => `${count} ${id}`);
  return `${t("deck.notes.count", { count: cardTypes.length })} — ${parts.join(", ")}`;
}

/** "210 × 297 mm, portrait" — as the deck chain resolved it. */
function paperText(paper: PaperSize | undefined): string {
  if (!paper) return "—";
  return `${paper.width} × ${paper.height} mm, ${paper.orientation}`;
}

function exportButton(
  parent: HTMLElement,
  label: StringKey,
  format: ExportFormat,
  file: TFile,
  context: DeckBlockContext
): void {
  const button = parent.createEl("button", {
    text: t(label),
    cls: format === "pdf" ? "mod-cta" : "",
  });
  button.addEventListener("click", () => {
    button.disabled = true;
    button.setText(t("progress.starting"));
    void runExport(context.exporter, file, format, (message) =>
      button.setText(message)
    ).then(() => {
      button.disabled = false;
      button.setText(t(label));
    });
  });
}
