import type { SystemPath } from "../definitions/game-system";
import type { BundledFile, BundledSystem } from "../generated/bundled-systems";
import { MissingFileError, type SystemSource } from "./source";

/** A system embedded in the plugin, read out of the generated manifest. */
export class BundledSystemSource implements SystemSource {
  readonly kind = "bundled";
  readonly root: string;

  constructor(private readonly system: BundledSystem) {
    this.root = `bundled:${system.id}`;
  }

  async listFiles(): Promise<SystemPath[]> {
    // The manifest's keys were produced by walking the folder, so each is
    // inside it by construction — the promise the brand makes.
    return Object.keys(this.system.files) as SystemPath[];
  }

  async readText(path: SystemPath): Promise<string> {
    const file = this.file(path);
    return "text" in file ? file.text : decodeText(file.base64);
  }

  async readBinary(path: SystemPath): Promise<Uint8Array> {
    const file = this.file(path);
    return "text" in file
      ? new TextEncoder().encode(file.text)
      : decodeBytes(file.base64);
  }

  private file(path: SystemPath): BundledFile {
    const file = this.system.files[path];
    if (!file) throw new MissingFileError(this.root, path);
    return file;
  }
}

function decodeBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function decodeText(base64: string): string {
  return new TextDecoder().decode(decodeBytes(base64));
}
