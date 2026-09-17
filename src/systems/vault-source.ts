import type { SystemPath } from "../definitions/game-system";
import { MissingFileError, type SystemSource } from "./source";

/**
 * The four things a vault system needs from Obsidian's `DataAdapter`, in the
 * adapter's own shapes so `app.vault.adapter` is passed straight in. Naming
 * them here rather than importing the adapter type is what lets a test hand
 * in an in-memory folder.
 */
export interface VaultFiles {
  exists(path: string): Promise<boolean>;
  read(path: string): Promise<string>;
  readBinary(path: string): Promise<ArrayBuffer>;
  /** Direct children only, each as a full vault path. */
  list(path: string): Promise<{ files: string[]; folders: string[] }>;
}

/**
 * A system the user keeps in their vault: a root document, and the folder
 * around it.
 *
 * Native files only — `dragonbane.yaml`, `dragonbane.css`, `front.hbs` —
 * read as they are. Obsidian's explorer lists these extensions only with
 * *Detect all file extensions* switched on, so such a system is authored
 * there or in an external editor; the trade is one read path against two.
 */
export class VaultSystemSource implements SystemSource {
  readonly kind = "vault";
  readonly root: string;
  readonly document: SystemPath;

  /** @param documentPath the root document, vault-relative, inside a folder. */
  constructor(
    documentPath: string,
    private readonly files: VaultFiles
  ) {
    this.root = folderOf(documentPath);
    this.document = basename(documentPath) as SystemPath;
  }

  async listFiles(): Promise<SystemPath[]> {
    const out: string[] = [];
    const visit = async (folder: string): Promise<void> => {
      const listing = await this.files.list(folder);
      for (const file of listing.files) {
        const name = basename(file);
        if (!name.startsWith(".")) out.push(file);
      }
      for (const child of listing.folders) {
        if (!basename(child).startsWith(".")) await visit(child);
      }
    };
    await visit(this.root);
    // Everything listed came out of the root folder, so it is inside it by
    // construction — the promise the brand makes.
    return out.map((file) => file.slice(this.root.length + 1)).sort() as SystemPath[];
  }

  async readText(path: SystemPath): Promise<string> {
    return this.files.read(await this.locate(path));
  }

  async readBinary(path: SystemPath): Promise<Uint8Array> {
    return new Uint8Array(await this.files.readBinary(await this.locate(path)));
  }

  private async locate(path: SystemPath): Promise<string> {
    const full = `${this.root}/${path}`;
    if (!(await this.files.exists(full))) throw new MissingFileError(this.root, path);
    return full;
  }
}

/** The folder holding a vault file — `""` for one at the vault root. */
export function folderOf(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash < 0 ? "" : path.slice(0, slash);
}

function basename(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}
