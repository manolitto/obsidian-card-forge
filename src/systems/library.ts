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

  /** What an entry is called, without loading it — the manifest's or the entry's own word. */
  nameOf(entry: SystemEntry): string {
    // `||`: a saved entry may predate the stored name; the id is still a name.
    if (entry.type === "vault") return entry.name || entry.id;
    return BUNDLED_SYSTEMS.find((system) => system.id === entry.id)?.name ?? entry.id;
  }

  /**
   * Read and check a vault system by its root document without registering
   * it, so a settings dialog can show the verdict before an entry exists.
   * The id and name are the ones to store on the entry; both are absent
   * when the file is no usable system.
   */
  async inspectVaultDocument(
    path: string
  ): Promise<{ id?: string; name?: string; messages: readonly string[] }> {
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
    const source = new VaultSystemSource(path, this.files);
    let id: string | undefined;
    try {
      const doc = load(await source.readText(source.document)) as Record<
        string,
        unknown
      > | null;
      id =
        String(doc?.["id"] ?? "")
          .trim()
          .toLowerCase() || undefined;
    } catch {
      /* loadSystem reports it */
    }
    const system = await loadSystem(source, id ?? "", diagnostics);
    return {
      id: system?.id,
      name: system?.declaration.name,
      messages: diagnostics.messages,
    };
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
