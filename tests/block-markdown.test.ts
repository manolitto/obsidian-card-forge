import { describe, expect, it } from "vitest";
import { blockMarkdown } from "../src/templates/block-markdown";

const render = blockMarkdown((target, alt) => `<img src="${target}" alt="${alt}">`);

describe("block markdown", () => {
  it("renders paragraphs, headings, both list kinds and a table", () => {
    const html = render(
      "# H\n\nPara.\n\n- a\n- b\n\n1. x\n\n| c | d |\n|---|---|\n| 1 | 2 |\n"
    );
    expect(html).toContain("<h1>H</h1>");
    expect(html).toContain("<p>Para.</p>");
    expect(html).toContain("<ul>\n<li>a</li>\n<li>b</li>\n</ul>");
    expect(html).toContain("<ol>\n<li>x</li>\n</ol>");
    expect(html).toContain("<table>");
    expect(html).toContain("<td>2</td>");
  });

  it("makes a wikilink the same span a value's link becomes, with or without an alias", () => {
    expect(render("See [[Troll]] and [[Troll|the troll]].")).toBe(
      '<p>See <span class="cs-wikilink">Troll</span> and <span class="cs-wikilink">the troll</span>.</p>\n'
    );
  });

  it("hands an embed to the hook, and escapes the alias of a link", () => {
    expect(render("![[Beil.png|An axe]]")).toBe(
      '<p><img src="Beil.png" alt="An axe"></p>\n'
    );
    expect(render("![[Beil.png]]")).toBe('<p><img src="Beil.png" alt="Beil.png"></p>\n');
    expect(render("[[x|<b>]]")).toContain("&lt;b&gt;");
  });

  it("turns a card-break line into a marker block", () => {
    expect(render("One.\n\n%% card-break %%\n\nTwo.")).toBe(
      '<p>One.</p>\n<div class="cs-card-break"></div><p>Two.</p>\n'
    );
  });

  it("wraps a paired marker's region and renders the markdown inside", () => {
    expect(render("%% keep-together %%\n**a**\n\nb\n%% /keep-together %%")).toBe(
      '<div class="cs-keep-together"><p><strong>a</strong></p>\n<p>b</p>\n</div>'
    );
    expect(render("%% Keep-With-Next %%\nh\n%% /keep-with-next %%\n\np")).toContain(
      '<div class="cs-keep-with-next"><p>h</p>\n</div><p>p</p>'
    );
  });

  it("nests same-name markers by depth", () => {
    const html = render(
      "%% keep-together %%\nouter\n%% keep-together %%\ninner\n%% /keep-together %%\nstill outer\n%% /keep-together %%"
    );
    expect(html).toBe(
      '<div class="cs-keep-together"><p>outer</p>\n<div class="cs-keep-together"><p>inner</p>\n</div><p>still outer</p>\n</div>'
    );
  });

  it("swallows a stray closer and an empty region, and runs an unterminated marker to the end", () => {
    expect(render("a\n\n%% /keep-together %%\n\nb")).toBe("<p>a</p>\n<p>b</p>\n");
    expect(render("%% keep-together %%\n%% /keep-together %%")).toBe("");
    expect(render("%% keep-together %%\nto the end")).toBe(
      '<div class="cs-keep-together"><p>to the end</p>\n</div>'
    );
  });

  it("leaves an unknown comment as text", () => {
    expect(render("%% note to self %%")).toBe("<p>%% note to self %%</p>\n");
  });

  it("prints raw HTML as text, inline and as a block, and keeps only <br>", () => {
    expect(render("a<br/>b <b>c</b>")).toBe("<p>a<br>b &lt;b&gt;c&lt;/b&gt;</p>\n");
    expect(render("x <img src=x onerror=alert(1)> y")).toBe(
      "<p>x &lt;img src=x onerror=alert(1)&gt; y</p>\n"
    );
    expect(render('<div class="k">\n\nlate\n\n</div>')).toBe(
      "&lt;div class=&quot;k&quot;&gt;<p>late</p>\n&lt;/div&gt;"
    );
    expect(render("one<BR>two")).toBe("<p>one<br>two</p>\n");
  });
});
