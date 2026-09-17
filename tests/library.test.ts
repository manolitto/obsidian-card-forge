import { describe, expect, it } from "vitest";
import type { SystemEntry } from "../src/settings/types";
import { BUNDLED_IDS, SystemLibrary } from "../src/systems/library";
import { completeSystem, MemoryVault } from "./helpers/systems";

const VAULT_ENTRY: SystemEntry = {
  type: "vault",
  id: "demo",
  path: "Systems/demo/game-system.yaml",
  active: true,
};

function libraryWith(entries: SystemEntry[], vault = new MemoryVault()): SystemLibrary {
  const library = new SystemLibrary(vault);
  library.setEntries(entries);
  return library;
}

describe("a vault system", () => {
  it("loads from its registered folder", async () => {
    const vault = new MemoryVault();
    vault.addFolder("Systems/demo", completeSystem());
    const library = libraryWith([VAULT_ENTRY], vault);
    const system = await library.get("demo");
    expect(system.source.root).toBe("Systems/demo");
    expect(Object.keys(system.cardTypes)).toEqual(["gear", "spell"]);
    expect((await library.load("demo")).messages).toEqual([]);
  });

  it("is loaded once and served from memory after", async () => {
    const vault = new MemoryVault();
    vault.addFolder("Systems/demo", completeSystem());
    const library = libraryWith([VAULT_ENTRY], vault);
    const first = await library.get("demo");
    vault.files["Systems/demo/game-system.yaml"] = "id: demo\ncard-types: {}";
    expect(await library.get("demo")).toBe(first);
  });

  it("reloads after a file under its folder changes", async () => {
    const vault = new MemoryVault();
    vault.addFolder("Systems/demo", completeSystem());
    const library = libraryWith([VAULT_ENTRY], vault);
    await library.get("demo");

    vault.files["Systems/demo/spell/front.hbs"] =
      `<div>{{slot "header-title"}}{{> stat-cell}}</div>`;
    expect(library.invalidate("Systems/demo/spell/front.hbs")).toEqual(["demo"]);
    const result = await library.load("demo");
    expect(result.system).toBeDefined();
    expect(result.messages).toEqual([]); // stat-cell is declared; the new call is fine
  });

  it("ignores a change outside every registered folder", async () => {
    const vault = new MemoryVault();
    vault.addFolder("Systems/demo", completeSystem());
    const library = libraryWith([VAULT_ENTRY], vault);
    const first = await library.get("demo");
    expect(library.invalidate("Systems/demo-other/x.css")).toEqual([]);
    expect(library.invalidate("Notes/demo.md")).toEqual([]);
    expect(await library.get("demo")).toBe(first);
  });

  it("carries the loader's reports, and fails get() with them", async () => {
    const vault = new MemoryVault();
    const files = completeSystem();
    delete files["back.hbs"];
    vault.addFolder("Systems/demo", files);
    const library = libraryWith([VAULT_ENTRY], vault);
    const result = await library.load("demo");
    expect(result.system).toBeDefined(); // survivable: two card types lack a back
    expect(result.messages).toHaveLength(2);
  });

  it("is refused when the folder's document says another id", async () => {
    const vault = new MemoryVault();
    vault.addFolder("Systems/demo", completeSystem());
    const library = libraryWith([{ ...VAULT_ENTRY, id: "other" }], vault);
    await expect(library.get("other")).rejects.toThrow(/declares id "demo"/);
  });
});

describe("the one-enabled-per-id invariant", () => {
  it("refuses both entries, naming both", async () => {
    const vault = new MemoryVault();
    vault.addFolder("Systems/simple", completeSystem());
    const library = libraryWith(
      [
        { type: "bundled", id: "simple", active: true },
        {
          type: "vault",
          id: "simple",
          path: "Systems/simple/game-system.yaml",
          active: true,
        },
      ],
      vault
    );
    await expect(library.get("simple")).rejects.toThrow(
      /enabled more than once — the bundled system and the vault file "Systems\/simple\/game-system.yaml"/
    );
  });

  it("is about enabled entries — a switched-off original beside a copy is fine", async () => {
    const vault = new MemoryVault();
    const files = completeSystem();
    files["game-system.yaml"] = files["game-system.yaml"]!.toString().replace(
      "id: demo",
      "id: simple"
    );
    vault.addFolder("Systems/simple", files);
    const library = libraryWith(
      [
        { type: "bundled", id: "simple", active: false },
        {
          type: "vault",
          id: "simple",
          path: "Systems/simple/game-system.yaml",
          active: true,
        },
      ],
      vault
    );
    expect((await library.get("simple")).source.kind).toBe("vault");
  });
});

describe("what a card gets told when its system is not there", () => {
  it("names a system that is switched off", async () => {
    const library = libraryWith([{ type: "bundled", id: "simple", active: false }]);
    await expect(library.get("simple")).rejects.toThrow(/"simple" is switched off/);
  });

  it("names a system nobody registered", async () => {
    const library = libraryWith([]);
    await expect(library.get("nope")).rejects.toThrow(/No system "nope" is registered/);
  });

  it("names a bundled entry this build does not ship", async () => {
    const library = libraryWith([{ type: "bundled", id: "gone", active: true }]);
    await expect(library.get("gone")).rejects.toThrow(/not bundled with this version/);
  });
});

describe("a bundled system", () => {
  it("is listed by id and loads from the manifest", async () => {
    expect(BUNDLED_IDS).toContain("simple");
    const library = libraryWith([{ type: "bundled", id: "simple", active: true }]);
    const system = await library.get("simple");
    expect(system.source.kind).toBe("bundled");
    expect(system.declaration.name).toBe("Simple");
  });

  it("survives a settings change; a vault system is dropped by one", async () => {
    const vault = new MemoryVault();
    vault.addFolder("Systems/demo", completeSystem());
    const library = libraryWith(
      [{ type: "bundled", id: "simple", active: true }, VAULT_ENTRY],
      vault
    );
    const simple = await library.get("simple");
    const demo = await library.get("demo");
    library.setEntries([{ type: "bundled", id: "simple", active: true }, VAULT_ENTRY]);
    expect(await library.get("simple")).toBe(simple);
    expect(await library.get("demo")).not.toBe(demo);
  });
});

describe("what an entry is called", () => {
  it("is the manifest's name for a bundled entry, switched on or off", async () => {
    const library = libraryWith([]);
    expect(await library.nameOf({ type: "bundled", id: "simple", active: false })).toBe(
      "Simple"
    );
  });

  it("is what a vault entry's document says now, whatever the switch says", async () => {
    const vault = new MemoryVault();
    vault.addFolder("Systems/demo", completeSystem());
    const library = libraryWith([VAULT_ENTRY], vault);
    await library.get("demo"); // loaded and cached under the old name
    expect(await library.nameOf(VAULT_ENTRY)).toBe("Demo");

    vault.files["Systems/demo/game-system.yaml"] = (
      vault.files["Systems/demo/game-system.yaml"] as string
    ).replace("name: Demo", "name: Renamed");
    expect(await library.nameOf(VAULT_ENTRY)).toBe("Renamed");
    expect(await library.nameOf({ ...VAULT_ENTRY, active: false })).toBe("Renamed");
  });

  it("is the id when the document cannot be read", async () => {
    const library = libraryWith([VAULT_ENTRY]);
    expect(await library.nameOf(VAULT_ENTRY)).toBe("demo");
  });
});

describe("inspecting a root document before registering it", () => {
  it("returns the id to store and no reports for a complete system", async () => {
    const vault = new MemoryVault();
    vault.addFolder("Systems/demo", completeSystem());
    const library = libraryWith([], vault);
    expect(await library.inspectVaultDocument("Systems/demo/game-system.yaml")).toEqual({
      id: "demo",
      messages: [],
    });
  });

  it("takes the document under any name, and the folder around it as the system", async () => {
    const vault = new MemoryVault();
    const files = completeSystem();
    files["demo.yml"] = files["game-system.yaml"]!;
    delete files["game-system.yaml"];
    vault.addFolder("Systems/demo", files);
    const library = libraryWith([], vault);
    expect(await library.inspectVaultDocument("Systems/demo/demo.yml")).toEqual({
      id: "demo",
      messages: [],
    });
  });

  it("returns no id for a file that is not there", async () => {
    const library = libraryWith([], new MemoryVault({ "Systems/x/notes.md": "" }));
    const result = await library.inspectVaultDocument("Systems/x/x.yaml");
    expect(result.id).toBeUndefined();
    expect(result.messages).toEqual(["Systems/x: no x.yaml; not a system"]);
  });

  it("refuses a file that is not YAML, and one at the vault root", async () => {
    const library = libraryWith([]);
    expect(
      (await library.inspectVaultDocument("Systems/x/notes.md")).messages[0]
    ).toMatch(/\.yaml or \.yml/);
    expect((await library.inspectVaultDocument("demo.yaml")).messages[0]).toMatch(
      /folder of its own/
    );
  });

  it("refuses a hidden folder, where no change would ever be noticed", async () => {
    const library = libraryWith([]);
    const result = await library.inspectVaultDocument(".obsidian/systems/demo/demo.yaml");
    expect(result.id).toBeUndefined();
    expect(result.messages[0]).toMatch(/hidden folder/);
  });
});
