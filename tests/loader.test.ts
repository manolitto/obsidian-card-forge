import { describe, expect, it } from "vitest";
import { collectDiagnostics } from "../src/definitions/diagnostics";
import type { SystemPath } from "../src/definitions/game-system";
import { dataUri } from "../src/systems/assets";
import { BASELINE, readBaseline } from "../src/systems/baseline";
import { loadSystem } from "../src/systems/loader";
import { MissingFileError } from "../src/systems/source";
import { BYTES, completeSystem, MemorySource, type Files } from "./helpers/systems";

async function load(files: Files, expectedId = "demo") {
  const diagnostics = collectDiagnostics();
  const system = await loadSystem(new MemorySource(files), expectedId, diagnostics);
  return { system, diagnostics };
}

describe("a complete system", () => {
  it("loads with nothing to report", async () => {
    const { system, diagnostics } = await load(completeSystem());
    expect(diagnostics.messages).toEqual([]);
    expect(system?.id).toBe("demo");
    expect(Object.keys(system!.cardTypes)).toEqual(["gear", "spell"]);
  });

  it("folds the definition layers per card type, seeded from the baseline", async () => {
    const { system } = await load(completeSystem());
    const gear = system!.cardTypes["gear"]!;
    expect(Object.keys(gear.properties)).toContain("name"); // baseline
    expect(gear.properties["logo-image"]?.default).toBe("assets/logo.png"); // system
    expect(gear.properties["grip"]?.slot).toEqual(["stat-1a"]); // card type
    expect(gear.aliases["stat-1a"]).toEqual(["grip"]);
    expect(gear.aliases["header-title"]).toEqual(["category"]);
    expect(gear.translations["de"]?.["back-label"]).toBe("Rückseite");
    // Baseline → system: the system's poker stands, the baseline's other keys survive.
    expect(gear.cardSettings.cardSize).toEqual({ width: 63, height: 88 });
    expect(gear.cardSettings.overflowMode).toBe("none");
    expect(system!.cardTypes["spell"]!.properties["grip"]).toBeUndefined();
  });

  it("puts the system's first language under the system's own settings layer", async () => {
    // A system that says nothing prints in the language it was written in;
    // one that says `language:` overrides that, and a card type may again.
    const files = completeSystem();
    const { system: silent } = await load(files);
    expect(silent!.cardTypes["gear"]!.cardSettings.language).toBe("en");

    files["game-system.yaml"] = files["game-system.yaml"]!.toString().replace(
      "card-size: poker",
      "card-size: poker\nlanguage: de"
    );
    const { system: spoken } = await load(files);
    expect(spoken!.cardTypes["gear"]!.cardSettings.language).toBe("de");
  });

  it("merges glyphs and classifiers per slot, card type over system", async () => {
    const files = completeSystem();
    files["game-system.yaml"] = files["game-system.yaml"]!.toString()
      .replace(
        "card-types:",
        [
          "glyphs: { stat-1a: { 1h: one }, header-title: { x: system-x } }",
          "classifiers: { stat-1a: { default: sys } }",
          "card-types:",
        ].join("\n")
      )
      .replace(
        "    properties:\n      grip:",
        "    glyphs: { stat-1a: { 2h: two } }\n    classifiers: { header-title: { default: type } }\n    properties:\n      grip:"
      );
    const { system, diagnostics } = await load(files);
    expect(diagnostics.messages).toEqual([]);
    const gear = system!.cardTypes["gear"]!;
    expect(gear.glyphs).toEqual({
      "stat-1a": { "2h": "two" },
      "header-title": { x: "system-x" },
    });
    expect(Object.keys(gear.classifiers)).toEqual(["stat-1a", "header-title"]);
    expect(system!.cardTypes["spell"]!.glyphs["stat-1a"]).toEqual({ "1h": "one" });
  });
});

describe("the stylesheet a card renders under", () => {
  it("is baseline, then system, then card type, with every url() inlined", async () => {
    const { system } = await load(completeSystem());
    const css = await system!.stylesheet("gear");
    const base = css.indexOf(".card-root {");
    const sys = css.indexOf(".card-root.demo");
    const type = css.indexOf(".gear-frame");
    expect(base).toBeGreaterThanOrEqual(0);
    expect(sys).toBeGreaterThan(base);
    expect(type).toBeGreaterThan(sys);
    expect(css).not.toMatch(/url\((['"]?)(fonts|assets|gear)\//);
    expect(css).toContain(`url("data:font/woff2;base64,`);
    expect(css).toContain(`url("data:image/webp;base64,`);
    expect(css).toContain(`url("data:image/png;base64,`);
  });

  it("leaves a card type without a stylesheet at the system's", async () => {
    const { system } = await load(completeSystem());
    const css = await system!.stylesheet("spell");
    expect(css).toContain(".card-root.demo");
    expect(css).not.toContain(".gear-frame");
  });

  it("refuses a card type the system does not have, by name", async () => {
    const { system } = await load(completeSystem());
    await expect(system!.stylesheet("npc")).rejects.toThrow(/no card type "npc"/);
  });
});

describe("check 1 — what is declared or referenced must exist", () => {
  it("reports a declared template that is missing, naming the key", async () => {
    const files = completeSystem();
    delete files["gear/front.hbs"];
    const { diagnostics } = await load(files);
    expect(diagnostics.matching("card-types.gear.front-template:")).toEqual([
      'demo: card-types.gear.front-template: names "gear/front.hbs", which does not exist',
    ]);
  });

  it("reports a declared stylesheet and a declared partial that are missing", async () => {
    const files = completeSystem();
    delete files["game-system.css"];
    delete files["partials/stat-cell.hbs"];
    const { diagnostics } = await load(files);
    expect(diagnostics.matching("stylesheet:")).toHaveLength(1);
    expect(diagnostics.matching("partial-templates.stat-cell:")).toHaveLength(1);
  });

  it("reports a url() to nowhere with the stylesheet and line", async () => {
    const files = completeSystem();
    delete files["assets/paper.webp"];
    const { diagnostics } = await load(files);
    expect(diagnostics.messages).toEqual([
      'demo: game-system.css, line 2 refers to "assets/paper.webp", which does not exist',
    ]);
  });

  it("reports an {{asset}} to nowhere with the template and line", async () => {
    const files = completeSystem();
    files["gear/front.hbs"] =
      `<img src="{{asset "assets/missing.png"}}">\n{{> stat-cell}}`;
    delete files["assets/logo.png"];
    const { diagnostics } = await load(files);
    expect(diagnostics.matching("gear/front.hbs, line 1")).toHaveLength(1);
    expect(
      diagnostics.matching("game-system.yaml, properties.logo-image.default")
    ).toHaveLength(1);
  });

  it("refuses a reference that leaves the folder", async () => {
    const files = completeSystem();
    files["game-system.css"] += `\n.x { background: url(../outside.png); }`;
    const { diagnostics } = await load(files);
    expect(diagnostics.matching("leaves the system folder")).toHaveLength(1);
  });
});

describe("what exists but nothing names", () => {
  it("is handed back as data, not reported — a vault folder may hold what its owner keeps there", async () => {
    const files = completeSystem();
    files["assets/forgotten.png"] = new Uint8Array(2048);
    files["notes.md"] = "design notes";
    const { system, diagnostics } = await load(files);
    expect(diagnostics.messages).toEqual([]);
    expect(system!.unusedFiles).toEqual([
      "assets/forgotten.png",
      "fonts/OFL.txt",
      "notes.md",
    ]);
  });

  it("is, for a complete system, the font's licence alone — the root document counts as used", async () => {
    const { system } = await load(completeSystem());
    expect(system!.unusedFiles).toEqual(["fonts/OFL.txt"]);
    expect(system!.unusedPartials).toEqual([]);
  });

  it("does not list a missing declared file as unused", async () => {
    const files = completeSystem();
    delete files["back.hbs"];
    const { system, diagnostics } = await load(files);
    expect(diagnostics.messages).toHaveLength(2); // once per card type that names it
    expect(system!.unusedFiles).toEqual(["fonts/OFL.txt"]);
  });
});

describe("the slot check", () => {
  it("catches a typo in a template's read through the binding it orphans", async () => {
    // The templates are the declaration: a place exists because one reads
    // it. So the binding is what can be wrong, and a misspelt read shows as
    // the binding it leaves without a reader.
    const files = completeSystem();
    files["spell/front.hbs"] = `<div>\n{{slot "header-tittle"}}</div>`;
    const { diagnostics } = await load(files);
    expect(diagnostics.messages).toEqual([
      'demo: card-types.spell binds "category" to slot "header-title", which no template of the card type reads',
    ]);
  });

  it("lets one template offer places no card type fills yet", async () => {
    // spell/front.hbs reads stat-1a, which only gear binds, and stat-9z,
    // which nobody binds; both render empty on a spell, and neither is a
    // mistake.
    const files = completeSystem();
    files["spell/front.hbs"] =
      `<div>{{slot "header-title"}} {{slot "stat-1a"}} {{slot "stat-9z"}}</div>`;
    const { diagnostics } = await load(files);
    expect(diagnostics.messages).toEqual([]);
  });

  it("reports a binding no template of the card type mentions, in wording", async () => {
    const files = completeSystem();
    files["spell/front.hbs"] = `<div>{{slot "header-title"}}</div>`;
    files["game-system.yaml"] = files["game-system.yaml"]!.toString().replace(
      "  spell:\n",
      "  spell:\n    properties: { level: { slot: stat-2a } }\n"
    );
    const { diagnostics } = await load(files);
    expect(diagnostics.messages).toEqual([
      'demo: card-types.spell binds "level" to slot "stat-2a", which no template of the card type reads',
    ]);
  });

  it("counts a partial's literals and a partial call's for= for every card type", async () => {
    const { diagnostics } = await load(completeSystem()); // gear's stat-1a is read as {{slot for}}
    expect(diagnostics.messages).toEqual([]);
  });
});

describe("check 2 — every partial called is declared", () => {
  it("hands back a declared partial that nothing calls as data, not a report", async () => {
    const files = completeSystem();
    files["gear/front.hbs"] =
      `<div>{{slot "header-title"}} {{slot "stat-1a"}} {{asset "assets/logo.png"}}</div>`;
    const { system, diagnostics } = await load(files);
    expect(diagnostics.messages).toEqual([]);
    expect(system!.unusedPartials).toEqual(["stat-cell"]);
  });

  it("reports a call to a partial nobody declares, naming the caller", async () => {
    const files = completeSystem();
    files["spell/front.hbs"] = `<div>{{slot "header-title"}}\n{{> stat-wide}}</div>`;
    const { diagnostics } = await load(files);
    expect(diagnostics.messages).toEqual([
      'demo: spell/front.hbs, line 2 calls partial "stat-wide", which partial-templates: does not declare',
    ]);
  });

  it("counts the markdown-image hook as a call", async () => {
    const { diagnostics } = await load(completeSystem());
    expect(diagnostics.matching("card-image")).toEqual([]);
  });
});

describe("the root document", () => {
  it("is whatever the source names — the name is free", async () => {
    const files = completeSystem();
    files["demo.yml"] = files["game-system.yaml"]!;
    delete files["game-system.yaml"];
    const diagnostics = collectDiagnostics();
    const source = new MemorySource(files, "memory", "demo.yml" as SystemPath);
    const system = await loadSystem(source, "demo", diagnostics);
    expect(diagnostics.messages).toEqual([]);
    expect(system?.id).toBe("demo");
    expect(system?.unusedFiles).not.toContain("demo.yml");
  });
});

describe("a card type in a document of its own", () => {
  /** The complete system with `gear` moved out into `card-types/gear.yaml`. */
  function gearInItsOwnDocument(): Files {
    const files = completeSystem();
    files["game-system.yaml"] = files["game-system.yaml"]!.toString().replace(
      / {2}gear:\n(?: {4}.*\n)+/,
      "  gear: card-types/gear.yaml\n"
    );
    files["card-types/gear.yaml"] = `
front-template: gear/front.hbs
back-template: back.hbs
stylesheet: gear/card-type.css
properties:
  grip: { aliases: [griff], slot: stat-1a }
  badge-image: { default: assets/logo.png }
`;
    return files;
  }

  it("loads as if the mapping stood in the root document, in the root's order", async () => {
    const { system, diagnostics } = await load(gearInItsOwnDocument());
    expect(diagnostics.messages).toEqual([]);
    expect(Object.keys(system!.cardTypes)).toEqual(["gear", "spell"]);
    const gear = system!.cardTypes["gear"]!;
    expect(gear.declaration.frontTemplate).toBe("gear/front.hbs");
    expect(gear.properties["grip"]?.slot).toEqual(["stat-1a"]);
    expect(gear.properties["category"]?.slot).toEqual(["header-title"]); // the system's layer still folds under it
    expect(await system!.stylesheet("gear")).toContain(".gear-frame");
  });

  it("counts the document as used and reads the assets it names", async () => {
    const { system } = await load(gearInItsOwnDocument());
    expect(system!.unusedFiles).not.toContain("card-types/gear.yaml");
    expect(system!.documentAssets).toContain("assets/logo.png");
  });

  it("words a problem inside the card type the same as for an inline one", async () => {
    const files = gearInItsOwnDocument();
    files["card-types/gear.yaml"] = files["card-types/gear.yaml"]!.toString().replace(
      "slot: stat-1a",
      "slot: stat-1z"
    );
    const { diagnostics } = await load(files);
    expect(diagnostics.messages).toEqual([
      'demo: card-types.gear binds "grip" to slot "stat-1z", which no template of the card type reads',
    ]);
  });

  it("reports a document that does not exist, naming the card type, and keeps the others", async () => {
    const files = gearInItsOwnDocument();
    delete files["card-types/gear.yaml"];
    const { system, diagnostics } = await load(files);
    expect(diagnostics.messages).toEqual([
      'memory: card-types.gear names "card-types/gear.yaml", which does not exist',
    ]);
    expect(Object.keys(system!.cardTypes)).toEqual(["spell"]);
  });

  it("reports a document that is not YAML, naming the file", async () => {
    const files = gearInItsOwnDocument();
    files["card-types/gear.yaml"] = "front-template: [unclosed";
    const { system, diagnostics } = await load(files);
    expect(diagnostics.messages).toHaveLength(1);
    expect(diagnostics.messages[0]).toMatch(
      /^memory: card-types\.gear: card-types\/gear\.yaml: /
    );
    expect(Object.keys(system!.cardTypes)).toEqual(["spell"]);
  });

  it("reports a document that is not a mapping", async () => {
    const files = gearInItsOwnDocument();
    files["card-types/gear.yaml"] = "- front-template: gear/front.hbs";
    const { system, diagnostics } = await load(files);
    expect(diagnostics.messages).toEqual([
      "memory: card-types.gear: card-types/gear.yaml must hold the card type as a mapping; ignoring it",
    ]);
    expect(Object.keys(system!.cardTypes)).toEqual(["spell"]);
  });

  it("refuses a path that leaves the folder, like any declared path", async () => {
    const files = gearInItsOwnDocument();
    files["game-system.yaml"] = files["game-system.yaml"]!.toString().replace(
      "card-types/gear.yaml",
      "../elsewhere/gear.yaml"
    );
    const { system, diagnostics } = await load(files);
    expect(diagnostics.messages).toEqual([
      'memory: card-types.gear: "../elsewhere/gear.yaml" leaves the system folder, which a system may not do',
    ]);
    expect(Object.keys(system!.cardTypes)).toEqual(["spell"]);
    expect(system!.unusedFiles).toContain("card-types/gear.yaml");
  });
});

describe("what the loader refuses outright", () => {
  it("a folder without the root document", async () => {
    const { system, diagnostics } = await load({ "front.hbs": "x" });
    expect(system).toBeUndefined();
    expect(diagnostics.messages).toEqual(["memory: no game-system.yaml; not a system"]);
  });

  it("a document that is not YAML", async () => {
    const { system, diagnostics } = await load({ "game-system.yaml": "id: [unclosed" });
    expect(system).toBeUndefined();
    expect(diagnostics.matching("game-system.yaml:")).toHaveLength(1);
  });

  it("a document whose id is not the one registered", async () => {
    const { system, diagnostics } = await load(completeSystem(), "other");
    expect(system).toBeUndefined();
    expect(diagnostics.messages).toEqual([
      'memory: game-system.yaml declares id "demo" but is registered as "other"; not loading it',
    ]);
  });
});

describe("a missing file at runtime", () => {
  it("fails naming the path, never silently", async () => {
    const source = new MemorySource(completeSystem());
    await expect(source.readText("gear/nowhere.hbs" as SystemPath)).rejects.toThrow(
      MissingFileError
    );
    await expect(source.readText("gear/nowhere.hbs" as SystemPath)).rejects.toThrow(
      'no file "gear/nowhere.hbs"'
    );
  });
});

describe("the baseline", () => {
  it("ships the eight properties and both setting layers, and reads clean", () => {
    expect(Object.keys(BASELINE.properties)).toEqual([
      "name",
      "description",
      "image",
      "tags",
      "body",
      "roll",
      "roll-min",
      "roll-max",
    ]);
    expect(BASELINE.cardSettings.cardSize).toEqual({ width: 63, height: 88 });
    expect(BASELINE.cardSettings.layouts).toHaveLength(1);
    expect(BASELINE.deckSettings.paperSize).toMatchObject({ width: 210, height: 297 });
    expect(BASELINE.deckSettings.cutMarks?.enabled).toBe(true);
    expect(BASELINE.stylesheet).toContain(".card-root {");
  });

  it("throws on a key that is neither kind of setting", () => {
    expect(() => readBaseline("properties: {}\nfoo: 1\n", "")).toThrow(/foo/);
  });
});

describe("a data URI", () => {
  it("is typed by the path's extension and falls back to octet-stream", () => {
    expect(dataUri(BYTES, "assets/x.png")).toBe("data:image/png;base64,iVBORw0KGgo=");
    expect(dataUri(BYTES, "assets/x.bin")).toBe(
      "data:application/octet-stream;base64,iVBORw0KGgo="
    );
  });
});
