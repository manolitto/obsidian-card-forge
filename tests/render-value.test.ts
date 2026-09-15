import { describe, expect, it } from "vitest";
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
  it("are markdown on, linebreaks off", () => {
    expect(DEFAULT_SPEC).toEqual({ markdown: true, linebreaks: false });
  });

  it("render prose with its link styled and its markdown interpreted", () => {
    expect(renderValue(PROSE, DEFAULT_SPEC)).toBe(
      'Wirkt gegen <span class="cf-wikilink">jeden Untoten</span> &amp; <strong>Geister</strong>.'
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
      'Wirkt gegen <span class="cf-wikilink">jeden Untoten</span> &amp; **Geister**.'
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
      'Feuer, <span class="cf-wikilink">Eis</span>, 3'
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
