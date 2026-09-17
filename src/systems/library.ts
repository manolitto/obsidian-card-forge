import { load } from "js-yaml";
import { collectDiagnostics } from "../definitions/diagnostics";
import { BUNDLED_SYSTEMS } from "../generated/bundled-systems";
import { findDuplicateActiveIds } from "../settings/system-registry";
import type { SystemEntry } from "../settings/types";
import { BundledSystemSource } from "./bundled-source";
import { loadSystem, type LoadedSystem } from "./loader";
import { folderOf, VaultSystemSource, type VaultFiles } from "./vault-source";

/** The ids this build ships, in listing order — what the settings reconcile against. */
export const BUNDLED_IDS: readonly string[] = BUNDLED_SYSTEMS.map((system) => system.id);

/** What loading a registered system produced: the system, if there is one, and every report. */
export interface LoadResult {
  system?: LoadedSystem;
  messages: readonly string[];
}

/**
 * The systems a vault can render with, by id.
 *
 * Registered, never discovered: the entries come from the settings, a bundled
 * one for each system the build ships and a vault one for each folder the
 * user added. A system loads on first use and stays loaded — a bundled one
 * for good, a vault one until a file under its folder changes.
 *
 * The one invariant the settings cannot bypass is enforced here: **at most
 * one enabled entry per id.** Two enabled entries claiming `dragonbane` are
 * a hard error naming both, and neither loads — never "first one wins",
 * which would be shadowing through the back door.
 */
export class SystemLibrary {
  private entries: readonly SystemEntry[] = [];
  private duplicates: ReadonlySet<string> = new Set();
  private readonly loaded = new Map<string, Promise<LoadResult>>();
  /** The ids whose cached load read the bundled source — the only loads a settings change keeps. */
  private readonly bundledLoads = new Set<string>();

  constructor(private readonly files: VaultFiles) {}

  /**
   * Replace the registry. Vault systems reload on next use; bundled ones
   * are immutable and stay — unless the id's standing changed, since a
   * bundled system that is now claimed twice, or no longer is, must answer
   * as the invariant says rather than as it last loaded.
   */
  setEntries(entries: readonly SystemEntry[]): void {
    const before = this.duplicates;
    this.entries = entries;
    this.duplicates = new Set(findDuplicateActiveIds(entries));
    for (const id of [...this.loaded.keys()]) {
      const keep =
        this.bundledLoads.has(id) &&
        this.enabledEntry(id)?.type === "bundled" &&
        !this.duplicates.has(id) &&
        !before.has(id);
      if (!keep) {
        this.loaded.delete(id);
        this.bundledLoads.delete(id);
      }
    }
  }

  /** The system, or an error saying exactly why there is none. */
  async get(id: string): Promise<LoadedSystem> {
    const result = await this.load(id);
    if (result.system) return result.system;
    throw new Error(
      `System "${id}" could not be loaded: ${result.messages.join("; ") || "unknown reason"}`
    );
  }

  /** The system and every report from loading it, for a surface that shows both. */
  load(id: string): Promise<LoadResult> {
    const key = id.trim().toLowerCase();
    let pending = this.loaded.get(key);
    if (!pending) {
      pending = this.loadFresh(key);
      this.loaded.set(key, pending);
    }
    return pending;
  }

  /**
   * A bundled system by id, whatever its entry says — switched off or
   * shadowed by a copy — for copying it out of the plugin. Not cached:
   * it is read once per copy.
   */
  async loadBundled(id: string): Promise<LoadResult> {
    const bundled = BUNDLED_SYSTEMS.find((system) => system.id === id);
    if (!bundled) {
      return {
        messages: [`System "${id}" is not bundled with this version of the plugin`],
      };
    }
    const diagnostics = collectDiagnostics();
    const system = await loadSystem(new BundledSystemSource(bundled), id, diagnostics);
    return { system, messages: diagnostics.messages };
  }

  /**
   * A file in the vault changed. Drop every vault system whose folder holds
   * it, so the next use reads the new state. Returns the ids dropped.
   */
  invalidate(vaultPath: string): string[] {
    const dropped: string[] = [];
    for (const id of this.loaded.keys()) {
      const entry = this.enabledEntry(id);
      if (entry?.type === "vault" && isUnder(vaultPath, folderOf(entry.path))) {
        this.loaded.delete(id);
        dropped.push(id);
      }
    }
    return dropped;
  }

  /**
   * What an entry is called, whatever its switch says: the manifest's word
   * for a bundled system, and for a vault system whatever its document says
   * *now* — read afresh each time, never kept, so a renamed document is
   * called by its new name the moment the settings are opened, switched on
   * or off. The id when the document cannot be read.
   */
  async nameOf(entry: SystemEntry): Promise<string> {
    if (entry.type === "bundled") {
      return BUNDLED_SYSTEMS.find((system) => system.id === entry.id)?.name ?? entry.id;
    }
    const doc = await this.readDocument(entry.path);
    return String(doc?.["name"] ?? "").trim() || entry.id;
  }

  /**
   * Read and check a vault system by its root document without registering
   * it, so a settings dialog can show the verdict before an entry exists.
   * The id is the one to store on the entry; it is absent when the file is
   * no usable system.
   */
  async inspectVaultDocument(
    path: string
  ): Promise<{ id?: string; messages: readonly string[] }> {
    const diagnostics = collectDiagnostics();
    if (!/\.ya?ml$/i.test(path)) {
      diagnostics.warn(`${path}: a system's root document is a .yaml or .yml file`);
      return { messages: diagnostics.messages };
    }
    const folder = folderOf(path);
    if (!folder) {
      diagnostics.warn(
        `${path}: a system needs a folder of its own — at the vault root, the whole vault would be the system`
      );
      return { messages: diagnostics.messages };
    }
    if (folder.split("/").some((segment) => segment.startsWith("."))) {
      diagnostics.warn(
        `${path}: a system cannot live in a hidden folder — Obsidian does not report changes there`
      );
      return { messages: diagnostics.messages };
    }
    const doc = await this.readDocument(path);
    const id = String(doc?.["id"] ?? "")
      .trim()
      .toLowerCase();
    const system = await loadSystem(
      new VaultSystemSource(path, this.files),
      id,
      diagnostics
    );
    return { id: system?.id, messages: diagnostics.messages };
  }

  /** A vault root document as a mapping, or nothing — the loader reports what is wrong with it. */
  private async readDocument(path: string): Promise<Record<string, unknown> | undefined> {
    try {
      const source = new VaultSystemSource(path, this.files);
      const doc: unknown = load(await source.readText(source.document));
      return doc && typeof doc === "object"
        ? (doc as Record<string, unknown>)
        : undefined;
    } catch {
      return undefined;
    }
  }

  private async loadFresh(id: string): Promise<LoadResult> {
    if (this.duplicates.has(id)) {
      const claimants = this.entries
        .filter((entry) => entry.active && entry.id === id)
        .map(describeEntry);
      return {
        messages: [
          `System "${id}" is enabled more than once — ${claimants.join(" and ")}. Switch all but one off.`,
        ],
      };
    }

    const entry = this.enabledEntry(id);
    if (!entry) {
      const disabled = this.entries.some((candidate) => candidate.id === id);
      return {
        messages: [
          disabled
            ? `System "${id}" is switched off in the settings`
            : `No system "${id}" is registered`,
        ],
      };
    }

    const diagnostics = collectDiagnostics();
    const source = this.sourceFor(entry);
    if (!source) {
      diagnostics.warn(`System "${id}" is not bundled with this version of the plugin`);
      return { messages: diagnostics.messages };
    }
    if (source.kind === "bundled") this.bundledLoads.add(id);
    const system = await loadSystem(source, id, diagnostics);
    return { system, messages: diagnostics.messages };
  }

  private sourceFor(
    entry: SystemEntry
  ): BundledSystemSource | VaultSystemSource | undefined {
    if (entry.type === "vault") return new VaultSystemSource(entry.path, this.files);
    const bundled = BUNDLED_SYSTEMS.find((system) => system.id === entry.id);
    return bundled ? new BundledSystemSource(bundled) : undefined;
  }

  private enabledEntry(id: string): SystemEntry | undefined {
    return this.entries.find((entry) => entry.active && entry.id === id);
  }
}

function isUnder(path: string, folder: string): boolean {
  return path === folder || path.startsWith(`${folder}/`);
}

function describeEntry(entry: SystemEntry): string {
  return entry.type === "bundled"
    ? "the bundled system"
    : `the vault file "${entry.path}"`;
}
