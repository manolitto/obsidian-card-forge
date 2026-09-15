import { describe, expect, it } from "vitest";
import { collectDiagnostics } from "../src/definitions/diagnostics";
import { parseNote, type TableColumns } from "../src/render/note";
import { cellValue, parseTables, tableRows } from "../src/render/table";

const TABLE = `
| Würfelwurf | Name | Voraussetzungen | Rationen | Effekt |
|---|---|---|---|---|
| 1 | Rotwild | Bogen | 2W6 | |
| 2 | Hase | | 1 | Flink. |
| 3–4 | | Falle | | Frisst [[Beeren]] |
`;

const COLUMNS: TableColumns = {
  roll: "Würfelwurf",
  name: "Name",
  stats: ["Voraussetzungen", "Rationen"],
  effect: "Effekt",
};

function rows(text: string, columns = COLUMNS, diagnostics = collectDiagnostics()) {
  const note = parseNote(
    `${text}\n\`\`\`card-forge\ncard: { system: x }\n\`\`\`\n`,
    "T.md",
    diagnostics
  );
  return tableRows(note!, columns, diagnostics);
}

describe("tableRows", () => {
  it("maps columns to properties strictly — the map alone decides, blank cells set nothing", () => {
    expect(rows(TABLE)).toEqual([
      {
        roll: 1,
        name: "Rotwild",
        stats: [
          { name: "Voraussetzungen", desc: "Bogen" },
          { name: "Rationen", desc: "2W6" },
        ],
      },
      { roll: 2, name: "Hase", stats: [{ name: "Rationen", desc: 1 }], effect: "Flink." },
      {
        roll: "3–4",
        stats: [{ name: "Voraussetzungen", desc: "Falle" }],
        effect: "Frisst [[Beeren]]",
      },
    ]);
  });

  it("matches headers case-insensitively but names an item after the header as written", () => {
    expect(rows(TABLE, { stats: ["rationen"] })[0]).toEqual({
      stats: [{ name: "Rationen", desc: "2W6" }],
    });
  });

  it("reports a mapped column the table does not have, once per note", () => {
    const diagnostics = collectDiagnostics();
    const out = rows(TABLE, { roll: "Würfelwurf", weight: "Gewicht" }, diagnostics);
    expect(out).toHaveLength(3);
    expect(out[0]).toEqual({ roll: 1 });
    expect(diagnostics.matching('table.weight names the column "Gewicht"')).toHaveLength(
      1
    );
  });

  it("reads the first of two tables and reports the second", () => {
    const diagnostics = collectDiagnostics();
    const out = rows(`${TABLE}\n\n| Name |\n|---|\n| Other |\n`, COLUMNS, diagnostics);
    expect(out[0]?.["name"]).toBe("Rotwild");
    expect(diagnostics.matching("2 tables")).toHaveLength(1);
  });

  it("reports a note with a table: map and no table", () => {
    const diagnostics = collectDiagnostics();
    expect(rows("No table here.", COLUMNS, diagnostics)).toEqual([]);
    expect(diagnostics.matching("has no table")).toHaveLength(1);
  });

  it("is not fooled by a frontmatter pipe or a pipe in a code block", () => {
    const diagnostics = collectDiagnostics();
    const note = parseNote(
      `---\nBuch: "[[R.pdf#page=1|p. 1]]"\n---\n\`\`\`\n| a |\n|---|\n\`\`\`\n${TABLE}\n\`\`\`card-forge\ncard: { system: x }\n\`\`\``,
      "T.md",
      diagnostics
    );
    expect(tableRows(note!, { name: "Name" }, diagnostics)).toHaveLength(3);
    expect(diagnostics.messages).toEqual([]);
  });
});

describe("parseTables", () => {
  it("parses with and without outer pipes, and honours an escaped pipe", () => {
    expect(parseTables("a | b\n--|--\n1 | 2\\|3\n")).toEqual([
      { headers: ["a", "b"], rows: [["1", "2|3"]] },
    ]);
  });

  it("needs a delimiter row", () => {
    expect(parseTables("a | b\n1 | 2\n")).toEqual([]);
  });
});

describe("cellValue", () => {
  it("keeps prose, and a number that would not print back as written", () => {
    expect(cellValue("Rotwild")).toBe("Rotwild");
    expect(cellValue("01")).toBe("01");
    expect(cellValue("1-3")).toBe("1-3");
    expect(cellValue("15")).toBe(15);
  });

  it("takes only the literal true/false as booleans", () => {
    expect(cellValue("true")).toBe(true);
    expect(cellValue("yes")).toBe("yes");
    expect(cellValue("No")).toBe("No");
  });

  it("takes a flow collection and keeps block syntax that emerged from prose", () => {
    expect(cellValue("[a, b]")).toEqual(["a", "b"]);
    expect(cellValue("- not a list")).toBe("- not a list");
    expect(cellValue("Note: not a map")).toBe("Note: not a map");
  });

  it("keeps a wikilink and a date-like value as text", () => {
    expect(cellValue("[[Bild.png]]")).toBe("[[Bild.png]]");
    expect(cellValue("2024-01-01")).toBe("2024-01-01");
  });
});
