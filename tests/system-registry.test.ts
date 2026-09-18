import { describe, expect, it } from "vitest";
import {
  entriesAfterToggle,
  findDuplicateActiveIds,
  reconcileSystemEntries,
} from "../src/settings/system-registry";
import type { SystemEntry } from "../src/settings/types";

const bundled = (id: string, active = true): SystemEntry => ({
  type: "bundled",
  id,
  active,
});
const vault = (id: string, path: string, active = true): SystemEntry => ({
  type: "vault",
  id,
  path,
  active,
});

describe("reconcileSystemEntries", () => {
  it("appends a bundled system the saved registry has never seen, active", () => {
    const result = reconcileSystemEntries([bundled("simple")], ["simple", "dragonbane"]);
    expect(result).toEqual([bundled("simple"), bundled("dragonbane")]);
  });

  it("keeps the saved active flag rather than resetting it", () => {
    const result = reconcileSystemEntries([bundled("simple", false)], ["simple"]);
    expect(result).toEqual([bundled("simple", false)]);
  });

  it("drops a bundled entry for a system the build no longer ships", () => {
    const result = reconcileSystemEntries(
      [bundled("gone"), bundled("simple")],
      ["simple"]
    );
    expect(result).toEqual([bundled("simple")]);
  });

  it("keeps vault entries in place", () => {
    const mine = vault("mine", "cardsmith/mine", false);
    const result = reconcileSystemEntries([mine, bundled("simple")], ["simple"]);
    expect(result).toEqual([mine, bundled("simple")]);
  });

  it("rebuilds every entry from its known keys, so nothing else in the saved file survives", () => {
    const saved = [
      { ...vault("mine", "cardsmith/mine"), name: "Mine", note: "x" },
      { ...bundled("simple"), name: "Simple" },
    ] as unknown as SystemEntry[];
    const result = reconcileSystemEntries(saved, ["simple"]);
    expect(result).toEqual([vault("mine", "cardsmith/mine"), bundled("simple")]);
    expect(Object.keys(result[0]!)).toEqual(["type", "id", "path", "active"]);
  });

  it("populates an empty registry from the shipped systems", () => {
    expect(reconcileSystemEntries([], ["simple"])).toEqual([bundled("simple")]);
  });
});

describe("entriesAfterToggle", () => {
  it("switching on takes the id: every other active claimant goes off", () => {
    const original = bundled("dragonbane");
    const copy = vault("dragonbane", "cardsmith/db", false);
    const other = vault("dragonbane", "cardsmith/db2");
    const out = entriesAfterToggle(
      [original, copy, other, bundled("simple")],
      copy,
      true
    );
    expect(out).toEqual([
      bundled("dragonbane", false),
      vault("dragonbane", "cardsmith/db"),
      vault("dragonbane", "cardsmith/db2", false),
      bundled("simple"),
    ]);
    expect(findDuplicateActiveIds(out)).toEqual([]);
  });

  it("switching off touches nothing else", () => {
    const entries = [bundled("dragonbane"), vault("dragonbane", "cardsmith/db")];
    const out = entriesAfterToggle(entries, entries[0]!, false);
    expect(out).toEqual([
      bundled("dragonbane", false),
      vault("dragonbane", "cardsmith/db"),
    ]);
  });

  it("does not mutate the entries it was given", () => {
    const entries = [bundled("dragonbane", false)];
    entriesAfterToggle(entries, entries[0]!, true);
    expect(entries[0]!.active).toBe(false);
  });
});

describe("findDuplicateActiveIds", () => {
  it("says nothing when a vault copy shadows a switched-off bundled original", () => {
    const entries = [bundled("dragonbane", false), vault("dragonbane", "cardsmith/db")];
    expect(findDuplicateActiveIds(entries)).toEqual([]);
  });

  it("reports the id when both are active", () => {
    const entries = [bundled("dragonbane"), vault("dragonbane", "cardsmith/db")];
    expect(findDuplicateActiveIds(entries)).toEqual(["dragonbane"]);
  });

  it("reports each duplicated id once", () => {
    const entries = [
      bundled("a"),
      vault("a", "x"),
      vault("a", "y"),
      bundled("b"),
      vault("b", "z"),
    ];
    expect(findDuplicateActiveIds(entries)).toEqual(["a", "b"]);
  });
});
