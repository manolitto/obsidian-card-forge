import { describe, expect, it } from "vitest";
import {
  entriesAfterAdd,
  entriesAfterCopy,
  findDuplicateActiveIds,
  isSystemId,
} from "../src/settings/system-registry";
import type { SystemEntry } from "../src/settings/types";
import { SystemLibrary } from "../src/systems/library";
import {
  namesSystem,
  rewriteDeclaration,
  rewriteSystemId,
} from "../src/ui/copy-rewrites";
import { completeSystem, MemoryVault } from "./helpers/systems";

/**
 * The pure parts of copying a bundled system into the vault: the root
 * document with the chosen id and name, the note rewrite that touches
 * `system:` inside the two card fences and nothing else, and the registry
 * after a copy with the id kept or changed.
 */

describe("rewriteDeclaration", () => {
  const DOC = "# The system\nid: dragonbane\nname: Dragonbane\nlanguages: [de]\n";

  it("sets id and name in place, the name quoted", () => {
    expect(rewriteDeclaration(DOC, "dragonbane-mine", "My Dragonbane")).toBe(
      '# The system\nid: dragonbane-mine\nname: "My Dragonbane"\nlanguages: [de]\n'
    );
  });

  it("adds name: under id: when the document leaves the name to the id", () => {
    expect(rewriteDeclaration("id: demo\ncard-types: {}\n", "demo", "My Demo")).toBe(
      'id: demo\nname: "My Demo"\ncard-types: {}\n'
    );
  });

  it("keeps the document's line endings", () => {
    const crlf = "id: demo\r\ncard-types: {}\r\n";
    expect(rewriteDeclaration(crlf, "demo", "Mine")).toBe(
      'id: demo\r\nname: "Mine"\r\ncard-types: {}\r\n'
    );
  });

  it("keeps a colon or a hash in the name a name", () => {
    expect(rewriteDeclaration(DOC, "dragonbane", "Dragonbane: mine #2")).toContain(
      'name: "Dragonbane: mine #2"'
    );
  });
});

const NOTE = [
  "---",
  "system: dragonbane",
  "tags: [dragonbane]",
  "---",
  "# A card of system: dragonbane",
  "",
  "```cardsmith",
  "card:",
  "  system: dragonbane",
  "  card-type: gear",
  "data:",
  "  name: Spear",
  "```",
  "",
  "```yaml",
  "system: dragonbane",
  "```",
  "",
  "```cardsmith-deck",
  'system: "dragonbane" # the deck',
  "card-type: gear",
  "```",
  "",
].join("\n");

describe("rewriteSystemId", () => {
  it("rewrites the key inside both card fences and nowhere else", () => {
    const out = rewriteSystemId(NOTE, "dragonbane", "dragonbane-mine");
    expect(out).toContain("  system: dragonbane-mine\n  card-type: gear");
    expect(out).toContain('system: "dragonbane-mine" # the deck');
    // The frontmatter, the prose and the other fence are as they were.
    expect(out).toContain("---\nsystem: dragonbane\ntags");
    expect(out).toContain("# A card of system: dragonbane");
    expect(out).toContain("```yaml\nsystem: dragonbane\n```");
    expect(out.split("dragonbane-mine")).toHaveLength(3);
  });

  it("keeps the note's line endings", () => {
    const crlf = NOTE.replace(/\n/g, "\r\n");
    const out = rewriteSystemId(crlf, "dragonbane", "db");
    expect(out).not.toContain("\n\n");
    expect(out.split("\r\n")).toHaveLength(crlf.split("\r\n").length);
    expect(out).toContain("  system: db\r\n");
  });

  it("leaves another id, and a fence that never closes, alone", () => {
    expect(rewriteSystemId(NOTE, "simple", "x")).toBe(NOTE);
    const open = "```cardsmith\ncard:\n  system: dragonbane\n";
    expect(rewriteSystemId(open, "dragonbane", "x")).toBe(
      "```cardsmith\ncard:\n  system: x\n"
    );
  });

  it("matches the id whatever its case, as the parser reads it", () => {
    const out = rewriteSystemId(
      "```cardsmith\ncard:\n  system: Dragonbane\n```",
      "dragonbane",
      "x"
    );
    expect(out).toContain("system: x");
  });
});

describe("namesSystem", () => {
  it("is true for a note whose fence names the id, false otherwise", () => {
    expect(namesSystem(NOTE, "dragonbane")).toBe(true);
    expect(namesSystem(NOTE, "simple")).toBe(false);
    expect(namesSystem("---\nsystem: dragonbane\n---\n", "dragonbane")).toBe(false);
  });
});

describe("entriesAfterCopy", () => {
  const bundled: SystemEntry = { type: "bundled", id: "dragonbane", active: true };
  const other: SystemEntry = { type: "bundled", id: "simple", active: true };

  it("with the id kept: the bundled entry off, the copy on, no duplicate", () => {
    const out = entriesAfterCopy(
      [other, bundled],
      "dragonbane",
      "dragonbane",
      "cardsmith/dragonbane/dragonbane.yaml"
    );
    expect(out).toEqual([
      other,
      { type: "bundled", id: "dragonbane", active: false },
      {
        type: "vault",
        id: "dragonbane",
        path: "cardsmith/dragonbane/dragonbane.yaml",
        active: true,
      },
    ]);
    expect(findDuplicateActiveIds(out)).toEqual([]);
  });

  it("with a new id: both on, no duplicate", () => {
    const out = entriesAfterCopy(
      [bundled],
      "dragonbane",
      "dragonbane-mine",
      "cardsmith/mine/dragonbane.yaml"
    );
    expect(out).toEqual([
      bundled,
      {
        type: "vault",
        id: "dragonbane-mine",
        path: "cardsmith/mine/dragonbane.yaml",
        active: true,
      },
    ]);
    expect(findDuplicateActiveIds(out)).toEqual([]);
  });

  it("does not mutate the entries it was given", () => {
    const entries = [{ ...bundled }];
    entriesAfterCopy(entries, "dragonbane", "dragonbane", "x");
    expect(entries[0]!.active).toBe(true);
  });
});

describe("isSystemId", () => {
  it("accepts lowercase letters, digits and hyphens and refuses the rest", () => {
    expect(isSystemId("dragonbane-mine")).toBe(true);
    expect(isSystemId("db2")).toBe(true);
    expect(isSystemId("Dragonbane")).toBe(false);
    expect(isSystemId("my system")).toBe(false);
    expect(isSystemId("")).toBe(false);
  });
});

describe("the library after a registry change", () => {
  it("answers as the invariant says once a loaded bundled id is claimed twice, and again when it is not", async () => {
    const vault = new MemoryVault();
    const files = completeSystem();
    files["game-system.yaml"] = files["game-system.yaml"]!.toString().replace(
      "id: demo",
      "id: simple"
    );
    vault.addFolder("Systems/simple", files);
    const library = new SystemLibrary(vault);
    const bundled: SystemEntry = { type: "bundled", id: "simple", active: true };
    const copy: SystemEntry = {
      type: "vault",
      id: "simple",
      path: "Systems/simple/game-system.yaml",
      active: true,
    };

    library.setEntries([bundled]);
    expect((await library.load("simple")).system?.source.kind).toBe("bundled");

    library.setEntries([bundled, copy]);
    expect((await library.load("simple")).messages[0]).toMatch(/enabled more than once/);

    library.setEntries([{ ...bundled, active: false }, copy]);
    expect((await library.load("simple")).system?.source.kind).toBe("vault");

    library.setEntries([bundled]);
    expect((await library.load("simple")).system?.source.kind).toBe("bundled");
  });

  it("loads a bundled system for copying whatever its switch says", async () => {
    const library = new SystemLibrary(new MemoryVault());
    library.setEntries([{ type: "bundled", id: "simple", active: false }]);
    expect((await library.load("simple")).system).toBeUndefined();
    expect((await library.loadBundled("simple")).system?.id).toBe("simple");
    expect((await library.loadBundled("nothing")).messages[0]).toMatch(/not bundled/);
  });
});

describe("entriesAfterAdd", () => {
  it("switches off every other system of the same id, bundled or vault, and names them", () => {
    const bundled: SystemEntry = { type: "bundled", id: "simple", active: true };
    const other: SystemEntry = { type: "bundled", id: "dragonbane", active: true };
    const older: SystemEntry = {
      type: "vault",
      id: "simple",
      path: "old/simple.yaml",
      active: true,
    };
    const off: SystemEntry = {
      type: "vault",
      id: "simple",
      path: "off/simple.yaml",
      active: false,
    };
    const { entries, switchedOff } = entriesAfterAdd(
      [bundled, other, older, off],
      "simple",
      "cardsmith/simple/simple.yaml"
    );
    expect(switchedOff).toEqual([bundled, older]);
    expect(entries).toEqual([
      { ...bundled, active: false },
      other,
      { ...older, active: false },
      off,
      { type: "vault", id: "simple", path: "cardsmith/simple/simple.yaml", active: true },
    ]);
    expect(findDuplicateActiveIds(entries)).toEqual([]);
  });

  it("switches nothing off for a new id", () => {
    const bundled: SystemEntry = { type: "bundled", id: "simple", active: true };
    const { entries, switchedOff } = entriesAfterAdd([bundled], "mine", "mine/mine.yaml");
    expect(switchedOff).toEqual([]);
    expect(entries).toEqual([
      bundled,
      { type: "vault", id: "mine", path: "mine/mine.yaml", active: true },
    ]);
  });
});
