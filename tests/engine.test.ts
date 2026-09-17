import { describe, expect, it } from "vitest";
import { prepareCardProps } from "../src/definitions/card-props";
import { collectDiagnostics } from "../src/definitions/diagnostics";
import type { SystemPath } from "../src/definitions/game-system";
import { dataUri } from "../src/systems/assets";
import { loadSystem, type LoadedSystem } from "../src/systems/loader";
import { MissingFileError } from "../src/systems/source";
import { TemplateEngine, type FaceRequest } from "../src/templates/engine";
import { BYTES, completeSystem, MemorySource, type Files } from "./helpers/systems";

/** A source that remembers how often each file was read. */
class CountingSource extends MemorySource {
  readonly reads = new Map<string, number>();

  override readText(path: SystemPath): Promise<string> {
    this.reads.set(path, (this.reads.get(path) ?? 0) + 1);
    return super.readText(path);
  }
}

async function load(files: Files, source = new CountingSource(files)) {
  const diagnostics = collectDiagnostics();
  const system = (await loadSystem(source, "demo", diagnostics)) as LoadedSystem;
  return { system, source, loadDiagnostics: diagnostics };
}

function request(
  system: LoadedSystem,
  cardTypeId: string,
  face: "front" | "back",
  data: Record<string, unknown> = {},
  language = "en"
): FaceRequest {
  const cardType = system.cardTypes[cardTypeId]!;
  return {
    system,
    cardTypeId,
    face,
    props: prepareCardProps(data, {
      aliases: cardType.aliases,
      defs: cardType.properties,
      fileName: "Note",
    }),
    language,
    cardSize: { width: 63, height: 88 },
  };
}

/** The demo system's templates, rewritten so every face carries a root. */
function rootedSystem(): Files {
  const files = completeSystem();
  files["gear/front.hbs"] =
    `<div class="card-root card-front demo">{{> stat-cell for="stat-1a"}}<img src="{{asset "assets/logo.png"}}"></div>`;
  files["spell/front.hbs"] =
    `<div class="card-root card-front demo">{{slot "header-title"}}</div>`;
  files["back.hbs"] = `<div class="card-root card-back demo">{{t "back-label"}}</div>`;
  return files;
}

const LOGO = dataUri(BYTES, "assets/logo.png");

describe("rendering a face", () => {
  it("renders the front with its partial and the asset the scan found", async () => {
    const { system } = await load(rootedSystem());
    const diagnostics = collectDiagnostics();
    const html = await new TemplateEngine().renderFace(
      request(system, "gear", "front", { griff: "einhändig" }, "de"),
      diagnostics
    );
    expect(html).toBe(
      `<div class="card-root card-front demo" style="--card-width: 63mm; --card-height: 88mm;" lang="de"><td>einhändig</td><img src="${LOGO}"></div>`
    );
    expect(diagnostics.messages).toEqual([]);
  });

  it("resolves the translations for the card's language, the system's first behind it", async () => {
    const files = rootedSystem();
    files["game-system.yaml"] = (files["game-system.yaml"] as string).replace(
      "translations:\n  de: { back-label: Rückseite }",
      "translations:\n  en: { back-label: Back, only-en: Only }\n  de: { back-label: Rückseite }"
    );
    files["back.hbs"] =
      `<div class="card-root">{{t "back-label"}}/{{t "only-en"}}/{{t "none"}}</div>`;
    const { system } = await load(files);
    const engine = new TemplateEngine();
    const de = await engine.renderFace(
      request(system, "gear", "back", {}, "de"),
      collectDiagnostics()
    );
    expect(de).toContain(">Rückseite/Only/none<");
    const en = await engine.renderFace(
      request(system, "gear", "back", {}, "en"),
      collectDiagnostics()
    );
    expect(en).toContain(">Back/Only/none<");
  });

  it("leaves the language attribute out when the language is empty", async () => {
    const { system } = await load(rootedSystem());
    const html = await new TemplateEngine().renderFace(
      request(system, "spell", "front", {}, ""),
      collectDiagnostics()
    );
    expect(html).toMatch(
      /^<div class="card-root card-front demo" style="[^"]*"><\/div>$/
    );
  });

  it("reports a face without a root element and returns it as it is", async () => {
    const files = rootedSystem();
    files["spell/front.hbs"] =
      `<section class="card-front">{{slot "header-title"}}</section>`;
    const { system } = await load(files);
    const diagnostics = collectDiagnostics();
    const html = await new TemplateEngine().renderFace(
      request(system, "spell", "front", { category: "Fire" }),
      diagnostics
    );
    expect(html).toBe(`<section class="card-front">Fire</section>`);
    expect(diagnostics.messages).toEqual([
      'demo/spell/front.hbs: no element carries class="card-root"; the face renders without a size',
    ]);
  });

  it("refuses a card type the system does not have, and a face it does not declare", async () => {
    const { system } = await load(rootedSystem());
    const engine = new TemplateEngine();
    await expect(
      engine.renderFace(request(system, "gear", "front"), collectDiagnostics())
    ).resolves.toBeDefined();
    await expect(
      engine.renderFace(
        { ...request(system, "gear", "front"), cardTypeId: "npc" },
        collectDiagnostics()
      )
    ).rejects.toThrow('demo has no card type "npc"');
    const files = rootedSystem();
    files["game-system.yaml"] = (files["game-system.yaml"] as string).replace(
      "  spell:\n    front-template: spell/front.hbs\n    back-template: back.hbs",
      "  spell:\n    front-template: spell/front.hbs"
    );
    const { system: noBack } = await load(files);
    await expect(
      engine.renderFace(request(noBack, "spell", "back"), collectDiagnostics())
    ).rejects.toThrow("demo/spell declares no back-template");
  });
});

describe("errors name the template", () => {
  it("a syntax error, with the system and the path", async () => {
    const files = rootedSystem();
    files["spell/front.hbs"] =
      `<div class="card-root">{{#if (slot "header-title")}}</div>`;
    const { system } = await load(files);
    await expect(
      new TemplateEngine().renderFace(
        request(system, "spell", "front"),
        collectDiagnostics()
      )
    ).rejects.toThrow(/^demo\/spell\/front\.hbs: Parse error/);
  });

  it("a syntax error in a partial, likewise", async () => {
    const files = rootedSystem();
    files["partials/stat-cell.hbs"] = `<td>{{slot for}</td>`;
    const { system } = await load(files);
    await expect(
      new TemplateEngine().renderFace(
        request(system, "spell", "front"),
        collectDiagnostics()
      )
    ).rejects.toThrow(/^demo\/partials\/stat-cell\.hbs: /);
  });

  it("a template the source does not have — MissingFileError, naming the path", async () => {
    const files = rootedSystem();
    const { system } = await load(files);
    delete files["spell/front.hbs"];
    await expect(
      new TemplateEngine().renderFace(
        request(system, "spell", "front"),
        collectDiagnostics()
      )
    ).rejects.toThrow(MissingFileError);
  });
});

describe("{{asset}}", () => {
  it("takes a literal only — the context holds no path a computed one could read", async () => {
    const files = rootedSystem();
    files["spell/front.hbs"] =
      `<div class="card-root">[{{asset "assets/logo.png"}}][{{asset logo}}]</div>`;
    const { system } = await load(files);
    const diagnostics = collectDiagnostics();
    const html = await new TemplateEngine().renderFace(
      request(system, "spell", "front", { logo: "assets/logo.png" }),
      diagnostics
    );
    expect(html).toContain(`[${LOGO}][]`);
    expect(diagnostics.messages).toEqual([
      "{{asset}} without a path in demo/spell; rendering nothing",
    ]);
  });

  it("inline=true writes an SVG's markup itself, and nothing for a bitmap", async () => {
    const files = rootedSystem();
    const ICON = `<svg viewBox="0 0 8 8"><path fill="currentColor" d="M0 0h8v8z"/></svg>`;
    files["assets/claw.svg"] = ICON;
    files["spell/front.hbs"] =
      `<div class="card-root">{{asset "assets/claw.svg" inline=true}}|{{asset "assets/claw.svg"}}|{{asset "assets/logo.png" inline="true"}}</div>`;
    const { system } = await load(files);
    const diagnostics = collectDiagnostics();
    const html = await new TemplateEngine().renderFace(
      request(system, "spell", "front"),
      diagnostics
    );
    expect(html).toContain(
      `>${ICON}|${dataUri(new TextEncoder().encode(ICON), "assets/claw.svg")}|</div>`
    );
    expect(diagnostics.messages).toEqual([
      '{{asset "assets/logo.png"}} in demo/spell: inline=true, but only an SVG can be written into the markup; rendering nothing',
    ]);
  });

  it("serves a path the document names — a classifier's token, a rendered slot", async () => {
    const files = rootedSystem();
    const FIRE = `<svg viewBox="0 0 8 8"><path fill="currentColor" d="M4 0l4 8H0z"/></svg>`;
    const OTHER = `<svg viewBox="0 0 8 8"><circle fill="currentColor" cx="4" cy="4" r="4"/></svg>`;
    files["assets/icons/fire.svg"] = FIRE;
    files["assets/icons/other.svg"] = OTHER;
    files["game-system.yaml"] += `
classifiers:
  header-title:
    match:
      - { pattern: "fire", token: assets/icons/fire.svg }
    default: assets/icons/other.svg
`;
    files["spell/front.hbs"] =
      `<div class="card-root">[{{asset (slot-class "header-title") inline=true}}][{{asset (slot "header-title" plain=true) inline=true}}]</div>`;
    const { system } = await load(files);
    expect(system.documentAssets).toEqual([
      "assets/logo.png",
      "assets/icons/fire.svg",
      "assets/icons/other.svg",
    ]);
    const engine = new TemplateEngine();
    const diagnostics = collectDiagnostics();
    const fire = await engine.renderFace(
      request(system, "spell", "front", { category: "Fire" }),
      diagnostics
    );
    expect(fire).toContain(`[${FIRE}][]`);
    const named = await engine.renderFace(
      request(system, "spell", "front", { category: "assets/icons/other.svg" }),
      collectDiagnostics()
    );
    expect(named).toContain(`[${OTHER}][${OTHER}]`);
    expect(diagnostics.messages).toEqual([
      '{{asset "Fire"}} in demo/spell: no such file, or a path neither a template nor the document names; rendering nothing',
    ]);
  });

  it("reports a hash key that is not inline, and an inline= that is neither true nor false", async () => {
    const files = rootedSystem();
    files["spell/front.hbs"] =
      `<div class="card-root">{{asset "assets/logo.png" inline=ture}}{{asset "assets/logo.png" size=2}}</div>`;
    const { system } = await load(files);
    const diagnostics = collectDiagnostics();
    const html = await new TemplateEngine().renderFace(
      request(system, "spell", "front"),
      diagnostics
    );
    expect(html).toContain(`${LOGO}${LOGO}`);
    expect(diagnostics.messages).toEqual([
      '{{asset "assets/logo.png"}}: inline=(nothing) is neither true nor false; using the default',
      '{{asset "assets/logo.png"}}: "size" is not a switch (inline is); ignoring it',
    ]);
  });

  it("leaves out a file that is gone, and says so at the call", async () => {
    const files = rootedSystem();
    const { system } = await load(files);
    delete files["assets/logo.png"];
    const diagnostics = collectDiagnostics();
    const html = await new TemplateEngine().renderFace(
      request(system, "gear", "front"),
      diagnostics
    );
    expect(html).toContain(`<img src="">`);
    expect(diagnostics.messages).toEqual([
      '{{asset "assets/logo.png"}} in demo/gear: no such file, or a path neither a template nor the document names; rendering nothing',
    ]);
  });
});

describe("compiling once per loaded system", () => {
  it("reads a face and the partials once across renders", async () => {
    const { system, source } = await load(rootedSystem());
    const engine = new TemplateEngine();
    source.reads.clear();
    await engine.renderFace(request(system, "gear", "front"), collectDiagnostics());
    await engine.renderFace(request(system, "gear", "front"), collectDiagnostics());
    await engine.renderFace(request(system, "spell", "front"), collectDiagnostics());
    expect(source.reads.get("gear/front.hbs")).toBe(1);
    expect(source.reads.get("spell/front.hbs")).toBe(1);
    expect(source.reads.get("partials/stat-cell.hbs")).toBe(1);
    expect(source.reads.get("back.hbs")).toBeUndefined();
  });

  it("compiles again for a fresh LoadedSystem — a changed template shows", async () => {
    const files = rootedSystem();
    const source = new CountingSource(files);
    const { system: first } = await load(files, source);
    const engine = new TemplateEngine();
    const before = await engine.renderFace(
      request(first, "spell", "front", { category: "Fire" }),
      collectDiagnostics()
    );
    files["spell/front.hbs"] =
      `<div class="card-root"><b>{{slot "header-title"}}</b></div>`;
    const stale = await engine.renderFace(
      request(first, "spell", "front", { category: "Fire" }),
      collectDiagnostics()
    );
    expect(stale).toBe(before);
    const { system: second } = await load(files, source);
    const fresh = await engine.renderFace(
      request(second, "spell", "front", { category: "Fire" }),
      collectDiagnostics()
    );
    expect(fresh).toContain("<b>Fire</b>");
  });
});
