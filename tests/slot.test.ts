import Handlebars from "handlebars";
import { describe, expect, it } from "vitest";
import { buildAliasMap } from "../src/definitions/bindings";
import { prepareCardProps } from "../src/definitions/card-props";
import { collectDiagnostics } from "../src/definitions/diagnostics";
import { STATE_KEY, type RenderState } from "../src/templates/context";
import { registerHelpers } from "../src/templates/helpers";
import { props } from "./helpers/definitions";

/**
 * A card type with a title slot bound to `name` (which has a German alias), a
 * body slot, a stat slot, and a slot two properties fill.
 */
const DEFS = props([
  `
name: { aliases: [titel], slot: front-title }
content: { aliases: [text], slot: front-body }
grip: { aliases: [griff], slot: front-stat-1a }
subtitle: { slot: front-subtitle }
category: { slot: front-subtitle }
`,
]);

interface Options {
  data?: Record<string, unknown>;
  translations?: Record<string, string>;
  partials?: Record<string, string>;
}

/** Compile on an isolated instance and render with the state in the data frame. */
function render(template: string, options: Options = {}) {
  const hb = Handlebars.create();
  registerHelpers(hb);
  const diagnostics = collectDiagnostics();
  const aliases = buildAliasMap(DEFS);
  const state: RenderState = {
    where: "demo/gear",
    props: prepareCardProps(options.data ?? {}, {
      aliases,
      defs: DEFS,
      fileName: "Note",
    }),
    slots: new Set(Object.values(DEFS).flatMap((def) => def.slot ?? [])),
    translations: options.translations ?? {},
    assets: new Map(),
    diagnostics,
  };
  const partials: Record<string, Handlebars.TemplateDelegate> = {};
  for (const [name, source] of Object.entries(options.partials ?? {})) {
    partials[name] = hb.compile(source);
  }
  const html = hb.compile(template)({}, { data: { [STATE_KEY]: state }, partials });
  return { html, diagnostics };
}

describe("{{slot}}", () => {
  it("renders the value bound to the slot", () => {
    const { html, diagnostics } = render(`<h1>{{slot "front-title"}}</h1>`, {
      data: { name: "Lantern" },
    });
    expect(html).toBe("<h1>Lantern</h1>");
    expect(diagnostics.messages).toEqual([]);
  });

  it("reaches the note's own spelling through the property's alias", () => {
    const { html } = render(`{{slot "front-title"}}|{{slot "front-stat-1a"}}`, {
      data: { titel: "Laterne", Griff: "einhändig" },
    });
    expect(html).toBe("Laterne|einhändig");
  });

  it("takes the name from a path, so a partial can be told which place it fills", () => {
    const { html } = render(`{{> stat for="front-stat-1a"}}`, {
      data: { grip: "two-handed" },
      partials: { stat: `<td>{{slot for}}</td>` },
    });
    expect(html).toBe("<td>two-handed</td>");
  });

  it("renders the first of two properties on one slot that the note sets", () => {
    expect(render(`{{slot "front-subtitle"}}`, { data: { category: "Gear" } }).html).toBe(
      "Gear"
    );
    expect(
      render(`{{slot "front-subtitle"}}`, { data: { category: "Gear", subtitle: "Sub" } })
        .html
    ).toBe("Sub");
  });

  it("falls back to the file name for the title, like any read of name", () => {
    expect(render(`{{slot "front-title"}}`).html).toBe("Note");
  });

  it("renders the value through the pipeline, not escaped twice", () => {
    const { html } = render(`{{slot "front-body"}}`, {
      data: { content: "**bold** & [[Link|shown]]" },
    });
    expect(html).toBe(
      '<strong>bold</strong> &amp; <span class="cf-wikilink">shown</span>'
    );
  });

  it("reports a name no property fills, naming the card type, and renders nothing", () => {
    const { html, diagnostics } = render(`[{{slot "front-tittle"}}]`, {
      data: { name: "x" },
    });
    expect(html).toBe("[]");
    expect(diagnostics.messages).toEqual([
      '{{slot "front-tittle"}}: "front-tittle" is not a slot any property of demo/gear fills; rendering nothing',
    ]);
  });

  it("reports a bare call and a partial called without its name", () => {
    const { diagnostics } = render(`{{slot}}{{> stat}}`, {
      partials: { stat: `{{slot for}}` },
    });
    expect(diagnostics.messages).toEqual([
      "{{slot}} without a slot name in demo/gear; rendering nothing",
      "{{slot}} without a slot name in demo/gear; rendering nothing",
    ]);
  });

  describe("the hull idiom {{#if (slot …)}}", () => {
    const HULL = `{{#if (slot "front-stat-1a")}}<td>{{slot "front-stat-1a"}}</td>{{/if}}`;

    it("stays out for an empty value", () => {
      expect(render(HULL).html).toBe("");
      expect(render(HULL, { data: { grip: "" } }).html).toBe("");
      expect(render(HULL, { data: { grip: null } }).html).toBe("");
    });

    it("renders a 0 — a value, not an absence", () => {
      expect(render(HULL, { data: { grip: 0 } }).html).toBe("<td>0</td>");
    });
  });

  describe("switches", () => {
    it("accepts true and false, as booleans or as strings a partial forwards", () => {
      const data = { content: "a\nb" };
      expect(render(`{{slot "front-body" linebreaks=true}}`, { data }).html).toBe(
        "a<br>b"
      );
      expect(render(`{{slot "front-body" linebreaks=false}}`, { data }).html).toBe(
        "a\nb"
      );
      expect(
        render(`{{> body switch="true"}}`, {
          data,
          partials: { body: `{{slot "front-body" linebreaks=switch}}` },
        }).html
      ).toBe("a<br>b");
    });

    it("reports a value that is neither, and uses the default", () => {
      const { html, diagnostics } = render(`{{slot "front-body" linebreaks=ture}}`, {
        data: { content: "a\nb" },
      });
      expect(html).toBe("a\nb");
      expect(diagnostics.messages).toEqual([
        '{{slot "front-body"}}: linebreaks=(nothing) is neither true nor false; using the default',
      ]);
    });

    it("reports a key that is not a switch, and ignores it", () => {
      const { html, diagnostics } = render(`{{slot "front-body" render="markdown"}}`, {
        data: { content: "*a*" },
      });
      expect(html).toBe("<em>a</em>");
      expect(diagnostics.messages).toEqual([
        '{{slot "front-body"}}: "render" is not a switch (markdown, linebreaks are); ignoring it',
      ]);
    });
  });
});

describe("{{slot-label}} and {{t}}", () => {
  it("shows a slot's caption from the translations", () => {
    const { html } = render(`{{slot-label "front-stat-1a"}}`, {
      translations: { "front-stat-1a-label": "Griff" },
    });
    expect(html).toBe("Griff");
  });

  it("shows nothing for a missing caption, where {{t}} shows the key", () => {
    const { html, diagnostics } = render(
      `[{{slot-label "front-stat-1a"}}][{{t "side-ref"}}]`
    );
    expect(html).toBe("[][side-ref]");
    expect(diagnostics.messages).toEqual([]);
  });

  it("checks the slot name too", () => {
    const { diagnostics } = render(`{{slot-label "front-stat-9z"}}`);
    expect(diagnostics.messages).toEqual([
      '{{slot-label "front-stat-9z"}}: "front-stat-9z" is not a slot any property of demo/gear fills; rendering nothing',
    ]);
  });

  it("escapes a caption and a translation on output", () => {
    const { html } = render(`{{slot-label "front-stat-1a"}} {{t "x"}}`, {
      translations: { "front-stat-1a-label": "A & B", x: "<i>" },
    });
    expect(html).toBe("A &amp; B &lt;i&gt;");
  });
});
