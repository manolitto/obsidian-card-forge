import { dump } from "js-yaml";
import type { Editor } from "obsidian";
import type { SampleTable } from "../definitions/game-system";
import {
  propertyDescription,
  propertySample,
  type PropertyDef,
} from "../definitions/property-defs";
import type { LoadedCardType, LoadedSystem } from "../systems/loader";
import { t } from "./strings";

/*
 * The `cardsmith` block the insert commands write: `card:` naming the
 * system and the card type, `data:` with every property the card type
 * puts on the card — its description as a comment above, its sample as
 * the value or nothing. Pure; the goldens under `tests/fixtures/` hold it
 * per card type and mode.
 */

export type InsertMode = "empty" | "sample";

/**
 * The block for one card type. Only a property bound to a slot is written:
 * one that reaches no place on the card has nothing to show for a value.
 * Canonical keys only, never an alias; descriptions and samples in
 * `language`, falling back to the first the system documents. A card type
 * that declares a sample table gets a table note instead: the table, then
 * the block with the columns under `table:` and the shared values under
 * `data:`.
 */
export function buildCardBlock(
  system: LoadedSystem,
  cardType: LoadedCardType,
  language: string,
  mode: InsertMode
): string {
  const table = sampleTableFor(system, cardType, language);
  const columns = new Set(Object.keys(table?.columns ?? {}));
  const lines: string[] = [];
  if (table) lines.push(...markdownTable(table, mode), "");

  lines.push(
    "```cardsmith",
    "card:",
    `  system: ${system.id}`,
    `  card-type: ${cardType.declaration.id}`
  );

  const bound = Object.entries(cardType.properties).filter(
    ([, def]) => (def.slot?.length ?? 0) > 0
  );
  if (table) {
    lines.push("table:");
    for (const [index, [key, header]] of Object.entries(table.columns).entries()) {
      if (index > 0) lines.push("");
      lines.push(...describe(cardType.properties[key], language));
      lines.push(...yamlLines(key, header));
    }
  }

  lines.push("data:");
  const shared = bound.filter(([key]) => !columns.has(key));
  if (shared.length === 0) {
    lines.push(`  # ${t("insert.no-properties")}`);
  }
  for (const [index, [key, def]] of shared.entries()) {
    if (index > 0) lines.push("");
    lines.push(...describe(def, language));
    if (mode === "empty") {
      lines.push(`  ${key}:`);
      continue;
    }
    // A property with a default and no sample is answered already; the
    // default written out is the truer example.
    const sample = propertySample(def, language) ?? def.default;
    if (sample === undefined) lines.push(`  ${key}: # ${t("insert.no-sample")}`);
    else lines.push(...yamlLines(key, sample));
  }

  lines.push("```", "");
  return lines.join("\n");
}

/** The property's description as comment lines, in `language`. */
function describe(def: PropertyDef | undefined, language: string): string[] {
  const description = propertyDescription(def, language);
  if (!description) return [];
  return description.split(/\r?\n/).map((line) => `  # ${line}`);
}

/** The card type's sample table in `language`, else in the first the system documents, else none. */
function sampleTableFor(
  system: LoadedSystem,
  cardType: LoadedCardType,
  language: string
): SampleTable | undefined {
  const tables = cardType.declaration.sampleTable;
  if (!tables) return undefined;
  return (
    tables[language] ??
    tables[system.declaration.languages[0] ?? ""] ??
    Object.values(tables)[0]
  );
}

/**
 * The Markdown table: the headers in column order, a list column's
 * headers side by side, the rows beneath — or one blank row when the
 * block is to be empty. Cells are padded to the column so the source
 * reads as a table too; a `|` in a cell is escaped, as Markdown wants.
 */
function markdownTable(table: SampleTable, mode: InsertMode): string[] {
  const headers = Object.values(table.columns).flat();
  const rows =
    mode === "empty"
      ? [headers.map(() => "")]
      : table.rows.map((row) => headers.map((header) => row[header] ?? ""));
  const cell = (text: string) => text.replace(/\|/g, "\\|");
  const widths = headers.map((header, i) =>
    Math.max(cell(header).length, 3, ...rows.map((row) => cell(row[i] ?? "").length))
  );
  const line = (cells: string[]) =>
    `| ${cells.map((c, i) => cell(c).padEnd(widths[i] ?? 0)).join(" | ")} |`;
  return [
    line(headers),
    `| ${widths.map((w) => "-".repeat(w)).join(" | ")} |`,
    ...rows.map(line),
  ];
}

/**
 * `key: value` as YAML under `data:`, through js-yaml so a list, a map or
 * a string with line breaks comes out in a form the note loader reads
 * back as written.
 */
function yamlLines(key: string, value: unknown): string[] {
  const text = dump({ [key]: value }, { indent: 2, lineWidth: -1, noRefs: true });
  return text
    .trimEnd()
    .split("\n")
    .map((line) => `  ${line}`);
}

/** Put `text` at the cursor and leave the cursor after it. */
export function insertAtCursor(editor: Editor, text: string): void {
  const from = editor.getCursor();
  editor.replaceRange(text, from);
  const lines = text.split("\n");
  const last = lines[lines.length - 1] ?? "";
  editor.setCursor({
    line: from.line + lines.length - 1,
    ch: lines.length === 1 ? from.ch + last.length : last.length,
  });
}
