import { describe, expect, it } from "vitest";
import {
  markdownInline,
  stripTags,
  wikilinkDisplayText,
  wikilinkInline,
} from "../src/templates/inline-markdown";

describe("markdownInline", () => {
  it("renders inline emphasis", () => {
    expect(markdownInline("**bold**")).toBe("<strong>bold</strong>");
    expect(markdownInline("*italic*")).toBe("<em>italic</em>");
    expect(markdownInline("***both***")).toBe("<strong><em>both</em></strong>");
    expect(markdownInline("__bold__ and _italic_")).toBe(
      "<strong>bold</strong> and <em>italic</em>"
    );
  });

  it("escapes HTML but passes an explicit <br> through", () => {
    expect(markdownInline("a & b")).toBe("a &amp; b");
    expect(markdownInline("<b>x</b>")).toBe("&lt;b&gt;x&lt;/b&gt;");
    expect(markdownInline("line1<br>line2")).toBe("line1<br>line2");
    expect(markdownInline("line1<br/>line2")).toBe("line1<br>line2");
    expect(markdownInline("line1<BR />line2")).toBe("line1<br>line2");
  });

  describe("unordered lists", () => {
    it("groups consecutive dash lines into one <ul>", () => {
      expect(markdownInline("- a\n- b\n- c")).toBe(
        "<ul><li>a</li><li>b</li><li>c</li></ul>"
      );
    });

    it("keeps an intro line, then bullets the run", () => {
      expect(markdownInline("Intro:\n- one\n- two")).toBe(
        "Intro:\n<ul><li>one</li><li>two</li></ul>"
      );
    });

    it("closes the list at the first line that is not an item", () => {
      expect(markdownInline("- a\nafter")).toBe("<ul><li>a</li></ul>after");
    });

    it("supports the `* ` marker without colliding with *italic*", () => {
      expect(markdownInline("* a\n* b")).toBe("<ul><li>a</li><li>b</li></ul>");
      expect(markdownInline("* a *b*")).toBe("<ul><li>a <em>b</em></li></ul>");
    });

    it("does not treat a no-break space after a dash as a bullet", () => {
      // A signed value keeps its sign glued to its digit; that is not a list.
      expect(markdownInline("-\u00a01 auf Rettungswurf")).toBe(
        "-\u00a01 auf Rettungswurf"
      );
    });

    it("does not treat an explicit <br> as a line separator", () => {
      // A `<br>` is a visible break inside a line, and only a newline starts one.
      expect(markdownInline("- a<br>- b")).toBe("<ul><li>a<br>- b</li></ul>");
    });
  });

  describe("ordered lists", () => {
    it("groups numbered lines into one <ol>, with either delimiter", () => {
      expect(markdownInline("1. one\n2. two\n3. three")).toBe(
        "<ol><li>one</li><li>two</li><li>three</li></ol>"
      );
      expect(markdownInline("1) a\n2) b")).toBe("<ol><li>a</li><li>b</li></ol>");
    });

    it("switches list kind between runs", () => {
      expect(markdownInline("- a\n1. b")).toBe("<ul><li>a</li></ul><ol><li>b</li></ol>");
    });

    it("leaves a decimal and a bare number alone", () => {
      expect(markdownInline("1.50 Meter")).toBe("1.50 Meter");
      expect(markdownInline("2024 war ein Jahr")).toBe("2024 war ein Jahr");
    });
  });

  describe("prose", () => {
    it("keeps newlines between non-list lines", () => {
      expect(markdownInline("A\nB\nC")).toBe("A\nB\nC");
    });

    it("keeps a dash in the middle of a sentence", () => {
      expect(markdownInline("nur ein - Gedankenstrich")).toBe("nur ein - Gedankenstrich");
    });
  });

  describe("wikilinks", () => {
    it("shows a plain link as its target and an aliased link as its alias", () => {
      expect(markdownInline("siehe [[Rüstung]]")).toBe(
        'siehe <span class="cs-wikilink">Rüstung</span>'
      );
      expect(markdownInline("siehe [[Regelbuch#S51|Regelbuch S. 49]]")).toBe(
        'siehe <span class="cs-wikilink">Regelbuch S. 49</span>'
      );
    });

    it("handles the embed form without leaving the `!` behind", () => {
      expect(markdownInline("![[Rüstung]]")).toBe(
        '<span class="cs-wikilink">Rüstung</span>'
      );
    });
  });

  it("drops tags", () => {
    expect(markdownInline("Der Hundeführer #Klasse")).toBe("Der Hundeführer ");
  });
});

describe("wikilinkInline", () => {
  it("styles wikilinks and leaves the rest as literal text", () => {
    expect(wikilinkInline("[[Schwert]] und [[Schild|Buckler]]")).toBe(
      '<span class="cs-wikilink">Schwert</span> und <span class="cs-wikilink">Buckler</span>'
    );
  });

  it("interprets no other markdown", () => {
    expect(wikilinkInline("- 1 auf *alles*")).toBe("- 1 auf *alles*");
    expect(wikilinkInline("- a\n- b")).toBe("- a\n- b");
  });

  it("escapes HTML, an explicit <br> included", () => {
    expect(wikilinkInline("a & b <b>c</b>")).toBe("a &amp; b &lt;b&gt;c&lt;/b&gt;");
    expect(wikilinkInline("a<br>b")).toBe("a&lt;br&gt;b");
  });
});

describe("wikilinkDisplayText", () => {
  it("reduces every link to what it shows, and drops tags", () => {
    expect(wikilinkDisplayText("[[Schwert]], [[Schild|Buckler]] #Waffe")).toBe(
      "Schwert, Buckler "
    );
    expect(wikilinkDisplayText("![[bild.png|Alt]]")).toBe("Alt");
  });

  it("does not escape", () => {
    expect(wikilinkDisplayText("a & b")).toBe("a & b");
  });
});

describe("stripTags", () => {
  it("drops a tag alone, at the end of a line, in a row, nested, with umlauts", () => {
    expect(stripTags("#Klasse\n\nText")).toBe("\n\nText");
    expect(stripTags("Der Hundeführer #Klasse")).toBe("Der Hundeführer ");
    expect(stripTags("#a #b #c").trim()).toBe("");
    expect(stripTags("x #npc/wichtig y")).toBe("x  y");
    expect(stripTags("#Ausrüstung #stufe2 #haus_regel #keep-together-ish")).toBe("   ");
  });

  it("drops a tag after an explicit <br>", () => {
    expect(stripTags("Zeile<br>#Klasse")).toBe("Zeile<br>");
  });

  it("leaves every other hash alone", () => {
    expect(stripTags("# Titel\n## Abschnitt")).toBe("# Titel\n## Abschnitt");
    expect(stripTags("[[#Abschnitt]]")).toBe("[[#Abschnitt]]");
    expect(stripTags("[[Regelbuch#S51|Regelbuch S. 49]]")).toBe(
      "[[Regelbuch#S51|Regelbuch S. 49]]"
    );
    expect(stripTags("https://example.com#anker")).toBe("https://example.com#anker");
    expect(stripTags("Nr. #42")).toBe("Nr. #42");
    expect(stripTags("a # b")).toBe("a # b");
  });

  it("leaves code alone", () => {
    expect(stripTags("nutze `#Klasse` als Tag")).toBe("nutze `#Klasse` als Tag");
    expect(stripTags("```\n#Klasse\n```\n#Klasse")).toBe("```\n#Klasse\n```\n");
  });
});
