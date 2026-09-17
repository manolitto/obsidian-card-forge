import { describe, expect, it } from "vitest";
import {
  assetMimeType,
  documentAssetReferences,
  isAssetPath,
  stylesheetReferences,
  templateAssetReferences,
  templatePartialCalls,
  templateStringLiterals,
} from "../src/systems/references";

describe("stylesheet references", () => {
  it("finds url() targets quoted either way or not at all, with their line", () => {
    const css = `a { background: url(assets/a.png); }
b { background: url('assets/b.png'); }
c { background: url( "assets/c.png" ); }`;
    expect(stylesheetReferences(css)).toEqual([
      { path: "assets/a.png", where: "line 1" },
      { path: "assets/b.png", where: "line 2" },
      { path: "assets/c.png", where: "line 3" },
    ]);
  });

  it("leaves data URIs, addresses and fragments alone", () => {
    const css = `a { src: url(data:font/woff2;base64,AAAA); }
b { background: url(https://example.org/x.png); }
c { background: url(//cdn/x.png); }
d { fill: url(#gradient); }
e { background: url(assets/real.png); }`;
    expect(stylesheetReferences(css).map((r) => r.path)).toEqual(["assets/real.png"]);
  });
});

describe("template references", () => {
  it("reads nothing out of a comment — an example quoted there is not a reference", () => {
    const hbs = `{{!--
  Called as {{> stat-cell for="front-stat-1a"}}, shows {{asset "assets/example.png"}}.
--}}
{{! {{slot "front-note"}} }}
<div>{{> header}}{{slot "front-title"}}{{asset "assets/real.png"}}</div>`;
    expect(templateAssetReferences(hbs)).toEqual([
      { path: "assets/real.png", where: "line 5" },
    ]);
    expect(templatePartialCalls(hbs).map((r) => r.path)).toEqual(["header"]);
    expect([...templateStringLiterals(hbs)]).toEqual(["front-title", "assets/real.png"]);
  });

  it("finds {{asset}} literals in either quote style", () => {
    const hbs = `<img src="{{asset "assets/logo.png"}}">\n<img src="{{ asset 'gear/assets/back.png' }}">`;
    expect(templateAssetReferences(hbs)).toEqual([
      { path: "assets/logo.png", where: "line 1" },
      { path: "gear/assets/back.png", where: "line 2" },
    ]);
  });

  it("does not take a variable for a path", () => {
    expect(templateAssetReferences(`{{asset props.logo-image}}`)).toEqual([]);
  });

  it("finds partial calls, plain and block, with or without arguments", () => {
    const hbs = `{{> stat-cell for="a"}}\n{{>stat-wide}}\n{{#> layout}}x{{/layout}}`;
    expect(templatePartialCalls(hbs).map((c) => c.path)).toEqual([
      "stat-cell",
      "stat-wide",
      "layout",
    ]);
  });
});

describe("document references", () => {
  it("takes a string ending in an asset extension for a reference, wherever it sits", () => {
    const doc = {
      properties: {
        "logo-image": { default: "assets/logo.png" },
        name: { description: { en: "The title" } },
      },
      "card-types": {
        gear: { properties: { back: { default: "gear/assets/back.webp" } } },
      },
      list: ["one.svg"],
    };
    expect(documentAssetReferences(doc)).toEqual([
      { path: "assets/logo.png", where: "properties.logo-image.default" },
      { path: "gear/assets/back.webp", where: "card-types.gear.properties.back.default" },
      { path: "one.svg", where: "list[0]" },
    ]);
  });

  it("is only about the extension — prose that merely mentions a file counts too", () => {
    expect(documentAssetReferences({ note: "see assets/logo.png" })).toEqual([
      { path: "see assets/logo.png", where: "note" },
    ]);
    expect(documentAssetReferences({ note: "assets/logo.png is the logo" })).toEqual([]);
  });
});

describe("asset types", () => {
  it("knows images and fonts, case-insensitively", () => {
    expect(assetMimeType("a/b.PNG")).toBe("image/png");
    expect(assetMimeType("f.woff2")).toBe("font/woff2");
    expect(assetMimeType("f.svg")).toBe("image/svg+xml");
  });

  it("does not take a stylesheet, a template or a document for an asset", () => {
    for (const path of [
      "game-system.css",
      "front.hbs",
      "game-system.yaml",
      "README",
      ".png",
    ]) {
      expect(isAssetPath(path), path).toBe(false);
    }
  });
});
