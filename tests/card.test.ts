import { describe, expect, it } from "vitest";
import {
  collectDiagnostics,
  type CollectedDiagnostics,
} from "../src/definitions/diagnostics";
import { noteSystemId, resolveCards } from "../src/render/card";
import { parseNote } from "../src/render/note";
import { loadSystem, type LoadedSystem } from "../src/systems/loader";
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
  `\`\`\`card-forge\ncard:\n${card}\n${rest}\`\`\``;

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
      diagnostics.matching("Karten/Beil.md: the card-forge block names no system:")
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
