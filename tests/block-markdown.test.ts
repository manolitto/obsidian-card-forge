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

  it("prints raw HTML as text, inline and as a block, and keeps <br>", () => {
    expect(render("a<br/>b <b>c</b>")).toBe("<p>a<br>b &lt;b&gt;c&lt;/b&gt;</p>\n");
    expect(render("x <img src=x onerror=alert(1)> y")).toBe(
      "<p>x &lt;img src=x onerror=alert(1)&gt; y</p>\n"
    );
    expect(render('<div class="k">\n\nlate\n\n</div>')).toBe(
      "&lt;div class=&quot;k&quot;&gt;<p>late</p>\n&lt;/div&gt;"
    );
    expect(render("one<BR>two")).toBe("<p>one<br>two</p>\n");
    expect(render("a < b > c")).toBe("<p>a &lt; b &gt; c</p>\n");
  });

  it("keeps an inline SVG's drawing elements and their attributes", () => {
    const icon =
      '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="13.65" viewBox="0 0 127.14 96.36" style="vertical-align:middle"><path fill="#5865F2" d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0Z"/></svg>';
    expect(render(`Design: ${icon} @name`)).toBe(`<p>Design: ${icon} @name</p>\n`);
    expect(
      render('<g><rect x="1" y="1"/><circle r="2"/><polygon points="0,0 1,1"/></g>')
    ).toBe(
      '<p><g><rect x="1" y="1"/><circle r="2"/><polygon points="0,0 1,1"/></g></p>\n'
    );
  });

  it("keeps an SVG that stands as a block of its own", () => {
    expect(
      render(
        'Before.\n\n<svg viewBox="0 0 2 2">\n  <path d="M0 0h2v2z"/>\n</svg>\n\nAfter.'
      )
    ).toBe(
      '<p>Before.</p>\n<svg viewBox="0 0 2 2">\n  <path d="M0 0h2v2z"/>\n</svg><p>After.</p>\n'
    );
  });

  it("drops what an SVG could do beyond drawing", () => {
    expect(
      render('<svg onload="alert(1)" ONMOUSEOVER=x width="1"><path d="M0"/></svg>')
    ).toBe('<p><svg width="1"><path d="M0"/></svg></p>\n');
    expect(render('<svg><a href="javascript:alert(1)" xlink:href="#x">t</a></svg>')).toBe(
      "<p><svg>&lt;a href=&quot;javascript:alert(1)&quot; xlink:href=&quot;#x&quot;&gt;t&lt;/a&gt;</svg></p>\n"
    );
    expect(render("<svg><script>alert(1)</script></svg>")).toBe(
      "<p><svg>&lt;script&gt;alert(1)&lt;/script&gt;</svg></p>\n"
    );
    expect(
      render('<svg><use href="#x"/><image href="a.png"/><foreignObject/></svg>')
    ).toBe(
      "<p><svg>&lt;use href=&quot;#x&quot;/&gt;&lt;image href=&quot;a.png&quot;/&gt;&lt;foreignObject/&gt;</svg></p>\n"
    );
  });
});
