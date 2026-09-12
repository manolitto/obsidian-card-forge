import { describe, expect, it } from "vitest";
import { collectDiagnostics } from "../src/definitions/diagnostics";
import {
  parsePropertyDefs,
  propertyDescription,
  propertySample,
  resolvePropertyDefs,
} from "../src/definitions/property-defs";
import { props, yaml } from "./helpers/definitions";

describe("parsePropertyDefs", () => {
  it("folds canonical keys and alias entries to lowercase", () => {
    // Note frontmatter keys are folded too; the two have to meet somewhere.
    const map = props(["Hit-Points: { aliases: [TP, Lebenspunkte] }"]);
    expect(map["hit-points"]?.aliases).toEqual(["tp", "lebenspunkte"]);
  });

  it("accepts an entry with no metadata at all", () => {
    // `key:` and `key: ~` declare the property and say nothing else, which is
    // what a layer does when it only wants the name to exist.
    const map = props(["bare:\nnulled: ~\nempty: {}"]);
    expect(Object.keys(map).sort()).toEqual(["bare", "empty", "nulled"]);
  });

  it("reads a single alias written as a bare string", () => {
    expect(props(["grip: { aliases: griff }"])["grip"]?.aliases).toEqual(["griff"]);
  });

  it("drops a canonical listed as its own alias", () => {
    expect(props(["name: { aliases: [name, titel] }"])["name"]?.aliases).toEqual([
      "titel",
    ]);
  });

  it("dedupes an alias list", () => {
    expect(props(["name: { aliases: [titel, titel] }"])["name"]?.aliases).toEqual([
      "titel",
    ]);
  });

  it("tells an absent sample from one declared empty", () => {
    const map = props(["silent: {}\nexplicit: { sample: ~ }"]);
    expect("sample" in (map["silent"] ?? {})).toBe(false);
    expect(map["explicit"]?.sample).toBeNull();
  });

  it("reports a block that is not a mapping", () => {
    const diagnostics = collectDiagnostics();
    expect(parsePropertyDefs(["name"], diagnostics)).toBeUndefined();
    expect(diagnostics.matching("must be a mapping")).toHaveLength(1);
  });

  it("tells an absent block from an empty one", () => {
    const diagnostics = collectDiagnostics();
    expect(parsePropertyDefs(undefined, diagnostics)).toBeUndefined();
    expect(parsePropertyDefs(yaml("{}"), diagnostics)).toEqual({});
    expect(diagnostics.messages).toEqual([]);
  });

  it("reports a field that is not a property field", () => {
    const diagnostics = collectDiagnostics();
    props(["name: { descriptoin: oops }"], diagnostics);
    expect(diagnostics.matching("descriptoin")).toHaveLength(1);
  });

  it("reports an alias list that is not a list", () => {
    const diagnostics = collectDiagnostics();
    const map = props(["name: { aliases: { de: titel } }"], diagnostics);
    expect(map["name"]?.aliases).toBeUndefined();
    expect(diagnostics.matching("properties.name.aliases")).toHaveLength(1);
  });
});

describe("mergePropertyDefs — aliases", () => {
  it("appends by default", () => {
    const map = props(["image: { aliases: [img] }", "image: { aliases: [bild] }"]);
    expect(map["image"]?.aliases).toEqual(["img", "bild"]);
  });

  it("only ever grows the list — nothing removes an inherited alias", () => {
    // `aliases-replace:` was measured before it was ported: 351 uses of
    // `aliases:` across the predecessor's twelve systems, zero of the escape
    // hatch. An alias reserves no name, so an inherited one costs nothing.
    const diagnostics = collectDiagnostics();
    const map = props(
      ["image: { aliases: [img] }", "image: { aliases-replace: [bild] }"],
      diagnostics
    );
    expect(map["image"]?.aliases).toEqual(["img"]);
    expect(diagnostics.matching("aliases-replace")).toHaveLength(1);
  });

  it("leaves an inherited list alone when the layer says nothing", () => {
    const map = props(["image: { aliases: [img] }", "image: { description: A picture }"]);
    expect(map["image"]?.aliases).toEqual(["img"]);
  });

  it("does not let a resolved layer leak into its base", () => {
    const base = props(["image: { aliases: [img] }"]);
    const higher = resolvePropertyDefs([base, { image: { aliases: ["bild"] } }]);
    expect(higher["image"]?.aliases).toEqual(["img", "bild"]);
    expect(base["image"]?.aliases).toEqual(["img"]);
  });
});

describe("mergePropertyDefs — the other fields", () => {
  it("lets the highest layer that sets a field win", () => {
    const map = props([
      "grip: { description: { en: Grip }, sample: 1H }",
      "grip: { description: { en: Handling } }",
    ]);
    expect(map["grip"]?.description).toEqual({ en: "Handling" });
    expect(map["grip"]?.sample).toBe("1H");
  });

  it("lets a higher layer clear a field it inherited", () => {
    const map = props(["grip: { sample: 1H }", "grip: { sample: ~ }"]);
    expect(map["grip"]?.sample).toBeNull();
  });

  it("introduces a property a lower layer never mentioned", () => {
    const map = props(["name: {}", "grip: { aliases: [griff] }"]);
    expect(map["grip"]?.aliases).toEqual(["griff"]);
  });
});

describe("resolvePropertyDefs", () => {
  it("folds baseline, system and card type in that order", () => {
    const baseline = props(["name: { aliases: [title] }"]);
    const system = props(["name: { aliases: [titel] }"]);
    const cardType = props(["name: { aliases: [bezeichnung] }"]);
    const resolved = resolvePropertyDefs([baseline, system, cardType]);
    expect(resolved["name"]?.aliases).toEqual(["title", "titel", "bezeichnung"]);
  });

  it("skips a layer that declared nothing", () => {
    const resolved = resolvePropertyDefs([
      props(["name: { aliases: [title] }"]),
      undefined,
    ]);
    expect(resolved["name"]?.aliases).toEqual(["title"]);
  });
});

describe("reading a def", () => {
  it("picks the description for the card's language", () => {
    const def = props(["roll: { description: { de: Würfelwurf, en: Die roll } }"])[
      "roll"
    ];
    expect(propertyDescription(def, "de")).toBe("Würfelwurf");
    expect(propertyDescription(def, "en")).toBe("Die roll");
  });

  it("falls back to the first language declared", () => {
    // A system documented in German only should still say something to an
    // English reader rather than nothing at all.
    const def = props(["roll: { description: { de: Würfelwurf } }"])["roll"];
    expect(propertyDescription(def, "en")).toBe("Würfelwurf");
  });

  it("returns a description written once as-is", () => {
    const def = props(["roll: { description: Die roll }"])["roll"];
    expect(propertyDescription(def, "de")).toBe("Die roll");
  });

  it("picks the sample for the card's language", () => {
    const def = props(["roll: { sample: { de: '01', en: '1' } }"])["roll"];
    expect(propertySample(def, "de")).toBe("01");
  });

  it("treats a sample whose keys are not language codes as the value itself", () => {
    const def = props(["attack: { sample: { name: Bite, damage: 1d6 } }"])["attack"];
    expect(propertySample(def, "de")).toEqual({ name: "Bite", damage: "1d6" });
  });

  it("hands back a list sample untouched", () => {
    const def = props(["traits: { sample: [Bestie, Klein] }"])["traits"];
    expect(propertySample(def, "de")).toEqual(["Bestie", "Klein"]);
  });

  it("says nothing when nothing is declared", () => {
    expect(propertyDescription(undefined, "de")).toBeUndefined();
    expect(propertySample(props(["roll: {}"])["roll"], "de")).toBeUndefined();
  });
});
