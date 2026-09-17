import { AbstractInputSuggest, TFolder, type App } from "obsidian";

/**
 * A type-ahead over the vault's folders for a plain text field — the way
 * Obsidian's own folder settings offer one. Choosing a folder writes its
 * path into the field and fires `input`, so the field's own change
 * handler runs as if it had been typed.
 */
export class FolderSuggest extends AbstractInputSuggest<TFolder> {
  constructor(
    app: App,
    private readonly input: HTMLInputElement
  ) {
    super(app, input);
  }

  protected getSuggestions(query: string): TFolder[] {
    const needle = query.trim().toLowerCase();
    return this.app.vault
      .getAllFolders()
      .filter((folder) => !folder.isRoot() && folder.path.toLowerCase().includes(needle))
      .sort((a, b) => a.path.localeCompare(b.path));
  }

  override renderSuggestion(folder: TFolder, el: HTMLElement): void {
    el.setText(folder.path);
  }

  override selectSuggestion(folder: TFolder): void {
    this.input.value = folder.path;
    this.input.dispatchEvent(new Event("input"));
    this.close();
  }
}
