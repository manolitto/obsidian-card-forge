import { Notice, type TFile } from "obsidian";
import type { DeckExporter, ExportFormat, ExportProgress } from "../export/exporter";
import { t } from "./strings";

/*
 * One export, from wherever it was started: the command draws its progress
 * in a notice, the deck block in the button it disabled — and both
 * announce the same way. The result is a notice with the counts and the
 * path, one more with the cards cut at the type floor when there are any,
 * and a count of the build's warnings with each one on the console. An
 * error is one notice with its message.
 */
export async function runExport(
  exporter: DeckExporter,
  file: TFile,
  format: ExportFormat,
  progress: ExportProgress
): Promise<void> {
  try {
    const result = await exporter.run(file, format, progress);
    notice(
      t("notice.exported", {
        cards: result.cards,
        pages: result.pages,
        path: result.path,
      }),
      8000
    );
    if (result.clipped.length > 0) {
      notice(t("notice.clipped", { names: result.clipped.join(", ") }), 12000);
    }
    reportWarnings(result.warnings);
  } catch (error) {
    notice(error instanceof Error ? error.message : String(error), 12000);
  }
}

/** The build's warnings: each on the console, their count in a notice. */
export function reportWarnings(warnings: readonly string[]): void {
  if (warnings.length === 0) return;
  for (const message of warnings) console.warn(`[Card Forge] ${message}`);
  notice(t("notice.warnings", { count: warnings.length }), 8000);
}

export function notice(message: string, duration?: number): Notice {
  return new Notice(`Card Forge: ${message}`, duration);
}
