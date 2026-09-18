import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_SPEC,
  renderValue,
  type RenderSpec,
} from "../src/templates/render-value";

const PROSE = "Wirkt gegen [[Untote|jeden Untoten]] & **Geister**.";
const LITERAL = "-\u00a01 auf *alles*";
const BLOCK = "Erste Zeile\nZweite Zeile\n- ein Punkt\n- noch einer";

const spec = (overrides: Partial<RenderSpec>): RenderSpec => ({
  ...DEFAULT_SPEC,
  ...overrides,
});

describe("the defaults", () => {
  it("are markdown on, everything else off", () => {
    expect(DEFAULT_SPEC).toEqual({
      markdown: true,
      linebreaks: false,
      glyph: false,
      signed: false,
      join: ", ",
      image: false,
      plain: false,
    });
  });

  it("render prose with its link styled and its markdown interpreted", () => {
    expect(renderValue(PROSE, DEFAULT_SPEC)).toBe(
      'Wirkt gegen <span class="cs-wikilink">jeden Untoten</span> &amp; <strong>Geister</strong>.'
    );
  });

  it("interpret a stray marker in a value that was meant literally", () => {
    expect(renderValue(LITERAL, DEFAULT_SPEC)).toBe("-\u00a01 auf <em>alles</em>");
  });

  it("leave a newline alone, and make a list of a run", () => {
    expect(renderValue(BLOCK, DEFAULT_SPEC)).toBe(
      "Erste Zeile\nZweite Zeile\n<ul><li>ein Punkt</li><li>noch einer</li></ul>"
    );
  });
});

describe("markdown=false", () => {
  const off = spec({ markdown: false });

  it("still styles the link, and escapes the rest", () => {
    expect(renderValue(PROSE, off)).toBe(
      'Wirkt gegen <span class="cs-wikilink">jeden Untoten</span> &amp; **Geister**.'
    );
  });

  it("keeps a marker literal", () => {
    expect(renderValue(LITERAL, off)).toBe(LITERAL);
  });

  it("makes no list", () => {
    expect(renderValue(BLOCK, off)).toBe(BLOCK);
  });
});

describe("linebreaks=true", () => {
  it("turns every newline into <br>, after markdown", () => {
    expect(renderValue(BLOCK, spec({ linebreaks: true }))).toBe(
      "Erste Zeile<br>Zweite Zeile<br><ul><li>ein Punkt</li><li>noch einer</li></ul>"
    );
  });

  it("turns every newline into <br> without markdown too", () => {
    expect(renderValue(BLOCK, spec({ markdown: false, linebreaks: true }))).toBe(
      "Erste Zeile<br>Zweite Zeile<br>- ein Punkt<br>- noch einer"
    );
  });

  it("changes nothing for prose on one line", () => {
    expect(renderValue(PROSE, spec({ linebreaks: true }))).toBe(
      renderValue(PROSE, DEFAULT_SPEC)
    );
  });
});

describe("empty and non-string values", () => {
  it.each([null, undefined, ""])("renders %s as the empty string", (value) => {
    expect(renderValue(value, DEFAULT_SPEC)).toBe("");
    expect(renderValue(value, spec({ markdown: false, linebreaks: true }))).toBe("");
  });

  it("renders a number and a boolean as their text — 0 is a value", () => {
    expect(renderValue(0, DEFAULT_SPEC)).toBe("0");
    expect(renderValue(false, DEFAULT_SPEC)).toBe("false");
  });

  it("joins a list with a comma", () => {
    expect(renderValue(["Feuer", "[[Eis]]", 3], DEFAULT_SPEC)).toBe(
      'Feuer, <span class="cs-wikilink">Eis</span>, 3'
    );
  });

  it("skips empty items of a list, and renders an empty list as nothing", () => {
    expect(renderValue(["a", "", null, "b"], DEFAULT_SPEC)).toBe("a, b");
    expect(renderValue([], DEFAULT_SPEC)).toBe("");
  });

  it("has no scalar rendering for an object", () => {
    expect(renderValue({ name: "x" }, DEFAULT_SPEC)).toBe("");
    expect(renderValue([{ name: "x" }], DEFAULT_SPEC)).toBe("");
  });
});

describe("HTML in a value", () => {
  it.each([
    spec({}),
    spec({ markdown: false }),
    spec({ linebreaks: true }),
    spec({ markdown: false, linebreaks: true }),
  ])("is escaped under %o", (s) => {
    expect(renderValue("<script>x</script> \"q\" 'a'", s)).toBe(
      "&lt;script&gt;x&lt;/script&gt; &quot;q&quot; &#39;a&#39;"
    );
  });
});

describe("the rows the switches add", () => {
  const reports: string[] = [];
  const env = {
    glyph: (text: string) => ({ "1h": "einhändig" })[text.toLowerCase()] ?? text,
    image: (link: string) =>
      link === "[[Beil.png]]" ? "data:image/png;base64,QQ==" : undefined,
    block: (text: string) => `<block>${text}</block>`,
    report: (message: string) => {
      reports.push(message);
    },
  };
  beforeEach(() => reports.splice(0));

  it("glyph: maps the raw value first, each item of a list, and leaves the rest", () => {
    expect(renderValue("1H", spec({ glyph: true }), env)).toBe("einhändig");
    expect(renderValue(["1h", "x"], spec({ glyph: true }), env)).toBe("einhändig, x");
    expect(renderValue("1H", spec({}), env)).toBe("1H");
  });

  it("signed: puts the sign on a number, leaves 0, a signed value and a word alone", () => {
    const s = spec({ signed: true });
    expect(renderValue(5, s, env)).toBe("+5");
    expect(renderValue(-2, s, env)).toBe("-2");
    expect(renderValue(0, s, env)).toBe("0");
    expect(renderValue("+3", s, env)).toBe("+3");
    expect(renderValue("+2 (+4 mounted)", s, env)).toBe("+2 (+4 mounted)");
    expect(reports).toEqual([]);
    expect(renderValue("1d6", s, env)).toBe("1d6");
    expect(reports).toEqual([
      'signed=true on "1d6", which is not a number; leaving it as it is',
    ]);
  });

  it("signed: each item of a list, after its glyph", () => {
    expect(renderValue([3, "1h", -1], spec({ signed: true, glyph: true }), env)).toBe(
      "+3, einhändig, -1"
    );
  });

  it("join: the separator of a list — a scalar and an empty list are what they were", () => {
    const s = spec({ join: " / " });
    expect(renderValue(["Athletics", "Acrobatics"], s, env)).toBe(
      "Athletics / Acrobatics"
    );
    expect(renderValue("Athletics", s, env)).toBe("Athletics");
    expect(renderValue([], s, env)).toBe("");
    expect(renderValue(["a", "b"], spec({ join: "" }), env)).toBe("ab");
  });

  it("image: yields the resolved URI and nothing else, and nothing for a miss", () => {
    expect(renderValue("[[Beil.png]]", spec({ image: true }), env)).toBe(
      "data:image/png;base64,QQ=="
    );
    expect(renderValue("[[Nope.png]]", spec({ image: true }), env)).toBe("");
  });

  it("fallback: steps in for an empty value, through the same switches, and not for 0", () => {
    const s = spec({ fallback: "*Dragonbane*" });
    expect(renderValue("", s)).toBe("<em>Dragonbane</em>");
    expect(renderValue(undefined, s)).toBe("<em>Dragonbane</em>");
    expect(renderValue(0, s)).toBe("0");
    expect(renderValue("", spec({ fallback: "1h", glyph: true }), env)).toBe("einhändig");
    expect(renderValue("", spec({ fallback: "" }))).toBe("");
  });

  it("plain: display text only — no span, no markdown, escaped", () => {
    expect(renderValue(PROSE, spec({ plain: true }))).toBe(
      "Wirkt gegen jeden Untoten &amp; **Geister**."
    );
  });

  it('markdown="block": the body renderer in place of the inline step', () => {
    expect(renderValue("a\n\nb", spec({ markdown: "block" }), env)).toBe(
      "<block>a\n\nb</block>"
    );
  });
});
