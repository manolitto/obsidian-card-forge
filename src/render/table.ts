import type { Diagnostics } from "../definitions/diagnostics";
import type { CardNote, TableColumns } from "./note";
import { loadNoteYaml } from "./yaml";

/**
 * Cards from a table.
 *
 * A note whose block carries a `table:` mapping is not one card but one per
 * row of the markdown table in its text. The mapping says which column fills
 * which property — the headers are the author's own words, and nothing is
 * derived from them:
 *
 * ```yaml
 * table:
 *   roll: Würfelwurf                     # this column's cell is `roll`
 *   name: Name
 *   stats: [Voraussetzungen, Rationen]   # → [{ name: "Voraussetzungen", desc: … }, …]
 * ```
 *
 * The list form folds several columns into one list of `{ name, desc }`
 * items, the header as written in the table being each item's name — the
 * shape a `{{slot "x" list=true}}` serves — so a table spells its values out
 * as ordinary columns rather than burying YAML in a cell.
 *
 * A blank cell sets nothing, so the note's frontmatter, the block's shared
 * `data:` and the filename fallback still answer for it.
 */

/** One props object per data row, in table order; `[]` when there is no table. */
export function tableRows(
  note: CardNote,
  columns: TableColumns,
  diagnostics: Diagnostics
): Record<string, unknown>[] {
  const tables = parseTables(note.text);
  const table = tables[0];
  if (!table) {
    diagnostics.warn(
      `${note.path}: the block maps table columns, but the note has no table`
    );
    return [];
  }
  if (tables.length > 1) {
    diagnostics.warn(
      `${note.path}: ${tables.length} tables; reading the first and ignoring the rest`
    );
  }

  const headers = table.headers.map((h) => h.toLowerCase());
  const columnIndex = (header: string, property: string): number => {
    const index = headers.indexOf(header.toLowerCase());
    if (index < 0) {
      diagnostics.warn(
        `${note.path}: table.${property} names the column "${header}", which the table does not have`
      );
    }
    return index;
  };

  // Resolve the map against the header row once, not once per row.
  const bindings: Binding[] = [];
  for (const [property, column] of Object.entries(columns)) {
    if (Array.isArray(column)) {
      const members = column
        .map((header) => ({ index: columnIndex(header, property), header }))
        .filter((m) => m.index >= 0)
        .map((m) => ({ index: m.index, name: table.headers[m.index] as string }));
      if (members.length > 0) bindings.push({ property, members });
    } else {
      const index = columnIndex(column, property);
      if (index >= 0) bindings.push({ property, index });
    }
  }

  return table.rows.map((cells) => {
    const props: Record<string, unknown> = {};
    for (const binding of bindings) {
      if ("index" in binding) {
        const cell = cells[binding.index]?.trim() ?? "";
        if (cell) props[binding.property] = cellValue(cell);
        continue;
      }
      const items: { name: string; desc: unknown }[] = [];
      for (const member of binding.members) {
        const cell = cells[member.index]?.trim() ?? "";
        if (cell) items.push({ name: member.name, desc: cellValue(cell) });
      }
      if (items.length > 0) props[binding.property] = items;
    }
    return props;
  });
}

type Binding =
  | { property: string; index: number }
  | { property: string; members: { index: number; name: string }[] };

// ── The markdown table ─────────────────────────────────────────────

interface ParsedTable {
  headers: string[];
  rows: string[][];
}

/**
 * Every GFM table in a text: a header line with a pipe, a delimiter line
 * under it, then rows until a line without a pipe. The text has already
 * lost its frontmatter and code blocks, so a pipe there cannot start one.
 */
export function parseTables(text: string): ParsedTable[] {
  const lines = text.split("\n");
  const out: ParsedTable[] = [];
  let i = 0;
  while (i < lines.length - 1) {
    const header = lines[i] as string;
    if (
      header.includes("|") &&
      header.trim() !== "" &&
      isDelimiterRow(lines[i + 1] as string)
    ) {
      const rows: string[][] = [];
      let j = i + 2;
      while (
        j < lines.length &&
        (lines[j] as string).includes("|") &&
        (lines[j] as string).trim() !== ""
      ) {
        rows.push(splitRow(lines[j] as string));
        j++;
      }
      out.push({ headers: splitRow(header), rows });
      i = j;
    } else {
      i++;
    }
  }
  return out;
}

/** `| --- | :--: | ---: |` */
function isDelimiterRow(line: string): boolean {
  if (!line.includes("-")) return false;
  const cells = splitRow(line);
  return cells.length > 0 && cells.every((c) => /^:?-+:?$/.test(c));
}

/** The trimmed cells of a row; one optional outer pipe each side; `\|` is a literal pipe. */
function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1);
  const cells: string[] = [];
  let current = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "\\" && s[i + 1] === "|") {
      current += "|";
      i++;
    } else if (ch === "|") {
      cells.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells.map((c) => c.trim());
}

// ── Cells ──────────────────────────────────────────────────────────

/**
 * A cell as a value. Read through the note's YAML loader so `15` is a number
 * and `[a, b]` a list, and a wikilink survives — but conservatively, since a
 * cell is display text first: a number only when it prints back as written
 * (`01` and `1-3` stay text), a boolean only for the literal words, and a
 * collection only from explicit flow syntax — a `- ` bullet or a `word: rest`
 * in prose would otherwise become a list or a mapping.
 */
export function cellValue(cell: string): unknown {
  let value: unknown;
  try {
    value = loadNoteYaml(cell);
  } catch {
    return cell;
  }
  if (value === null || value === undefined) return cell;
  if (typeof value === "number") return String(value) === cell ? value : cell;
  if (typeof value === "boolean")
    return cell === "true" || cell === "false" ? value : cell;
  if (typeof value === "object") {
    if (!(cell.startsWith("[") || cell.startsWith("{"))) return cell;
    return value;
  }
  return value;
}
