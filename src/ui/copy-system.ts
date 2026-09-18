import { Modal, normalizePath, Setting, TFile, type App } from "obsidian";
import type { SystemPath } from "../definitions/game-system";
import { entriesAfterCopy, isSystemId } from "../settings/system-registry";
import type { SystemEntry } from "../settings/types";
import type { LoadedSystem } from "../systems/loader";
import { notice } from "./export-run";
import { namesSystem, rewriteDeclaration, rewriteSystemId } from "./copy-rewrites";
import { t } from "./strings";

/*
 * A bundled system copied into the vault: every file it holds, binaries
 * included, written under a folder of the reader's choosing, registered
 * as a vault system by its root document and switched on. The copy is a cut — it stops
 * receiving the plugin's improvements — and it is self-contained, so the
 * reader can edit anything in it.
 *
 * The dialog proposes a name that says what the copy is — *Copy of Dragonbane* — and
 * the original id. Keeping the id switches the bundled original off,
 * since at most one enabled system may claim an id, and no note is
 * touched. Choosing a new id leaves both on and offers to rewrite the
 * notes naming the old one, after a confirmation naming their count.
 */

/** What the copy needs from the plugin: its settings and how to persist them. */
export interface CopyContext {
  app: App;
  entries(): SystemEntry[];
  save(entries: SystemEntry[]): Promise<void>;
  /** The verdict on a root document in the vault, by its path. */
  inspect(documentPath: string): Promise<{ id?: string; messages: readonly string[] }>;
}

// ── The action ─────────────────────────────────────────────────────

/** Open the dialog for `system` and run the copy on confirm. */
export function copySystemIntoVault(context: CopyContext, system: LoadedSystem): void {
  new CopySystemModal(context, system).open();
}

class CopySystemModal extends Modal {
  private name: string;
  private folder: string;
  private id: string;

  constructor(
    private readonly context: CopyContext,
    private readonly system: LoadedSystem
  ) {
    super(context.app);
    this.name = t("copy.name.default", { name: system.declaration.name });
    this.folder = `cardsmith/${system.id}`;
    this.id = system.id;
  }

  override onOpen(): void {
    this.setTitle(t("copy.title", { name: this.system.declaration.name }));
    const { contentEl } = this;
    contentEl.createEl("p", { text: t("copy.intro") });
    new Setting(contentEl)
      .setName(t("copy.name"))
      .setDesc(t("copy.name.desc"))
      .addText((text) =>
        text.setValue(this.name).onChange((value) => (this.name = value))
      );
    new Setting(contentEl)
      .setName(t("copy.folder"))
      .addText((text) =>
        text.setValue(this.folder).onChange((value) => (this.folder = value))
      );
    new Setting(contentEl)
      .setName(t("copy.id"))
      .setDesc(t("copy.id.desc"))
      .addText((text) => text.setValue(this.id).onChange((value) => (this.id = value)));
    new Setting(contentEl)
      .addButton((button) =>
        button
          .setButtonText(t("copy.confirm"))
          .setCta()
          .onClick(() => void this.confirm())
      )
      .addButton((button) =>
        button.setButtonText(t("copy.cancel")).onClick(() => this.close())
      );
  }

  private async confirm(): Promise<void> {
    // A cleared name means the original's.
    const name = this.name.trim() || this.system.declaration.name;
    const folder = normalizePath(this.folder.trim());
    const id = this.id.trim().toLowerCase();
    if (!folder || !isSystemId(id)) {
      notice(t(folder ? "copy.invalid-id" : "copy.no-folder"));
      return;
    }
    if (this.context.app.vault.getAbstractFileByPath(folder)) {
      notice(t("copy.exists", { path: folder }));
      return;
    }
    this.close();
    try {
      await runCopy(this.context, this.system, folder, id, name);
    } catch (error) {
      notice(error instanceof Error ? error.message : String(error), 12000);
    }
  }
}

async function runCopy(
  context: CopyContext,
  system: LoadedSystem,
  folder: string,
  id: string,
  name: string
): Promise<void> {
  const { app } = context;
  await createFolders(app, folder);
  for (const path of await system.source.listFiles()) {
    const target = `${folder}/${path}`;
    await createFolders(app, target.slice(0, target.lastIndexOf("/")));
    const renamed = id !== system.id || name !== system.declaration.name;
    if (path === system.source.document && renamed) {
      const text = await system.source.readText(path);
      await app.vault.create(target, rewriteDeclaration(text, id, name));
    } else {
      const bytes = await system.source.readBinary(path as SystemPath);
      await app.vault.createBinary(target, bytesToBuffer(bytes));
    }
  }

  const document = `${folder}/${system.source.document}`;
  const verdict = await context.inspect(document);
  if (verdict.id !== id) {
    throw new Error(
      `${folder}: ${verdict.messages.join("; ") || "the copy did not load as a system"}`
    );
  }
  await context.save(entriesAfterCopy(context.entries(), system.id, id, document));
  notice(t("copy.done", { path: folder }), 8000);
  for (const message of verdict.messages) console.warn(`[Cardsmith] ${message}`);

  if (id !== system.id) await offerRewrite(app, system.id, id);
}

/** The notes naming the old id, counted; rewritten after a confirmation naming the count. */
async function offerRewrite(app: App, from: string, to: string): Promise<void> {
  const naming: TFile[] = [];
  for (const file of app.vault.getMarkdownFiles()) {
    if (namesSystem(await app.vault.cachedRead(file), from)) naming.push(file);
  }
  if (naming.length === 0) return;
  const go = await confirm(
    app,
    t("copy.rewrite.title"),
    t("copy.rewrite.body", { count: naming.length, from, to }),
    t("copy.rewrite.confirm", { count: naming.length }),
    t("copy.rewrite.skip")
  );
  if (!go) return;
  for (const file of naming) {
    await app.vault.process(file, (text) => rewriteSystemId(text, from, to));
  }
  notice(t("copy.rewrite.done", { count: naming.length }), 8000);
}

/** A yes/no question as a promise. */
function confirm(
  app: App,
  title: string,
  body: string,
  yes: string,
  no: string
): Promise<boolean> {
  return new Promise((resolve) => {
    let answered = false;
    const modal = new Modal(app);
    modal.setTitle(title);
    modal.contentEl.createEl("p", { text: body });
    new Setting(modal.contentEl)
      .addButton((button) =>
        button
          .setButtonText(yes)
          .setCta()
          .onClick(() => {
            answered = true;
            modal.close();
            resolve(true);
          })
      )
      .addButton((button) => button.setButtonText(no).onClick(() => modal.close()));
    modal.onClose = () => {
      if (!answered) resolve(false);
    };
    modal.open();
  });
}

async function createFolders(app: App, folder: string): Promise<void> {
  const segments = folder.split("/");
  for (let i = 1; i <= segments.length; i++) {
    const path = segments.slice(0, i).join("/");
    if (path && !app.vault.getAbstractFileByPath(path))
      await app.vault.createFolder(path);
  }
}

function bytesToBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;
}
