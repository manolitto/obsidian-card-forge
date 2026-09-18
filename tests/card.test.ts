import { describe, expect, it } from "vitest";
import {
  collectDiagnostics,
  type CollectedDiagnostics,
} from "../src/definitions/diagnostics";
import { noteSystemId, resolveCards } from "../src/render/card";
import { parseNote } from "../src/render/note";
import { loadSystem, type LoadedSystem } from "../src/systems/loader";
import { loadedSystem } from "./helpers/render";
import { completeSystem, MemorySource, type Files } from "./helpers/systems";

async function system(files: Files = completeSystem()): Promise<LoadedSystem> {
  const diagnostics = collectDiagnostics();
  const loaded = await loadSystem(new MemorySource(files), "demo", diagnostics);
  if (!loaded || diagnostics.messages.length > 0)
    throw new Error(diagnostics.messages.join("\n"));
  return loaded;
}

/** `completeSystem` reduced to its `gear` card type. */
function oneCardType(): Files {
  const files = completeSystem();
  files["game-system.yaml"] = files["game-system.yaml"]!.toString().replace(
    /\n {2}spell:[\s\S]*$/,
    "\n"
  );
  delete files["spell/front.hbs"];
  return files;
}

function note(text: string, diagnostics: CollectedDiagnostics = collectDiagnostics()) {
  const parsed = parseNote(text, "Karten/Beil.md", diagnostics);
  if (!parsed) throw new Error("no block");
  return parsed;
}

const block = (card: string, rest = "") =>
  `\`\`\`cardsmith\ncard:\n${card}\n${rest}\`\`\``;

describe("which system", () => {
  it("is what the block names, lowercased", () => {
    expect(noteSystemId(note(block("  system: Demo")), collectDiagnostics())).toBe(
      "demo"
    );
  });

  it("is an error naming the note when the block names none", () => {
    const diagnostics = collectDiagnostics();
    expect(noteSystemId(note(block("  card-type: gear")), diagnostics)).toBeUndefined();
    expect(
      diagnostics.matching("Karten/Beil.md: the cardsmith block names no system:")
    ).toHaveLength(1);
  });
});

describe("which card type", () => {
  it("is what the block names", async () => {
    const cards = resolveCards(
      note(block("  system: demo\n  card-type: Spell")),
      await system(),
      collectDiagnostics()
    );
    expect(cards.map((c) => c.cardTypeId)).toEqual(["spell"]);
  });

  it("is the system's only one when the block names none", async () => {
    const cards = resolveCards(
      note(block("  system: demo")),
      await system(oneCardType()),
      collectDiagnostics()
    );
    expect(cards.map((c) => c.cardTypeId)).toEqual(["gear"]);
  });

  it("is an error listing the candidates when the block names none and there are several", async () => {
    const diagnostics = collectDiagnostics();
    expect(
      resolveCards(note(block("  system: demo")), await system(), diagnostics)
    ).toEqual([]);
    expect(
      diagnostics.matching("names no card-type:, and demo has 2: gear, spell")
    ).toHaveLength(1);
  });

  it("is an error naming the system when the block names one it does not have", async () => {
    const diagnostics = collectDiagnostics();
    expect(
      resolveCards(
        note(block("  system: demo\n  card-type: potion")),
        await system(),
        diagnostics
      )
    ).toEqual([]);
    expect(
      diagnostics.matching('demo has no card type "potion" (it has gear, spell)')
    ).toHaveLength(1);
  });
});

describe("the settings", () => {
  it("fold the note's card: keys over the card type's, and the language from each layer", async () => {
    const sys = await system();
    const [silent] = resolveCards(
      note(block("  system: demo\n  card-type: gear")),
      sys,
      collectDiagnostics()
    );
    expect(silent?.language).toBe("en"); // the system's first language
    expect(silent?.settings.cardSize).toEqual({ width: 63, height: 88 });

    const [spoken] = resolveCards(
      note(
        block("  system: demo\n  card-type: gear\n  language: DE\n  card-size: tarot")
      ),
      sys,
      collectDiagnostics()
    );
    expect(spoken?.language).toBe("de");
    expect(spoken?.settings.language).toBe("de");
    expect(spoken?.settings.cardSize?.width).toBe(70);
  });

  it("fold the deck's layer over the card type's and under the note's", async () => {
    const sys = await system();
    const deck = { cardSize: { width: 44, height: 63 }, language: "de", copies: 2 };
    const [card] = resolveCards(
      note(block("  system: demo\n  card-type: gear\n  copies: 3")),
      sys,
      collectDiagnostics(),
      deck
    );
    expect(card?.settings.cardSize?.width).toBe(44); // the deck over the system's poker
    expect(card?.language).toBe("de"); // the deck over the system's first language
    expect(card?.settings.copies).toBe(3); // the note over the deck
  });

  it("print a note at the deck's card-size, whatever the note says, and say so", async () => {
    const sys = await system();
    const diagnostics = collectDiagnostics();
    const deck = { cardSize: { width: 63, height: 88 } };
    const [card] = resolveCards(
      note(block("  system: demo\n  card-type: gear\n  card-size: tarot")),
      sys,
      diagnostics,
      deck
    );
    expect(card?.settings.cardSize).toEqual({ width: 63, height: 88 });
    expect(diagnostics.messages).toEqual([
      "Karten/Beil.md: card-size 70 × 120 mm — printed at the deck's 63 × 88 mm",
    ]);

    // The same size in other words is not an override.
    const quiet = collectDiagnostics();
    resolveCards(
      note(block("  system: demo\n  card-type: gear\n  card-size: 63x88")),
      sys,
      quiet,
      deck
    );
    expect(quiet.messages).toEqual([]);
  });

  it("report a card: key that is neither system, card-type nor a setting", async () => {
    const diagnostics = collectDiagnostics();
    resolveCards(
      note(block("  system: demo\n  card-type: gear\n  overflow-support: true")),
      await system(),
      diagnostics
    );
    expect(
      diagnostics.matching("Karten/Beil.md: card.overflow-support: is not a card setting")
    ).toHaveLength(1);
  });
});

describe("the props", () => {
  it("fold sections < frontmatter < data: < row, keys lowercased", async () => {
    const sys = await system();
    const text = [
      "---",
      "Category: from-frontmatter",
      "grip: from-frontmatter",
      "---",
      "From the body.",
      "",
      "## Category",
      "",
      "from-section",
      "",
      block("  system: demo\n  card-type: gear", "data:\n  Grip: from-data\n"),
    ].join("\n");
    const [card] = resolveCards(note(text), sys, collectDiagnostics());
    expect(card?.props["category"]).toBe("from-frontmatter");
    expect(card?.props["grip"]).toBe("from-data");
    expect(card?.props["body"]).toBe("From the body.");
    expect(card?.props["stat-1a"]).toBe("from-data"); // through the slot binding
    expect(card?.props["name"]).toBe("Beil"); // the filename fallback
    expect(card?.props["logo-image"]).toBe("assets/logo.png"); // the default
  });

  it("make one card per table row, each row over the shared layers", async () => {
    const sys = await system();
    const text = [
      "---",
      "category: shared",
      "---",
      "| Griff | Name |",
      "|---|---|",
      "| 1H | Beil |",
      "| | Dolch |",
      block(
        "  system: demo\n  card-type: gear",
        "table:\n  grip: Griff\n  name: Name\ndata:\n  grip: from-data\n"
      ),
    ].join("\n");
    const cards = resolveCards(note(text), sys, collectDiagnostics());
    expect(
      cards.map((c) => [c.props["name"], c.props["grip"], c.props["category"]])
    ).toEqual([
      ["Beil", "1H", "shared"],
      ["Dolch", "from-data", "shared"],
    ]);
  });
});

describe("the roll range", () => {
  const rollNote = (data: string, card = "") =>
    note(block(`  system: demo\n  card-type: gear${card}`, `data:\n${data}\n`));

  it("is read as an integer roll-min for the deck to sort by, aliases included", async () => {
    const sys = await system();
    const [numeric] = resolveCards(
      rollNote("  roll-min: 7\n  roll-max: 7"),
      sys,
      collectDiagnostics()
    );
    expect(numeric?.rollMin).toBe(7);
    const [aliased] = resolveCards(
      rollNote("  wurf-von: '03'\n  wurf-bis: '03'"),
      sys,
      collectDiagnostics()
    );
    expect(aliased?.rollMin).toBe(3);
  });

  it("is no range when a bound is missing, not an integer, or the bounds are reversed", async () => {
    const sys = await system();
    for (const data of [
      "  roll-min: 3",
      "  roll-min: 2.5\n  roll-max: 4",
      "  roll-min: 9\n  roll-max: 3",
    ]) {
      const cards = resolveCards(
        rollNote(data, "\n  expand-by-roll: true"),
        sys,
        collectDiagnostics()
      );
      expect(cards).toHaveLength(1);
      expect(cards[0]?.rollMin).toBeUndefined();
    }
  });

  it("yields one card per value when the card expands by roll, the padding of the source kept", async () => {
    const sys = await system();
    const cards = resolveCards(
      rollNote(
        "  roll: 03–05\n  roll-min: 3\n  roll-max: 5\n  grip: shared",
        "\n  expand-by-roll: true"
      ),
      sys,
      collectDiagnostics()
    );
    expect(
      cards.map((c) => [
        c.props["roll"],
        c.props["roll-min"],
        c.props["roll-max"],
        c.rollMin,
      ])
    ).toEqual([
      ["03", 3, 3, 3],
      ["04", 4, 4, 4],
      ["05", 5, 5, 5],
    ]);
    expect(cards.map((c) => c.props["grip"])).toEqual(["shared", "shared", "shared"]);
    // `9–10` is not padded: the longest run would invent a zero the table never printed.
    const [nine] = resolveCards(
      rollNote("  roll: 9–10\n  roll-min: 9\n  roll-max: 10", "\n  expand-by-roll: true"),
      sys,
      collectDiagnostics()
    );
    expect(nine?.props["roll"]).toBe("9");
  });

  it("leaves a single value and a card that does not expand as one card", async () => {
    const sys = await system();
    const [single] = resolveCards(
      rollNote("  roll-min: 4\n  roll-max: 4", "\n  expand-by-roll: true"),
      sys,
      collectDiagnostics()
    );
    expect(single?.rollMin).toBe(4);
    const unexpanded = resolveCards(
      rollNote("  roll-min: 1\n  roll-max: 6"),
      sys,
      collectDiagnostics()
    );
    expect(unexpanded).toHaveLength(1);
    expect(unexpanded[0]?.rollMin).toBe(1);
  });

  it("expands a card of a kind that says so, through the card type's own setting", async () => {
    // Dragonbane's roll-table declares `expand-by-roll: true`; a note of that
    // type says nothing and still prints one card per result.
    const sys = await loadedSystem("dragonbane");
    const cards = resolveCards(
      note(
        block(
          "  system: dragonbane\n  card-type: roll-table",
          "data:\n  würfelwurf: 11–12\n  wurf-min: 11\n  wurf-max: 12\n"
        )
      ),
      sys,
      collectDiagnostics()
    );
    expect(cards.map((c) => c.props["roll"])).toEqual(["11", "12"]);
  });
});
