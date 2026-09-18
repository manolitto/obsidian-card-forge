import { describe, expect, it } from "vitest";
import type { DeckSelection } from "../src/deck/block";
import { selectNotes, sortCards } from "../src/deck/select";
import type { TaggedNote } from "../src/deck/source";
import { collectDiagnostics } from "../src/definitions/diagnostics";
import { parseNote } from "../src/render/note";

/** A card note from its block's `card:` lines, tagged. */
function note(path: string, card: string, tags: string[] = []): TaggedNote {
  const text = `\`\`\`cardsmith\ncard:\n${card
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n")}\n\`\`\``;
  const parsed = parseNote(text, path, collectDiagnostics());
  if (!parsed) throw new Error(`${path} is not a card note`);
  return { note: parsed, tags };
}

const system = {
  id: "demo",
  cardTypes: {
    gear: { cardSettings: { language: "de" } },
    spell: { cardSettings: { language: "de" } },
  },
};

const selection = (over: Partial<DeckSelection> = {}): DeckSelection => ({
  folder: "",
  systemId: "demo",
  cardTypeIds: [],
  includeTagsAll: [],
  includeTagsAny: [],
  excludeTagsAny: [],
  excludeTagsAll: [],
  languages: [],
  ...over,
});

const names = (kept: TaggedNote[]): string[] => kept.map((entry) => entry.note.name);

const select = (
  notes: TaggedNote[],
  over: Partial<DeckSelection> = {},
  diagnostics = collectDiagnostics()
) => names(selectNotes(notes, selection(over), system, diagnostics));

describe("selecting notes", () => {
  const beil = note("K/Beil.md", "system: demo\ncard-type: gear", ["waffe", "nahkampf"]);
  const bogen = note("K/Bogen.md", "system: demo\ncard-type: gear", [
    "Waffe",
    "fernkampf",
  ]);
  const feuerball = note("K/Feuerball.md", "system: demo\ncard-type: spell", ["feuer"]);
  const fremd = note("K/Fremd.md", "system: other\ncard-type: gear", ["waffe"]);
  const all = [beil, bogen, feuerball, fremd];

  it("keeps the deck's system and drops another silently", () => {
    const diagnostics = collectDiagnostics();
    expect(select(all, {}, diagnostics)).toEqual(["Beil", "Bogen", "Feuerball"]);
    expect(diagnostics.messages).toEqual([]);
  });

  it("reports a card note that names no system, since no deck could hold it", () => {
    const diagnostics = collectDiagnostics();
    const lost = note("K/Lost.md", "card-type: gear");
    expect(select([beil, lost], {}, diagnostics)).toEqual(["Beil"]);
    expect(
      diagnostics.matching("K/Lost.md: the cardsmith block names no system:")
    ).toHaveLength(1);
  });

  it("keeps the listed card types, the note's type resolved as the renderer resolves it", () => {
    expect(select(all, { cardTypeIds: ["spell"] })).toEqual(["Feuerball"]);
    // A note naming no card type is the only one of a one-type system.
    const only = { id: "demo", cardTypes: { gear: { cardSettings: {} } } };
    const unnamed = note("K/Unnamed.md", "system: demo");
    expect(
      names(
        selectNotes(
          [unnamed],
          selection({ cardTypeIds: ["gear"] }),
          only,
          collectDiagnostics()
        )
      )
    ).toEqual(["Unnamed"]);
    // In a two-type system it resolves to nothing, and a type filter drops it.
    expect(select([unnamed], { cardTypeIds: ["gear"] })).toEqual([]);
    expect(select([unnamed])).toEqual(["Unnamed"]);
  });

  it("applies the four tag filters, case aside, each on its own terms", () => {
    expect(select(all, { includeTagsAll: ["waffe", "nahkampf"] })).toEqual(["Beil"]);
    expect(select(all, { includeTagsAny: ["nahkampf", "feuer"] })).toEqual([
      "Beil",
      "Feuerball",
    ]);
    expect(select(all, { excludeTagsAny: ["fernkampf"] })).toEqual(["Beil", "Feuerball"]);
    expect(select(all, { excludeTagsAll: ["waffe", "fernkampf"] })).toEqual([
      "Beil",
      "Feuerball",
    ]);
    // Every filter must agree.
    expect(
      select(all, { includeTagsAny: ["waffe"], excludeTagsAny: ["nahkampf"] })
    ).toEqual(["Bogen"]);
  });

  it("keeps the cards that print in one of the deck's languages", () => {
    const english = note("K/Axe.md", "system: demo\ncard-type: gear\nlanguage: EN");
    const notes = [beil, english];
    expect(select(notes, { languages: ["de"] })).toEqual(["Beil"]);
    expect(select(notes, { languages: ["en"] })).toEqual(["Axe"]);
    expect(select(notes, { languages: ["en", "de"] })).toEqual(["Beil", "Axe"]);
  });

  it("lets a card whose chain names no language through — there is nothing to compare", () => {
    const mute = { id: "demo", cardTypes: { gear: { cardSettings: {} } } };
    const kept = selectNotes(
      [beil],
      selection({ languages: ["en"] }),
      mute,
      collectDiagnostics()
    );
    expect(names(kept)).toEqual(["Beil"]);
  });
});

describe("sorting cards", () => {
  const card = (cardTypeId: string, name: string, rollMin?: number) => ({
    cardTypeId,
    name,
    ...(rollMin === undefined ? {} : { rollMin }),
  });

  it("groups by the deck's card-type order, then the system's, then the id", () => {
    const cards = [
      card("spell", "b"),
      card("gear", "a"),
      card("rule", "c"),
      card("creature", "d"),
      card("zzz", "e"),
    ];
    const sorted = sortCards(cards, ["rule", "gear"], ["gear", "spell", "creature"]);
    expect(sorted.map((c) => c.cardTypeId)).toEqual([
      "rule",
      "gear",
      "spell",
      "creature",
      "zzz",
    ]);
  });

  it("orders a group by roll-min, cards without one after, then by name", () => {
    const cards = [
      card("table", "Zehn", 10),
      card("table", "Ohne"),
      card("table", "Eins", 1),
      card("table", "Auch ohne"),
      card("table", "Sieben", 7),
    ];
    expect(sortCards(cards, [], ["table"]).map((c) => c.name)).toEqual([
      "Eins",
      "Sieben",
      "Zehn",
      "Auch ohne",
      "Ohne",
    ]);
  });

  it("collates names as a reader would: numbers by value, case and accents aside", () => {
    const cards = ["Wolf 10", "wolf 2", "Äxte", "Axt", "Zwerg", "axt"].map((name) =>
      card("gear", name)
    );
    expect(sortCards(cards, [], ["gear"]).map((c) => c.name)).toEqual([
      "Axt",
      "axt",
      "Äxte",
      "wolf 2",
      "Wolf 10",
      "Zwerg",
    ]);
  });

  it("is stable and leaves the input alone", () => {
    const cards = [card("gear", "Same", 1), card("gear", "Same", 1)];
    const first = cards[0];
    const sorted = sortCards(cards, [], []);
    expect(sorted[0]).toBe(first);
    expect(sorted).not.toBe(cards);
  });
});
