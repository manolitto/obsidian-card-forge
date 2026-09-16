import { describe, expect, it } from "vitest";
import { parseDeckBlock, quoteTagValues } from "../src/deck/block";
import { collectDiagnostics } from "../src/definitions/diagnostics";

const fence = (yaml: string): string =>
  `# Deck\n\n\`\`\`card-forge-deck\n${yaml}\n\`\`\`\n`;

const parse = (
  yaml: string,
  diagnostics = collectDiagnostics(),
  path = "Karten/Ausrüstung/Waffen.md"
) => parseDeckBlock(fence(yaml), path, diagnostics);

describe("the card-forge-deck block", () => {
  it("is found with spaces after the fence, and the note without one is not a deck", () => {
    const diagnostics = collectDiagnostics();
    const deck = parseDeckBlock(
      "```card-forge-deck   \nsystem: dragonbane\n```",
      "Deck.md",
      diagnostics
    );
    expect(deck?.selection.systemId).toBe("dragonbane");
    expect(
      parseDeckBlock("```card-forge\ncard: {}\n```", "Deck.md", diagnostics)
    ).toBeUndefined();
    expect(diagnostics.messages).toEqual([]);
  });

  it("reads the first of two blocks and reports the second", () => {
    const diagnostics = collectDiagnostics();
    const deck = parseDeckBlock(
      `${fence("system: a")}\n${fence("system: b")}`,
      "Deck.md",
      diagnostics
    );
    expect(deck?.selection.systemId).toBe("a");
    expect(diagnostics.matching("2 card-forge-deck blocks")).toHaveLength(1);
  });

  it("splits the keys three ways: selection, deck settings, the card layer", () => {
    const deck = parse(
      [
        "system: Dragonbane",
        "card-type: [Gear, creature]",
        "folder: Karten/Ausrüstung/",
        "card-languages: [DE, en]",
        "paper-size: A4 landscape",
        "folder-recursive: true",
        "card-copies: [{ name: '[[Beil]]', copies: 3 }]",
        "card-size: mini",
        "language: de",
        "copies: 2",
      ].join("\n")
    );
    expect(deck?.selection).toEqual({
      folder: "Karten/Ausrüstung",
      systemId: "dragonbane",
      cardTypeIds: ["gear", "creature"],
      includeTagsAll: [],
      includeTagsAny: [],
      excludeTagsAny: [],
      excludeTagsAll: [],
      languages: ["de", "en"],
    });
    expect(deck?.settings.paperSize).toEqual({
      width: 210,
      height: 297,
      orientation: "landscape",
    });
    expect(deck?.settings.folderRecursive).toBe(true);
    expect(deck?.settings.cardCopies).toEqual([{ name: "Beil", copies: 3 }]);
    expect(deck?.cardLayer).toEqual({
      cardSize: { width: 44, height: 63 },
      language: "de",
      copies: 2,
    });
  });

  it("folds the deck settings onto the baseline, and leaves the card layer a layer", () => {
    const deck = parse("system: simple");
    // The baseline's paper answers when the deck says nothing; a card
    // setting the deck does not write is nobody's here — the card type and
    // the note fold around the layer.
    expect(deck?.settings.paperSize).toEqual({
      width: 210,
      height: 297,
      orientation: "auto",
    });
    expect(deck?.settings.cutMarks?.enabled).toBeDefined();
    expect(deck?.cardLayer).toEqual({});
  });

  it("reports a key it does not know, by name, and keeps the rest", () => {
    const diagnostics = collectDiagnostics();
    const deck = parse("system: simple\ntags: [Waffe]\nmarker-classes: x", diagnostics);
    expect(deck?.selection.systemId).toBe("simple");
    expect(diagnostics.matching('"tags:" is not a key')).toHaveLength(1);
    expect(diagnostics.matching('"marker-classes:" is not a key')).toHaveLength(1);
  });

  it("names the note when a setting's value is wrong, and keeps the layer below", () => {
    const diagnostics = collectDiagnostics();
    const deck = parse("system: simple\npaper-size: A7\ncard-size: huge", diagnostics);
    expect(deck?.settings.paperSize?.width).toBe(210);
    expect(deck?.cardLayer.cardSize).toBeUndefined();
    expect(diagnostics.matching("Karten/Ausrüstung/Waffen.md: ")).toHaveLength(2);
  });

  it("is not a deck without a system, and says so", () => {
    const diagnostics = collectDiagnostics();
    expect(parse("card-type: gear", diagnostics)).toBeUndefined();
    expect(diagnostics.matching("names no system:")).toHaveLength(1);
  });

  it("reports YAML that does not parse, naming the note", () => {
    const diagnostics = collectDiagnostics();
    expect(parse("system: [a\ncard-type: b", diagnostics)).toBeUndefined();
    expect(
      diagnostics.matching("Waffen.md: the card-forge-deck block is not valid YAML")
    ).toHaveLength(1);
  });

  it("takes a card-type as one name or a list, and reports what is neither", () => {
    const diagnostics = collectDiagnostics();
    expect(parse("system: s\ncard-type: gear")?.selection.cardTypeIds).toEqual(["gear"]);
    expect(
      parse("system: s\ncard-type: [gear, { id: x }, '']", diagnostics)?.selection
        .cardTypeIds
    ).toEqual(["gear"]);
    expect(diagnostics.matching("card-type: ")).toHaveLength(1);
  });
});

describe("the folder", () => {
  it("defaults to the deck note's own, the root being empty", () => {
    expect(parse("system: s")?.selection.folder).toBe("Karten/Ausrüstung");
    expect(parse("system: s", undefined, "Deck.md")?.selection.folder).toBe("");
  });

  it("takes the block's when it names one, trailing slashes off, a bare slash as the root", () => {
    expect(parse("system: s\nfolder: Monster//")?.selection.folder).toBe("Monster");
    expect(parse("system: s\nfolder: /")?.selection.folder).toBe("");
  });
});

describe("the output path", () => {
  it("is the deck note's name beside it, in both formats", () => {
    expect(parse("system: s")?.outputPath).toEqual({
      pdf: "Karten/Ausrüstung/Waffen.pdf",
      html: "Karten/Ausrüstung/Waffen.html",
    });
    expect(parse("system: s", undefined, "Deck.md")?.outputPath).toEqual({
      pdf: "Deck.pdf",
      html: "Deck.html",
    });
  });

  it("follows output-path:, whichever extension it was written with", () => {
    expect(parse("system: s\noutput-path: Export/Waffen.pdf")?.outputPath).toEqual({
      pdf: "Export/Waffen.pdf",
      html: "Export/Waffen.html",
    });
    expect(parse("system: s\noutput-path: Export/waffen")?.outputPath.html).toBe(
      "Export/waffen.html"
    );
  });
});

describe("the tag filters", () => {
  it("read a scalar or a list, strip the hash, and lowercase", () => {
    const deck = parse(
      [
        "system: s",
        "include-tags-all: '#Waffe'",
        "include-tags-any: [Rüstung, '#Helm']",
        "exclude-tags-any:",
        "  - Entwurf",
        "exclude-tags-all: [a, b]",
      ].join("\n")
    );
    expect(deck?.selection.includeTagsAll).toEqual(["waffe"]);
    expect(deck?.selection.includeTagsAny).toEqual(["rüstung", "helm"]);
    expect(deck?.selection.excludeTagsAny).toEqual(["entwurf"]);
    expect(deck?.selection.excludeTagsAll).toEqual(["a", "b"]);
  });

  it("accept tags written the way Obsidian shows them, unquoted", () => {
    // A bare `#` starts a YAML comment; without the pre-pass every one of
    // these would read as nothing.
    const deck = parse(
      [
        "system: s",
        "include-tags-all:",
        "  - #Waffe",
        "  - #Nahkampf",
        "include-tags-any: #Helm",
        "exclude-tags-any: [#Entwurf, #Alt]",
        "card-type: gear # a comment stays one",
      ].join("\n")
    );
    expect(deck?.selection.includeTagsAll).toEqual(["waffe", "nahkampf"]);
    expect(deck?.selection.includeTagsAny).toEqual(["helm"]);
    expect(deck?.selection.excludeTagsAny).toEqual(["entwurf", "alt"]);
    expect(deck?.selection.cardTypeIds).toEqual(["gear"]);
  });

  it("quote only under a tag key, and close the block at the next key", () => {
    expect(
      quoteTagValues("include-tags-all:\n  - #a\n\n  - #b\ncard-type:\n  - #c")
    ).toBe('include-tags-all:\n  - "#a"\n\n  - "#b"\ncard-type:\n  - #c');
  });
});
