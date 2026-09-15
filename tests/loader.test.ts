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

describe("check 2 — what exists must be declared or referenced", () => {
  it("reports a file nothing uses, with its size", async () => {
    const files = completeSystem();
    files["assets/forgotten.png"] = new Uint8Array(2048);
    const { diagnostics } = await load(files);
    expect(diagnostics.messages).toEqual([
      'demo: "assets/forgotten.png", 2 KB is neither declared nor referenced by anything',
    ]);
  });

  it("lets a licence, a readme and a .txt ride along", async () => {
    const files = completeSystem();
    files["LICENSE"] = "MIT";
    files["README.md"] = "hello";
    files["fonts/NOTICE"] = "…";
    const { diagnostics } = await load(files);
    expect(diagnostics.messages).toEqual([]);
  });

  it("does not report a missing declared file twice", async () => {
    const files = completeSystem();
    delete files["back.hbs"];
    const { diagnostics } = await load(files);
    expect(diagnostics.messages).toHaveLength(2); // once per card type that names it
    expect(diagnostics.matching("neither declared nor referenced")).toEqual([]);
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

describe("check 3 — partials both ways", () => {
  it("reports a declared partial that nothing calls", async () => {
    const files = completeSystem();
    files["gear/front.hbs"] =
      `<div>{{slot "header-title"}} {{slot "stat-1a"}} {{asset "assets/logo.png"}}</div>`;
    const { diagnostics } = await load(files);
    expect(diagnostics.messages).toEqual([
      'demo: partial-templates: declares "stat-cell", which no template calls',
    ]);
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

describe("what the loader refuses outright", () => {
  it("a folder without game-system.yaml", async () => {
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
