import { dump } from "js-yaml";
import { Modal, Notice, type App, type MarkdownView } from "obsidian";
import { CARD_SETTING_KEYS } from "../definitions/card-settings";
import { propertyDescription, propertySample } from "../definitions/property-defs";
import type { LoadedCardType, LoadedSystem } from "../systems/loader";
import { buildCardBlock, insertAtCursor, type InsertMode } from "./insert-card";
import { t, type StringKey } from "./strings";

/*
 * The property reference: what a note may write for one card type, as a
 * table — the key, what it means, the other names it goes by, an example,
 * the place on the card it fills — and under it the keys of `card:` a
 * note may write, one line each. With no other form of the YAML
 * documentation in the plugin, this is where an author learns a card
 * type; the footer writes the block for them.
 *
 * The insert buttons target the editor that was active when the command
 * ran, captured before the modal took the focus.
 */
export class PropertyReferenceModal extends Modal {
  constructor(
    app: App,
    private readonly system: LoadedSystem,
    private readonly cardType: LoadedCardType,
    private readonly language: string,
    private readonly target: MarkdownView | null
  ) {
    super(app);
  }

  override onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    this.modalEl.addClass("cs-reference-modal");
    this.setTitle(
      t("reference.title", {
        system: this.system.declaration.name,
        cardType: this.cardType.declaration.id,
      })
    );

    this.table(contentEl);
    this.cardKeys(contentEl);
    this.footer(contentEl);
  }

  private table(parent: HTMLElement): void {
    const bound = Object.entries(this.cardType.properties).filter(
      ([, def]) => (def.slot?.length ?? 0) > 0
    );
    if (bound.length === 0) {
      parent.createDiv({ cls: "cs-reference-empty", text: t("insert.no-properties") });
      return;
    }
    const table = parent.createEl("table", { cls: "cs-reference-table" });
    const head = table.createEl("thead").createEl("tr");
    for (const column of ["key", "description", "aliases", "sample", "slot"] as const) {
      head.createEl("th", { text: t(`reference.${column}`) });
    }
    const body = table.createEl("tbody");
    for (const [key, def] of bound) {
      const row = body.createEl("tr");
      row.createEl("td", { cls: "cs-reference-key" }).createEl("code", { text: key });
      row.createEl("td", { text: propertyDescription(def, this.language) ?? "" });
      row.createEl("td", {
        cls: "cs-reference-aliases",
        text: (def.aliases ?? []).join(", "),
      });
      row.createEl("td", { cls: "cs-reference-sample" }).createEl("code", {
        text: sampleText(propertySample(def, this.language)),
      });
      row.createEl("td", { cls: "cs-reference-slot", text: (def.slot ?? []).join(", ") });
    }
  }

  /** The keys of `card:` — the two that name the card, then every card setting. */
  private cardKeys(parent: HTMLElement): void {
    parent.createEl("h3", { text: t("reference.card-keys") });
    const list = parent.createEl("dl", { cls: "cs-reference-keys" });
    for (const key of ["system", "card-type", ...CARD_SETTING_KEYS]) {
      list.createEl("dt").createEl("code", { text: key });
      list.createEl("dd", { text: t(`card-key.${key}` as StringKey) });
    }
  }

  private footer(parent: HTMLElement): void {
    const footer = parent.createDiv({ cls: "cs-reference-footer" });
    const button = (label: StringKey, cls: string, onClick: () => void): void => {
      const el = footer.createEl("button", { text: t(label), cls });
      el.addEventListener("click", onClick);
    };
    button("reference.insert-empty", "", () => this.insert("empty"));
    button("reference.insert-sample", "mod-cta", () => this.insert("sample"));
    button("reference.copy", "", () => void this.copy());
  }

  private insert(mode: InsertMode): void {
    if (!this.target) {
      new Notice(`Cardsmith: ${t("reference.no-editor")}`);
      return;
    }
    insertAtCursor(this.target.editor, this.block(mode));
    this.close();
    this.app.workspace.setActiveLeaf(this.target.leaf, { focus: true });
  }

  private async copy(): Promise<void> {
    await navigator.clipboard.writeText(this.block("sample"));
    new Notice(`Cardsmith: ${t("reference.copied")}`);
  }

  private block(mode: InsertMode): string {
    return buildCardBlock(this.system, this.cardType, this.language, mode);
  }
}

/** A sample as one cell: a scalar as it is, a list or a map as YAML, long ones cut. */
function sampleText(sample: unknown): string {
  if (sample === undefined) return "—";
  if (sample === null) return "~";
  if (typeof sample !== "object") return String(sample);
  const text = dump(sample, { indent: 2, lineWidth: 80, noRefs: true }).trimEnd();
  return text.length > 160 ? `${text.slice(0, 157)}…` : text;
}
