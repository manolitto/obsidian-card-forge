import type { App } from "obsidian";
import { dataUri } from "../systems/assets";
import type { ImageSource } from "./images";

/**
 * The vault as an image source: a link resolved the way Obsidian resolves
 * it from the note that wrote it, and the file's bytes as a `data:` URI.
 */
export class VaultImageSource implements ImageSource {
  constructor(private readonly app: App) {}

  async resolve(link: string, fromNotePath: string): Promise<string | undefined> {
    const file = this.app.metadataCache.getFirstLinkpathDest(link, fromNotePath);
    if (!file) return undefined;
    const bytes = await this.app.vault.readBinary(file);
    return dataUri(new Uint8Array(bytes), file.path);
  }
}
