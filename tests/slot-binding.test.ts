import { describe, expect, it } from "vitest";
import { buildAliasMap } from "../src/definitions/bindings";
import { prepareCardProps } from "../src/definitions/card-props";
import { collectDiagnostics } from "../src/definitions/diagnostics";
import { props } from "./helpers/definitions";

/**
 * The binding between a property and the place it fills.
 *
 * A slot is declared nowhere but in the template that reads it. What YAML says
 * is which property fills it — `slot:` on the property — and that folds into
 * the one alias map the resolving proxy reads through. So what follows is about
 * that folding: what lands in the map, in what order, and what survives a
 * higher layer.
 */

const aliasMap = buildAliasMap;

// ── A property names the place it fills ───────────────────────────────

describe("a property names its place", () => {
  it("lands the binding in the map, slot → property", () => {
    const map = aliasMap(props(["grip: { slot: front-stat-1a }"]));
    expect(map["front-stat-1a"]).toEqual(["grip"]);
  });

  it("binds to every slot in a list", () => {
    const map = aliasMap(
      props(["category: { slot: [front-header-title, back-header-title] }"])
    );
    expect(map["front-header-title"]).toEqual(["category"]);
    expect(map["back-header-title"]).toEqual(["category"]);
  });

  it("drops a binding that names its own property, and says so", () => {
    const diagnostics = collectDiagnostics();
    const map = buildAliasMap(props(["grip: { slot: grip }"], diagnostics));
    expect(map["grip"]).toBeUndefined();
    expect(diagnostics.matching("self-reference")).toHaveLength(1);
  });
});

// ── `slot:` REPLACES across layers ────────────────────────────────────

describe("a higher layer re-binding a property", () => {
  it("replaces the inherited binding rather than adding to it", () => {
    // The sharpest edge in the design, and the reason it gets a test rather
    // than a comment: a card type that re-binds a property inherits nothing.
    const map = aliasMap(
      props(["grip: { slot: front-stat-1a }", "grip: { slot: front-stat-7a }"])
    );
    expect(map["front-stat-1a"]).toBeUndefined();
    expect(map["front-stat-7a"]).toEqual(["grip"]);
  });

  it("silently empties the other face when a card type forgets to restate it", () => {
    // This is what it costs, spelled out: the system binds `category` to the
    // card BACK, the card type wants it on the front too and says only that —
    // and the back loses its title. It renders, it just renders nothing.
    const system = "category: { slot: back-header-title }";
    const forgetful = aliasMap(props([system, "category: { slot: front-header-title }"]));
    expect(forgetful["back-header-title"]).toBeUndefined();

    // The two ways out. Restate every target:
    const restated = aliasMap(
      props([system, "category: { slot: [back-header-title, front-header-title] }"])
    );
    expect(restated["back-header-title"]).toEqual(["category"]);
    expect(restated["front-header-title"]).toEqual(["category"]);

    // …or declare a second property that reads the same value, which is what a
    // roll table does to show its own name on the front.
    const aliased = aliasMap(
      props([system, "table-name: { slot: front-header-title, aliases: [category] }"])
    );
    expect(aliased["back-header-title"]).toEqual(["category"]);
    expect(aliased["front-header-title"]).toEqual(["table-name"]);
  });

  it("unbinds a property entirely with `slot: ~`", () => {
    const map = aliasMap(
      props(["reference: { slot: front-side-right }", "reference: { slot: ~ }"])
    );
    expect(map["front-side-right"]).toBeUndefined();
  });

  it("keeps a binding the higher layer does not mention", () => {
    const map = aliasMap(
      props(["grip: { slot: front-stat-1a }", "grip: { sample: 2H }"])
    );
    expect(map["front-stat-1a"]).toEqual(["grip"]);
  });
});

// ── Order decides which property a slot shows ─────────────────────────

describe("when several properties fill one slot", () => {
  it("follows the order the properties were written in", () => {
    const map = aliasMap(
      props([
        "name: { slot: front-header-title }\ncategory: { slot: front-header-title }",
      ])
    );
    expect(map["front-header-title"]).toEqual(["name", "category"]);
  });

  it("reorders the priority when the lines are reordered", () => {
    const map = aliasMap(
      props([
        "category: { slot: front-header-title }\nname: { slot: front-header-title }",
      ])
    );
    expect(map["front-header-title"]).toEqual(["category", "name"]);
  });

  it("puts a higher layer's own property behind the ones it inherited", () => {
    // Priority is the order of the resolved map — inherited first — and that
    // is all.
    const map = aliasMap(
      props([
        "name: { slot: front-header-title }",
        "category: { slot: front-header-title }",
      ])
    );
    expect(map["front-header-title"]).toEqual(["name", "category"]);
  });

  it("shows the first bound property the note actually set", () => {
    const defs = props([
      "name: { slot: front-header-title }\ncategory: { slot: front-header-title, aliases: [kategorie] }",
    ]);
    const aliases = aliasMap(defs);
    const card = prepareCardProps(
      { name: "Wolfsrudel", kategorie: "Jagdbeute" },
      { aliases, defs, fileName: "Wolfsrudel" }
    );
    expect(card["front-header-title"]).toBe("Wolfsrudel");
    // …and the chain still reaches the German spelling of the second one.
    expect(card["category"]).toBe("Jagdbeute");
  });
});

// ── The read chain ────────────────────────────────────────────────────

describe("reading through the chain", () => {
  it("reaches the German key the note actually writes, two hops out", () => {
    const defs = props(["grip: { slot: front-stat-1a, aliases: [griff] }"]);
    const aliases = aliasMap(defs);
    const card = prepareCardProps({ Griff: "1H" }, { aliases, defs, fileName: "Beil" });
    // slot → property → the property's own spelling.
    expect(card["front-stat-1a"]).toBe("1H");
    expect(card["grip"]).toBe("1H");
  });

  it("leaves a slot nothing fills empty", () => {
    const defs = props(["grip: { slot: front-stat-1a }"]);
    const aliases = aliasMap(defs);
    const card = prepareCardProps({ grip: "1H" }, { aliases, defs, fileName: "Beil" });
    expect(card["front-stat-2a"]).toBeUndefined();
  });
});

// ── There is no slot registry ─────────────────────────────────────────

describe("a slot that nothing declares", () => {
  it("is bound anyway — a slot exists because a template reads it", () => {
    // The only other place a slot is named is the template, and that is not a
    // definition concern. Whether `front-stat-9z` is a typo is a question for
    // whoever holds the template source.
    const map = aliasMap(props(["grip: { slot: front-stat-9z }"]));
    expect(map["front-stat-9z"]).toEqual(["grip"]);
  });
});

// ── `default:` — the value when the note says nothing ─────────────────

describe("a property's default", () => {
  const cardFrom = (raw: Record<string, unknown>, ...layers: string[]) => {
    const defs = props(layers);
    return prepareCardProps(raw, { aliases: aliasMap(defs), defs, fileName: "Troll" });
  };

  it("fills in when the note names nothing", () => {
    expect(cardFrom({}, "category: { default: Monster }")["category"]).toBe("Monster");
  });

  it("keeps out of the way when the note sets the canonical", () => {
    expect(
      cardFrom({ category: "Drache" }, "category: { default: Monster }")["category"]
    ).toBe("Drache");
  });

  it("keeps out of the way when the note answers under an alias", () => {
    // Its own case because the default is written onto the canonical: a naive
    // check would overwrite the German spelling and then win the alias walk.
    const card = cardFrom(
      { kategorie: "Drache" },
      "category: { default: Monster, aliases: [kategorie] }"
    );
    expect(card["category"]).toBe("Drache");
    expect(card["kategorie"]).toBe("Drache");
  });

  it("treats an empty value as unanswered", () => {
    expect(cardFrom({ category: "" }, "category: { default: Monster }")["category"]).toBe(
      "Monster"
    );
  });

  it("reaches a slot through the binding, like a written value would", () => {
    const defs = props(["category: { default: Monster, slot: back-header-title }"]);
    const aliases = aliasMap(defs);
    const card = prepareCardProps({}, { aliases, defs, fileName: "Troll" });
    expect(card["back-header-title"]).toBe("Monster");
  });

  it("lets a higher layer replace the one it inherited", () => {
    const card = cardFrom(
      {},
      "category: { default: Monster }",
      "category: { default: NSC }"
    );
    expect(card["category"]).toBe("NSC");
  });

  it("invents nothing for a property that declares no default", () => {
    expect(
      cardFrom({}, "category: { aliases: [kategorie] }")["category"]
    ).toBeUndefined();
  });
});
