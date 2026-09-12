import { describe, expect, it } from "vitest";
import { buildAliasMap } from "../src/definitions/bindings";
import { prepareCardProps } from "../src/definitions/card-props";
import { collectDiagnostics } from "../src/definitions/diagnostics";
import { parseSystemDeclaration } from "../src/definitions/game-system";
import { resolvePropertyDefs } from "../src/definitions/property-defs";
import { resolveTranslations } from "../src/definitions/translations";
import { yaml } from "./helpers/definitions";

const parse = (source: string, diagnostics = collectDiagnostics()) =>
  parseSystemDeclaration(yaml(source), diagnostics);

const MINIMAL = `
id: simple
name: Simple
languages: [en]
card-types:
  card:
    front-template: front.hbs
`;

describe("what a system says it is", () => {
  it("reads the whole declaration", () => {
    const system = parse(`
id: dragonbane
name: Dragonbane
languages: [de, en]
stylesheet: game-system.css
translations: { de: { back-label: Rückseite } }
partial-templates: { stat-cell: stat-cell.hbs, card-image: card-image.hbs }
markdown-image-partial: card-image
card-types:
  gear:
    front-template: front.hbs
`);
    expect(system?.id).toBe("dragonbane");
    expect(system?.name).toBe("Dragonbane");
    expect(system?.languages).toEqual(["de", "en"]);
    expect(system?.stylesheet).toBe("game-system.css");
    expect(system?.translations).toEqual({ de: { "back-label": "Rückseite" } });
    expect(system?.partialTemplates).toEqual({
      "stat-cell": "stat-cell.hbs",
      "card-image": "card-image.hbs",
    });
    expect(system?.markdownImagePartial).toBe("card-image");
  });

  it("keeps the language order, because the first one is the fallback", () => {
    // A system documented in German shows German to an English reader rather
    // than showing nothing — that is what the order buys.
    expect(parse(MINIMAL.replace("[en]", "[de, en]"))?.languages).toEqual(["de", "en"]);
  });

  it("takes a lone entry as a list of one", () => {
    expect(parse(MINIMAL.replace("[en]", "en"))?.languages).toEqual(["en"]);
  });

  it("lowercases the id and falls the name back to it", () => {
    const system = parse(
      "id: Dragonbane\ncard-types: { gear: { front-template: front.hbs } }"
    );
    expect(system?.id).toBe("dragonbane");
    expect(system?.name).toBe("dragonbane");
  });

  it("gives up on a document with no id", () => {
    const diagnostics = collectDiagnostics();
    expect(parse("name: Nameless", diagnostics)).toBeUndefined();
    expect(diagnostics.matching("no id")).toHaveLength(1);
  });

  it("gives up on a document that is not a mapping", () => {
    const diagnostics = collectDiagnostics();
    expect(parseSystemDeclaration(["id: simple"], diagnostics)).toBeUndefined();
    expect(diagnostics.matching("must be a mapping")).toHaveLength(1);
  });

  it("refuses a markdown image partial that partials: does not declare", () => {
    // The hook is a name into the partials map, and the map is in the same
    // document — so a typo is caught here, not at the first body image.
    const diagnostics = collectDiagnostics();
    const system = parse(`${MINIMAL}\nmarkdown-image-partial: card-imgae`, diagnostics);
    expect(system?.markdownImagePartial).toBeUndefined();
    expect(diagnostics.matching("card-imgae")).toHaveLength(1);
  });

  it("says so when a system declares no languages, and when it declares no card types", () => {
    const diagnostics = collectDiagnostics();
    parse("id: simple", diagnostics);
    expect(diagnostics.matching("no languages")).toHaveLength(1);
    expect(diagnostics.matching("no card types")).toHaveLength(1);
  });
});

describe("a declared path", () => {
  const pathOf = (value: string, diagnostics = collectDiagnostics()) =>
    parse(`${MINIMAL}\nstylesheet: "${value}"`, diagnostics)?.stylesheet;

  it("is carried as written, not resolved", () => {
    expect(pathOf("gear/card-type.css")).toBe("gear/card-type.css");
  });

  it("may not leave the system folder", () => {
    // What keeps "a system is one folder you can copy" true rather than merely
    // usual — the copy-into-vault action depends on it.
    const diagnostics = collectDiagnostics();
    expect(pathOf("../other-system/game-system.css", diagnostics)).toBeUndefined();
    expect(diagnostics.matching("leaves the system folder")).toHaveLength(1);
  });

  it("may not be absolute", () => {
    const diagnostics = collectDiagnostics();
    expect(pathOf("/etc/passwd", diagnostics)).toBeUndefined();
    expect(diagnostics.matching("absolute")).toHaveLength(1);
  });

  it("separates segments with a forward slash on every platform", () => {
    const diagnostics = collectDiagnostics();
    expect(pathOf("gear\\\\card-type.css", diagnostics)).toBeUndefined();
    expect(diagnostics.matching("backslash")).toHaveLength(1);
  });

  it("is not fooled by a `..` inside a name", () => {
    expect(pathOf("assets/scroll..webp")).toBe("assets/scroll..webp");
  });
});

describe("the card types", () => {
  const SYSTEM = `
id: dragonbane
languages: [de]
card-types:
  gear:
    note-tags: [Ausrüstung, Waffe]
    front-template: front.hbs
    back-template: back.hbs
    stylesheet: gear/card-type.css
    translations: { de: { front-stat-1a-label: Griff } }
  Monster:
    front-template: front.hbs
`;

  it("reads a card type's own files, named out loud", () => {
    // One template serving five card types is five visible lines, not a
    // cascade rule the reader has to know.
    const gear = parse(SYSTEM)?.cardTypes["gear"];
    expect(gear?.frontTemplate).toBe("front.hbs");
    expect(gear?.backTemplate).toBe("back.hbs");
    expect(gear?.stylesheet).toBe("gear/card-type.css");
    expect(gear?.translations).toEqual({ de: { "front-stat-1a-label": "Griff" } });
    expect(parse(SYSTEM)?.cardTypes["monster"]?.frontTemplate).toBe("front.hbs");
  });

  it("keeps the tags as the vault writes them", () => {
    // The ids are singular English and lowercased; the tags are not. A German
    // vault tags its cards in German, and these have to match what is there.
    expect(parse(SYSTEM)?.cardTypes["gear"]?.noteTags).toEqual(["Ausrüstung", "Waffe"]);
  });

  it("says so when a card type has no front face", () => {
    const diagnostics = collectDiagnostics();
    parse(
      "id: simple\nlanguages: [en]\ncard-types: { card: { back-template: back.hbs } }",
      diagnostics
    );
    expect(diagnostics.matching("no front-template")).toHaveLength(1);
  });

  it("does not let one broken card type take its siblings down", () => {
    const diagnostics = collectDiagnostics();
    const system = parse(
      "id: simple\nlanguages: [en]\ncard-types:\n  broken: [nonsense]\n  card: { front-template: front.hbs }",
      diagnostics
    );
    expect(Object.keys(system?.cardTypes ?? {})).toEqual(["card"]);
    expect(diagnostics.matching("card-types.broken")).toHaveLength(1);
  });
});

describe("the definition layers a system carries", () => {
  const SYSTEM = `
id: dragonbane
languages: [de]
properties:
  category: { aliases: [kategorie], slot: back-header-title }
card-types:
  gear:
    front-template: front.hbs
    properties:
      name: { slot: front-header-title }
      grip: { aliases: [griff], slot: front-stat-1a }
`;

  it("parses the blocks inline, where the author wrote them", () => {
    const system = parse(SYSTEM);
    expect(system?.properties?.["category"]?.aliases).toEqual(["kategorie"]);
    expect(system?.cardTypes["gear"]?.properties?.["grip"]?.slot).toEqual([
      "front-stat-1a",
    ]);
  });

  it("tells a layer that declared nothing from one that declared an empty block", () => {
    expect(parse(MINIMAL)?.properties).toBeUndefined();
    expect(parse(`${MINIMAL}\nproperties: {}`)?.properties).toEqual({});
  });

  it("feeds the cascade end to end, from the document to a rendered card's props", () => {
    // The whole point of the root: baseline, then what the system wrote, then
    // what the card type wrote — and a note that answers in German is found.
    const system = parse(SYSTEM);
    const cardType = system?.cardTypes["gear"];
    const baseline = { name: { aliases: ["title"] } };

    const defs = resolvePropertyDefs([
      baseline,
      system?.properties,
      cardType?.properties,
    ]);
    const aliases = buildAliasMap(defs);
    const card = prepareCardProps(
      { Griff: "1H", Kategorie: "Waffe" },
      { aliases, defs, fileName: "Handbeil" }
    );

    expect(card["front-header-title"]).toBe("Handbeil"); // name → the filename
    expect(card["front-stat-1a"]).toBe("1H"); // slot → grip → griff
    expect(card["back-header-title"]).toBe("Waffe"); // slot → category → kategorie
  });
});

describe("the translation layers a system carries", () => {
  it("feeds the chain end to end, card type over system over the fallback language", () => {
    const system = parse(`
id: dragonbane
languages: [de, en]
translations:
  de: { back-label: Rückseite, side-ref: Seite }
  en: { back-label: Back }
card-types:
  gear:
    front-template: front.hbs
    translations:
      de: { back-label: Ausrüstung, front-stat-1a-label: Griff }
`);
    const gear = system?.cardTypes["gear"];
    const de = resolveTranslations(
      [system?.translations, gear?.translations],
      "de",
      system?.languages[0]
    );
    expect(de).toEqual({
      "back-label": "Ausrüstung", // the card type wins
      "side-ref": "Seite", // the system answers
      "front-stat-1a-label": "Griff", // only the card type has it
    });
    // English falls back to German, the system's own language, key by key.
    const en = resolveTranslations(
      [system?.translations, gear?.translations],
      "en",
      system?.languages[0]
    );
    expect(en["back-label"]).toBe("Back");
    expect(en["front-stat-1a-label"]).toBe("Griff");
  });
});

describe("everything that is not structure is a card setting", () => {
  it("reads them typed, as the system's layer of the chain", () => {
    const system = parse(`${MINIMAL}\ncard-size: tarot\noverflow-mode: back-then-cards`);
    expect(system?.cardSettings).toEqual({
      cardSize: { width: 70, height: 120 },
      overflowMode: "back-then-cards",
    });
  });

  it("collects a card type's own card settings too", () => {
    const system = parse(
      "id: simple\nlanguages: [en]\ncard-types: { card: { front-template: front.hbs, card-size: mini } }"
    );
    expect(system?.cardTypes["card"]?.cardSettings).toEqual({
      cardSize: { width: 44, height: 63 },
    });
  });

  it("reports a deck setting a system wrote, as it reads the document", () => {
    // Paper is a deck's business, and a deck holds cards of several card
    // types, so a page margin on a system could not even be disagreed with. A
    // system knows only card settings, so this is a plain "not a card setting"
    // — no second rule needed.
    const diagnostics = collectDiagnostics();
    const system = parse(`${MINIMAL}\npage-margin: 5`, diagnostics);
    expect(system?.cardSettings).toEqual({});
    expect(diagnostics.matching("page-margin")).toHaveLength(1);
  });

  it("reports a key that is nothing at all", () => {
    // Three keys that look plausible and are not the document's: nothing
    // reads a `version:`; a constant is a property with a `default:`, not a
    // `variables:` block; and assets are derived from the references that
    // name them, not listed.
    const diagnostics = collectDiagnostics();
    parse(
      `${MINIMAL}\nversion: "1.0"\nvariables: { ornament: x.svg }\nassets: [x.svg]`,
      diagnostics
    );
    expect(diagnostics.matching("version")).toHaveLength(1);
    expect(diagnostics.matching("variables")).toHaveLength(1);
    expect(diagnostics.matching("assets")).toHaveLength(1);
  });
});
