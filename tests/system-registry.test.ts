import { describe, expect, it } from "vitest";
import {
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

  it("leaves vault entries untouched and in place", () => {
    const mine = vault("mine", "card-forge/mine", false);
    const result = reconcileSystemEntries([mine, bundled("simple")], ["simple"]);
    expect(result).toEqual([mine, bundled("simple")]);
  });

  it("populates an empty registry from the shipped systems", () => {
    expect(reconcileSystemEntries([], ["simple"])).toEqual([bundled("simple")]);
  });
});

describe("findDuplicateActiveIds", () => {
  it("says nothing when a vault copy shadows a switched-off bundled original", () => {
    const entries = [bundled("dragonbane", false), vault("dragonbane", "card-forge/db")];
    expect(findDuplicateActiveIds(entries)).toEqual([]);
  });

  it("reports the id when both are active", () => {
    const entries = [bundled("dragonbane"), vault("dragonbane", "card-forge/db")];
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
