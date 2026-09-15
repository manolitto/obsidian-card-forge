import { describe, expect, it } from "vitest";
import { loadNoteYaml, repairLinkArrays } from "../src/render/yaml";

describe("loadNoteYaml", () => {
  it("keeps an unquoted wikilink a string, at the top level and nested", () => {
    expect(loadNoteYaml("image: [[Beil.png]]")).toEqual({ image: "[[Beil.png]]" });
    expect(loadNoteYaml("data:\n  image: [[Beil.png]]\ncard:\n  system: x")).toEqual({
      data: { image: "[[Beil.png]]" },
      card: { system: "x" },
    });
  });

  it("keeps an aliased wikilink whole", () => {
    expect(loadNoteYaml("source: [[Rules.pdf#page=6|p. 4]]")).toEqual({
      source: "[[Rules.pdf#page=6|p. 4]]",
    });
  });

  it("does not read an embed as a tag", () => {
    expect(loadNoteYaml("image: ![[Beil.png]]")).toEqual({ image: "![[Beil.png]]" });
    expect(loadNoteYaml("image: ![[Beil.png|Alt]]")).toEqual({
      image: "![[Beil.png|Alt]]",
    });
  });

  it("leaves a quoted link as it is", () => {
    expect(loadNoteYaml('image: "[[Beil.png]]"')).toEqual({ image: "[[Beil.png]]" });
    expect(loadNoteYaml('image: "![[Beil.png]]"')).toEqual({ image: "![[Beil.png]]" });
  });

  it("keeps both forms apart in one document", () => {
    expect(loadNoteYaml("a: [[x]]\nb: ![[y]]\nc: [[z|Z]]")).toEqual({
      a: "[[x]]",
      b: "![[y]]",
      c: "[[z|Z]]",
    });
  });

  it("leaves a genuine list a list, and a list of mappings with links inside", () => {
    expect(loadNoteYaml("traits: [Tier, Humanoider]")).toEqual({
      traits: ["Tier", "Humanoider"],
    });
    expect(loadNoteYaml("items:\n  - { name: a, link: [[x]] }")).toEqual({
      items: [{ name: "a", link: "[[x]]" }],
    });
  });

  it("keeps a date-like value the text it was written as", () => {
    expect(loadNoteYaml("when: 2024-01-01")).toEqual({ when: "2024-01-01" });
  });

  it("is null for empty input and throws for broken YAML", () => {
    expect(loadNoteYaml("  \n")).toBeNull();
    expect(() => loadNoteYaml("a: [unclosed")).toThrow();
  });
});

describe("repairLinkArrays", () => {
  it("folds the [[x]] list shape back into its link, wherever it sits", () => {
    expect(repairLinkArrays([["Foo.png"]])).toBe("[[Foo.png]]");
    expect(repairLinkArrays({ image: [["Foo.png|Alt"]] })).toEqual({
      image: "[[Foo.png|Alt]]",
    });
    expect(repairLinkArrays([{ image: [["a"]] }])).toEqual([{ image: "[[a]]" }]);
  });

  it("leaves everything else untouched", () => {
    expect(repairLinkArrays(["a", "b"])).toEqual(["a", "b"]);
    expect(repairLinkArrays([{ a: 1 }])).toEqual([{ a: 1 }]);
    expect(repairLinkArrays([])).toEqual([]);
    expect(repairLinkArrays(3)).toBe(3);
    expect(repairLinkArrays(null)).toBeNull();
    expect(repairLinkArrays("[[x]]")).toBe("[[x]]");
  });
});
