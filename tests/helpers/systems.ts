import type { SystemPath } from "../../src/definitions/game-system";
import { MissingFileError, type SystemSource } from "../../src/systems/source";
import type { VaultFiles } from "../../src/systems/vault-source";

/** A folder's worth of files: path → text, or path → bytes. */
export type Files = Record<string, string | Uint8Array>;

/**
 * A system held in memory. The loader tests run against this so a case can
 * write the folder it wants — a missing template, a stray image — as a
 * literal, without a manifest or a vault behind it.
 */
export class MemorySource implements SystemSource {
  readonly kind = "vault";

  constructor(
    public files: Files,
    readonly root = "memory"
  ) {}

  async listFiles(): Promise<SystemPath[]> {
    return Object.keys(this.files).sort() as SystemPath[];
  }

  async readText(path: SystemPath): Promise<string> {
    const file = this.file(path);
    return typeof file === "string" ? file : new TextDecoder().decode(file);
  }

  async readBinary(path: SystemPath): Promise<Uint8Array> {
    const file = this.file(path);
    return typeof file === "string" ? new TextEncoder().encode(file) : file;
  }

  private file(path: string): string | Uint8Array {
    const file = this.files[path];
    if (file === undefined) throw new MissingFileError(this.root, path);
    return file;
  }
}

/**
 * A vault held in memory, in the adapter's shapes: full vault paths, direct
 * children per `list`, binary reads as `ArrayBuffer`.
 */
export class MemoryVault implements VaultFiles {
  constructor(public files: Files = {}) {}

  /** Put a whole system folder under `folder`. */
  addFolder(folder: string, files: Files): void {
    for (const [path, content] of Object.entries(files)) {
      this.files[`${folder}/${path}`] = content;
    }
  }

  exists(path: string): Promise<boolean> {
    return Promise.resolve(
      path in this.files || Object.keys(this.files).some((p) => p.startsWith(`${path}/`))
    );
  }

  read(path: string): Promise<string> {
    const file = this.files[path];
    if (file === undefined) return Promise.reject(new Error(`ENOENT: ${path}`));
    return Promise.resolve(
      typeof file === "string" ? file : new TextDecoder().decode(file)
    );
  }

  readBinary(path: string): Promise<ArrayBuffer> {
    const file = this.files[path];
    if (file === undefined) return Promise.reject(new Error(`ENOENT: ${path}`));
    const bytes = typeof file === "string" ? new TextEncoder().encode(file) : file;
    return Promise.resolve(
      bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength
      ) as ArrayBuffer
    );
  }

  list(path: string): Promise<{ files: string[]; folders: string[] }> {
    const files = new Set<string>();
    const folders = new Set<string>();
    const prefix = `${path}/`;
    for (const full of Object.keys(this.files)) {
      if (!full.startsWith(prefix)) continue;
      const rest = full.slice(prefix.length);
      const slash = rest.indexOf("/");
      if (slash < 0) files.add(full);
      else folders.add(prefix + rest.slice(0, slash));
    }
    return Promise.resolve({ files: [...files].sort(), folders: [...folders].sort() });
  }
}

/** Eight bytes that are not text, standing in for an image or a font. */
export const BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * A complete, valid system: two card types sharing a back, a partial that the
 * front calls, a font the stylesheet refers to, a logo a property defaults
 * to. Every check has something to pass. A test copies and breaks it.
 */
export function completeSystem(): Files {
  return {
    "game-system.yaml": `
id: demo
name: Demo
languages: [en, de]
stylesheet: game-system.css
partial-templates:
  stat-cell: partials/stat-cell.hbs
  card-image: partials/card-image.hbs
markdown-image-partial: card-image
card-size: poker
properties:
  logo-image: { default: assets/logo.png }
  category: { aliases: [kategorie], slot: header-title }
translations:
  de: { back-label: Rückseite }
card-types:
  gear:
    front-template: gear/front.hbs
    back-template: back.hbs
    stylesheet: gear/card-type.css
    properties:
      grip: { aliases: [griff], slot: stat-1a }
  spell:
    front-template: spell/front.hbs
    back-template: back.hbs
`,
    "game-system.css": `@font-face { font-family: X; src: url('fonts/x.woff2') format('woff2'); }
.card-root.demo { background: url("assets/paper.webp"); }`,
    "gear/card-type.css": `.gear-frame { background-image: url(gear/assets/frame.png); }`,
    "gear/front.hbs": `<div>{{slot "header-title"}} {{> stat-cell for="stat-1a"}} {{asset "assets/logo.png"}}</div>`,
    "spell/front.hbs": `<div>{{slot "header-title"}}</div>`,
    "back.hbs": `<div class="back">{{t "back-label"}}</div>`,
    "partials/stat-cell.hbs": `<td>{{slot for}}</td>`,
    "partials/card-image.hbs": `<img src="{{url}}">`,
    "fonts/x.woff2": BYTES,
    "fonts/OFL.txt": "licence",
    "assets/paper.webp": BYTES,
    "assets/logo.png": BYTES,
    "gear/assets/frame.png": BYTES,
  };
}
