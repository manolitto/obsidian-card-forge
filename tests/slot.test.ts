import Handlebars from "handlebars";
import { describe, expect, it } from "vitest";
import { buildAliasMap } from "../src/definitions/bindings";
import { prepareCardProps } from "../src/definitions/card-props";
import type { Classifiers } from "../src/definitions/classifiers";
import { collectDiagnostics } from "../src/definitions/diagnostics";
import type { GlyphTables } from "../src/definitions/glyphs";
import { blockMarkdown } from "../src/templates/block-markdown";
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
  images?: Record<string, string>;
  glyphs?: GlyphTables;
  classifiers?: Classifiers;
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
    translations: options.translations ?? {},
    assets: new Map(),
    images: new Map(Object.entries(options.images ?? {})),
    glyphs: options.glyphs ?? {},
    classifiers: options.classifiers ?? {},
    block: blockMarkdown((target, alt) => `<img src="${target}" alt="${alt}">`),
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
      '<strong>bold</strong> &amp; <span class="cs-wikilink">shown</span>'
    );
  });

  it("renders nothing for a place no property fills — one front may serve several card types", () => {
    // The typo check is the loader's, on the bindings; here a place nobody
    // fills is simply empty.
    const { html, diagnostics } = render(`[{{slot "front-tittle"}}]`, {
      data: { name: "x" },
    });
    expect(html).toBe("[]");
    expect(diagnostics.messages).toEqual([]);
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
        '{{slot "front-body"}}: "render" is not a switch (markdown, linebreaks, glyph, signed, join, image, plain, list, fallback are); ignoring it',
      ]);
    });
  });
});

describe("{{slot}} with the newer switches", () => {
  it("list=true hands {{#each}} the items, every string field rendered", () => {
    const { html } = render(
      `{{#each (slot "front-body" list=true)}}<p>{{name}}: {{desc}}</p>{{/each}}`,
      {
        data: {
          content: [
            { name: "Kalt", desc: "*doppelt*" },
            { Name: "Warm", desc: 1 },
          ],
        },
      }
    );
    expect(html).toBe("<p>Kalt: <em>doppelt</em></p><p>Warm: 1</p>");
  });

  it("list=true lifts a scalar and a string list to items, and an empty value to nothing", () => {
    expect(
      render(`{{#each (slot "front-body" list=true)}}[{{this}}]{{/each}}`, {
        data: { content: "one" },
      }).html
    ).toBe("[one]");
    expect(
      render(`{{#each (slot "front-body" list=true)}}[{{this}}]{{/each}}`, {
        data: { content: ["a", "**b**"] },
      }).html
    ).toBe("[a][<strong>b</strong>]");
    expect(render(`{{#if (slot "front-body" list=true)}}yes{{else}}no{{/if}}`).html).toBe(
      "no"
    );
  });

  it("glyph=true reads the card type's table for that slot", () => {
    const glyphs = { "front-stat-1a": { "1h": "einhändig" } };
    expect(
      render(`{{slot "front-stat-1a" glyph=true}}`, { data: { griff: "1H" }, glyphs })
        .html
    ).toBe("einhändig");
    expect(
      render(`{{slot "front-stat-1a" glyph=true}}`, { data: { griff: "1H" } }).html
    ).toBe("1H");
  });

  it("image=true yields the picture the note refers to, and reports a miss", () => {
    const images = { "Beil.png": "data:image/png;base64,QQ==" };
    expect(
      render(`<img src="{{slot "front-body" image=true}}">`, {
        data: { content: "[[Beil.png|the axe]]" },
        images,
      }).html
    ).toBe('<img src="data:image/png;base64,QQ==">');
    const { html, diagnostics } = render(`[{{slot "front-body" image=true}}]`, {
      data: { content: "![[Nope.png]]" },
      images,
    });
    expect(html).toBe("[]");
    expect(diagnostics.messages).toEqual([
      '{{slot "front-body" image=true}} in demo/gear: "![[Nope.png]]" is not a picture the vault has; rendering nothing',
    ]);
  });

  it("fallback=(t …) renders when the slot is empty", () => {
    const { html } = render(`{{slot "front-stat-1a" fallback=(t "side-ref")}}`, {
      translations: { "side-ref": "Dragonbane" },
    });
    expect(html).toBe("Dragonbane");
    expect(
      render(`{{slot "front-stat-1a" fallback=(t "side-ref")}}`, { data: { grip: "2H" } })
        .html
    ).toBe("2H");
  });

  it("plain=true is what a comparison reads, and eq compares it", () => {
    const data = { name: "[[Furcht|FURCHT]]", subtitle: "Furcht" };
    expect(render(`{{slot "front-title" plain=true}}`, { data }).html).toBe("FURCHT");
    expect(
      render(
        `{{#unless (eq (slot "front-title" plain=true) (slot "front-subtitle" plain=true))}}differ{{/unless}}`,
        { data }
      ).html
    ).toBe("differ");
    expect(
      render(`{{#if (eq (slot "front-title" plain=true) "Note")}}same{{/if}}`).html
    ).toBe("same");
  });

  it('markdown="block" renders a body with the embed hook', () => {
    const { html } = render(`{{slot "front-body" markdown="block"}}`, {
      data: { content: "Para.\n\n![[x.png|alt]]" },
    });
    expect(html).toBe('<p>Para.</p>\n<p><img src="x.png" alt="alt"></p>\n');
  });

  it("reports markdown= with a value that is none of the three", () => {
    const { diagnostics } = render(`{{slot "front-body" markdown="blok"}}`);
    expect(diagnostics.messages).toEqual([
      '{{slot "front-body"}}: markdown=blok is neither true, false nor "block"; using the default',
    ]);
  });

  it("signed=true puts the sign back on a modifier, and says so for a word", () => {
    expect(
      render(`{{slot "front-stat-1a" signed=true}}`, { data: { grip: 2 } }).html
    ).toBe("+2");
    expect(
      render(`{{slot "front-stat-1a" signed=true}}`, { data: { grip: "-1" } }).html
    ).toBe("-1");
    const { html, diagnostics } = render(`{{slot "front-stat-1a" signed=true}}`, {
      data: { grip: "two" },
    });
    expect(html).toBe("two");
    expect(diagnostics.messages).toEqual([
      '{{slot "front-stat-1a"}} in demo/gear: signed=true on "two", which is not a number; leaving it as it is',
    ]);
  });

  it("join= is the separator of a list, and takes a string only", () => {
    const data = { content: ["Athletics", "Acrobatics"] };
    expect(render(`{{slot "front-body" join=" / "}}`, { data }).html).toBe(
      "Athletics / Acrobatics"
    );
    expect(render(`{{slot "front-body"}}`, { data }).html).toBe("Athletics, Acrobatics");
    const { html, diagnostics } = render(`{{slot "front-body" join=true}}`, { data });
    expect(html).toBe("Athletics, Acrobatics");
    expect(diagnostics.messages).toEqual([
      '{{slot "front-body"}}: join=true is not a string; using the default',
    ]);
  });

  it("signed=true on the list form signs the numeric fields and leaves the words alone, quietly", () => {
    const { html, diagnostics } = render(
      `{{#each (slot "front-body" list=true signed=true)}}[{{name}} {{bonus}}]{{/each}}`,
      {
        data: {
          content: [
            { name: "Athletics", bonus: 7 },
            { name: "Stealth", bonus: -1 },
          ],
        },
      }
    );
    expect(html).toBe("[Athletics +7][Stealth -1]");
    expect(diagnostics.messages).toEqual([]);
  });

  it("list=true keeps an item's keys as written, and finds them in any case", () => {
    const { html } = render(
      `{{#each (slot "front-body" list=true signed=true)}}{{#each this}}[{{@key}} {{this}}]{{/each}}{{/each}}`,
      { data: { content: [{ REF: 8 }, { Athletik: -1 }] } }
    );
    expect(html).toBe("[REF +8][Athletik -1]");
  });

  it("list=true is the shape of the answer, whatever join= says", () => {
    expect(
      render(`{{#each (slot "front-body" list=true join=" / ")}}[{{this}}]{{/each}}`, {
        data: { content: ["a", "b"] },
      }).html
    ).toBe("[a][b]");
  });
});

describe("{{or}}", () => {
  it("is the first present argument — a rendered 0 counts, an empty slot does not", () => {
    const data = { griff: 0 };
    expect(
      render(`{{#if (or (slot "front-subtitle") (slot "front-stat-1a"))}}box{{/if}}`, {
        data,
      }).html
    ).toBe("box");
    expect(
      render(`{{#if (or (slot "front-subtitle") (slot "front-stat-1a"))}}box{{/if}}`).html
    ).toBe("");
    expect(render(`{{or "" "b"}}`).html).toBe("b");
  });
});

describe("{{slot-class}}", () => {
  const classifiers = {
    "front-stat-1a": {
      match: [{ pattern: /^.{1,2}$/u, token: "narrow" }],
      default: "wide",
    },
  };

  it("buckets the display text through the slot's classifier", () => {
    expect(
      render(`x-{{slot-class "front-stat-1a"}}`, {
        data: { griff: "[[Sieben|7]]" },
        classifiers,
      }).html
    ).toBe("x-narrow");
    expect(
      render(`x-{{slot-class "front-stat-1a"}}`, { data: { griff: "9–10" }, classifiers })
        .html
    ).toBe("x-wide");
  });

  it("takes glyph= and fallback= like {{slot}}", () => {
    const glyphs = { "front-stat-1a": { "1h": "einhändig" } };
    expect(
      render(`{{slot-class "front-stat-1a" glyph=true}}`, {
        data: { griff: "1H" },
        classifiers,
        glyphs,
      }).html
    ).toBe("wide");
    expect(
      render(`{{slot-class "front-stat-1a" fallback="ab"}}`, { classifiers }).html
    ).toBe("narrow");
  });

  it("value= classifies that value instead — a class per item of the list form", () => {
    const { html, diagnostics } = render(
      `{{#each (slot "front-stat-1a" list=true plain=true)}}<i class="{{slot-class "front-stat-1a" value=this}}">{{this}}</i>{{/each}}`,
      { data: { griff: ["ab", "[[Lang|abc]]", "x"] }, classifiers }
    );
    expect(html).toBe(
      '<i class="narrow">ab</i><i class="wide">abc</i><i class="narrow">x</i>'
    );
    expect(diagnostics.messages).toEqual([]);
    expect(
      render(`{{slot-class "front-stat-1a" value="9–10"}}`, {
        data: { griff: "7" },
        classifiers,
      }).html
    ).toBe("wide");
  });

  it("reports a slot no classifier serves", () => {
    const { html, diagnostics } = render(`{{slot-class "front-title"}}`, { classifiers });
    expect(html).toBe("");
    expect(diagnostics.messages).toEqual([
      '{{slot-class "front-title"}}: no classifier of demo/gear serves "front-title"; rendering nothing',
    ]);
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

  it("reports a bare call too", () => {
    const { diagnostics } = render(`{{slot-label}}`);
    expect(diagnostics.messages).toEqual([
      "{{slot-label}} without a slot name in demo/gear; rendering nothing",
    ]);
  });

  it("escapes a caption and a translation on output", () => {
    const { html } = render(`{{slot-label "front-stat-1a"}} {{t "x"}}`, {
      translations: { "front-stat-1a-label": "A & B", x: "<i>" },
    });
    expect(html).toBe("A &amp; B &lt;i&gt;");
  });
});
