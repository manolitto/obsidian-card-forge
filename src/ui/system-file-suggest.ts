import { AbstractInputSuggest, type App, type TFile } from "obsidian";

/**
 * A type-ahead over the vault's YAML files for a plain text field, the way
 * Obsidian's own path settings offer one — so the field that registers a
 * system lists every root document a vault could hold, whether or not the
 * explorer shows the extension. Choosing one writes its path into the field
 * and fires `input`, so the field's own change handler runs as if it had
 * been typed.
 */
export class SystemFileSuggest extends AbstractInputSuggest<TFile> {
  constructor(
    app: App,
    private readonly input: HTMLInputElement
  ) {
    super(app, input);
  }

  protected getSuggestions(query: string): TFile[] {
    const needle = query.trim().toLowerCase();
    return this.app.vault
      .getFiles()
      .filter(
        (file) =>
          (file.extension === "yaml" || file.extension === "yml") &&
          file.path.toLowerCase().includes(needle)
      )
      .sort((a, b) => a.path.localeCompare(b.path));
  }

  override renderSuggestion(file: TFile, el: HTMLElement): void {
    el.setText(file.path);
  }

  override selectSuggestion(file: TFile): void {
    this.input.value = file.path;
    this.input.dispatchEvent(new Event("input"));
    this.close();
  }
}
