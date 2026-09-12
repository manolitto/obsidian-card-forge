import { describe, expect, it } from "vitest";
import type { AliasMap } from "../src/definitions/bindings";
import { prepareCardProps } from "../src/definitions/card-props";
import { collectDiagnostics } from "../src/definitions/diagnostics";
import { props } from "./helpers/definitions";

const card = (raw: Record<string, unknown>, aliases: AliasMap = {}, fileName?: string) =>
  prepareCardProps(raw, { aliases, fileName });

describe("the keys a note wrote", () => {
  it("folds them to lowercase", () => {
    expect(card({ Bezeichnung: "Beil" })["bezeichnung"]).toBe("Beil");
  });

  it("leaves the caller's object alone", () => {
    const raw = { Name: "Beil" };
    card(raw);
    expect(raw).toEqual({ Name: "Beil" });
  });

  it("enumerates the note's own keys, not the names that merely resolve", () => {
    // The proxy adds a read-through layer; it does not invent properties. A
    // query over the note sees what the author wrote.
    const resolved = card({ img: "beil.png" }, { image: ["img"] });
    expect(Object.keys(resolved)).toEqual(["img"]);
  });
});

describe("reading through the alias map", () => {
  const ALIASES: AliasMap = { image: ["img", "picture"] };

  it("returns a direct hit before anything else", () => {
    expect(card({ image: "a.png", img: "b.png" }, ALIASES)["image"]).toBe("a.png");
  });

  it("keeps each explicit value when a note sets both names", () => {
    // Unusual but legitimate, and nothing is dropped: the author meant it.
    const resolved = card({ image: "a.png", img: "b.png" }, ALIASES);
    expect(resolved["image"]).toBe("a.png");
    expect(resolved["img"]).toBe("b.png");
  });

  it("lets a canonical fall back to its aliases, in declaration order", () => {
    expect(card({ picture: "b.png", img: "a.png" }, ALIASES)["image"]).toBe("a.png");
  });

  it("lets an alias fall back to the canonical", () => {
    expect(card({ image: "a.png" }, ALIASES)["img"]).toBe("a.png");
  });

  it("lets an alias fall back to a sibling alias", () => {
    expect(card({ picture: "a.png" }, ALIASES)["img"]).toBe("a.png");
  });

  it("follows a chain transitively", () => {
    // What makes a slot reach a property's own spellings without restating them.
    const aliases: AliasMap = { "front-stat-1a": ["grip"], grip: ["griff"] };
    expect(card({ griff: "1H" }, aliases)["front-stat-1a"]).toBe("1H");
  });

  it("prefers a direct hit anywhere in the list over a deeper one", () => {
    // Declaration order decides between two names the note could plausibly have
    // written; only when all of them miss does the walk go a level deeper.
    const aliases: AliasMap = { title: ["name", "category"], name: ["bezeichnung"] };
    expect(card({ bezeichnung: "deep", category: "shallow" }, aliases)["title"]).toBe(
      "shallow"
    );
  });

  it("survives a cycle", () => {
    const aliases: AliasMap = { a: ["b"], b: ["a"] };
    expect(card({}, aliases)["a"]).toBeUndefined();
  });

  it("yields nothing for a name nothing knows", () => {
    expect(card({ image: "a.png" }, ALIASES)["nonsense"]).toBeUndefined();
  });

  it("is visible to Handlebars, which gates a lookup on hasOwnProperty", () => {
    // Without the descriptor trap a compiled template never calls `get` at all,
    // and every alias read would come back empty.
    const resolved = card({ img: "a.png" }, ALIASES);
    expect(Object.prototype.hasOwnProperty.call(resolved, "image")).toBe(true);
    expect(Object.getOwnPropertyDescriptor(resolved, "image")?.value).toBe("a.png");
    expect(Object.prototype.hasOwnProperty.call(resolved, "nonsense")).toBe(false);
  });

  it("answers `in` for a name that resolves", () => {
    expect("image" in card({ img: "a.png" }, ALIASES)).toBe(true);
    expect("nonsense" in card({ img: "a.png" }, ALIASES)).toBe(false);
  });
});

describe("the name a card carries", () => {
  const ALIASES: AliasMap = { name: ["title", "bezeichnung"] };

  it("falls back to the note's filename", () => {
    expect(card({}, ALIASES, "Handbeil")["name"]).toBe("Handbeil");
  });

  it("leaves the fallback out when an alias answers", () => {
    // Written as absence rather than as a copy, so the read routes to the
    // alias and the two cannot drift.
    const resolved = card({ bezeichnung: "Beil" }, ALIASES, "Handbeil");
    expect(resolved["name"]).toBe("Beil");
    expect(Object.keys(resolved)).toEqual(["bezeichnung"]);
  });

  it("treats an empty name as no name", () => {
    expect(card({ name: "" }, ALIASES, "Handbeil")["name"]).toBe("Handbeil");
  });

  it("stays out of it when no filename is offered", () => {
    expect(card({}, ALIASES)["name"]).toBeUndefined();
  });
});

describe("a value's shape", () => {
  it("is handed on exactly as the note wrote it", () => {
    // Nothing here reshapes a value. A note that writes one trait where the
    // card shows a list is `{{#slot}}`'s tolerance to extend, at render time —
    // `type:` on a property was the prepare-time version of that and had no
    // reader left once slots lift for themselves.
    const diagnostics = collectDiagnostics();
    const defs = props(["traits: { type: string-list }"], diagnostics);
    const card = prepareCardProps({ traits: "Flink" }, { aliases: {}, defs });
    expect(card["traits"]).toBe("Flink");
    expect(diagnostics.matching("type")).toHaveLength(1);
  });
});
