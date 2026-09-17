import { FuzzySuggestModal, Notice, type App, type FuzzyMatch } from "obsidian";
import type { SystemEntry } from "../settings/types";
import type { LoadResult } from "../systems/library";
import type { LoadedCardType, LoadedSystem } from "../systems/loader";
import { t } from "./strings";

/*
 * Two pickers in a row: a system by name, its id beside it, then one of
 * its card types by id — each skipped when there is exactly one to choose
 * from. What is offered is the active entries of the registry; a system
 * that does not load is still listed, so the reader sees it, and says why
 * when chosen.
 */

export interface PickedCardType {
  system: LoadedSystem;
  cardType: LoadedCardType;
}

/** What the pickers need of the library: every entry's load, with its messages. */
export interface PickerLibrary {
  load(id: string): Promise<LoadResult>;
}

export async function pickSystemAndCardType(
  app: App,
  library: PickerLibrary,
  entries: readonly SystemEntry[]
): Promise<PickedCardType | undefined> {
  const active = entries.filter((entry) => entry.active);
  const loaded = await Promise.all(
    active.map(async (entry) => ({ id: entry.id, ...(await library.load(entry.id)) }))
  );
  if (loaded.length === 0) {
    new Notice(`Card Forge: ${t("picker.no-systems")}`);
    return undefined;
  }

  const choice =
    loaded.length === 1
      ? loaded[0]
      : await pick(
          app,
          loaded,
          t("picker.system"),
          (s) => s.system?.declaration.name ?? s.id,
          (s) => s.id
        );
  if (!choice) return undefined;
  if (!choice.system) {
    new Notice(`Card Forge: ${choice.messages.join("; ")}`, 12000);
    return undefined;
  }

  const cardTypes = Object.values(choice.system.cardTypes);
  const cardType =
    cardTypes.length === 1
      ? cardTypes[0]
      : await pick(app, cardTypes, t("picker.card-type"), (c) => c.declaration.id);
  if (!cardType) return undefined;
  return { system: choice.system, cardType };
}

/** One `FuzzySuggestModal`, as a promise: the item chosen, or nothing when dismissed. */
/** `tag`, when given, is shown after the label as a muted monospace chip — the system id. */
function pick<T>(
  app: App,
  items: T[],
  placeholder: string,
  label: (item: T) => string,
  tag?: (item: T) => string
): Promise<T | undefined> {
  return new Promise((resolve) => {
    let chosen = false;
    class Picker extends FuzzySuggestModal<T> {
      getItems(): T[] {
        return items;
      }
      getItemText(item: T): string {
        return label(item);
      }
      override renderSuggestion(match: FuzzyMatch<T>, el: HTMLElement): void {
        super.renderSuggestion(match, el);
        if (tag) el.createSpan({ cls: "cf-system-id", text: tag(match.item) });
      }
      onChooseItem(item: T): void {
        chosen = true;
        resolve(item);
      }
      override onClose(): void {
        // `onChooseItem` may run after `onClose` on some event paths; give
        // it a turn before reading the choice as a dismissal.
        queueMicrotask(() => {
          if (!chosen) resolve(undefined);
        });
      }
    }
    const picker = new Picker(app);
    picker.setPlaceholder(placeholder);
    picker.open();
  });
}
