import type { SystemPath } from "../definitions/game-system";

/**
 * Where a system's files come from.
 *
 * Two implementations, one interface: a bundled system reads out of the
 * manifest embedded in the plugin, a vault system reads through Obsidian's
 * adapter. Everything above this line — the loader, its checks, the stylesheet
 * assembly, later the template engine — sees only this, so a system behaves
 * the same whichever way it arrived.
 *
 * Async throughout, even though the manifest could answer synchronously: the
 * adapter is I/O, and the interface is shaped by the slower of its two
 * implementations.
 *
 * Every path is a `SystemPath` — relative to the system folder, checked to
 * stay inside it. A source is never handed a string nobody checked.
 *
 * The root document is whatever the registration points at — the listing
 * entry of a bundled system, the file the user picked for a vault one —
 * and the folder holding it is the system. The name is free: the bundled
 * systems call theirs after the system, and nothing is found by name.
 */
export interface SystemSource {
  readonly kind: "bundled" | "vault";
  /** Where the files are, for messages — `bundled:simple`, or the vault folder. */
  readonly root: string;
  /** The root document, at the top of the folder. */
  readonly document: SystemPath;
  /** Every file in the system's folder, relative and `/`-separated. */
  listFiles(): Promise<SystemPath[]>;
  /** Throws `MissingFileError` for a path the source does not have. */
  readText(path: SystemPath): Promise<string>;
  /** Throws `MissingFileError` for a path the source does not have. */
  readBinary(path: SystemPath): Promise<Uint8Array>;
}

/**
 * A read of a file the source does not have. Always names the path: a missing
 * file fails where someone can see it, never as a blank area on a card.
 */
export class MissingFileError extends Error {
  constructor(
    readonly root: string,
    readonly path: string
  ) {
    super(`${root}: no file "${path}"`);
    this.name = "MissingFileError";
  }
}
