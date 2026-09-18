import type { Diagnostics } from "../definitions/diagnostics";
import { stripTags, wikilinkDisplayText } from "../templates/inline-markdown";
import { loadNoteYaml } from "./yaml";

/**
 * A card note, taken apart.
 *
 * A note is a card note iff it carries a `cardsmith` block. The block says
 * which system and card type render it and may carry values (`data:`) and a
 * column map (`table:`); the note's frontmatter carries values too, on equal
 * standing; and the note's own text is values as well — what stands before
 * the first `##` heading is the property `body`, and every `##` heading is a
 * property named after it. Which of several sources wins a key is the card
 * resolver's fold (`card.ts`); this module only reads them out.
 *
 * Nothing here is Obsidian's. The frontmatter is parsed here rather than
 * read from the metadata cache, through the same loader as the block, which
 * is what lets a note render outside Obsidian at all — in a test, from a
 * file — and keeps one answer to what a wikilink in YAML looks like.
 */
export interface CardNote {
  /** The vault path, for messages and for resolving links relative to the note. */
  path: string;
  /** The basename without `.md` — what `name` falls back to. */
  name: string;
  /** The block's `card:` mapping — `system`, `card-type`, and the note's card settings. */
  card: Record<string, unknown>;
  /** The block's `data:` mapping, or `{}`. */
  data: Record<string, unknown>;
  /** The block's `table:` mapping, when the note is a table of cards. */
  table?: TableColumns;
  frontmatter: Record<string, unknown>;
  /** Heading in kebab-case → the raw markdown under it; `body` for the intro. */
  sections: Record<string, string>;
  /** The note without its frontmatter and its code blocks — what the table scan reads. */
  text: string;
}

/**
 * `table:` — property → the column header that fills it, or a list of
 * headers folded into one `{ name, desc }` list. See `table.ts`.
 */
export type TableColumns = Record<string, string | string[]>;

/** The block, line-anchored, whitespace-tolerant after the fence. */
const CARD_FORGE_BLOCK =
  /^```[^\S\r\n]*cardsmith[^\S\r\n]*\r?\n([\s\S]*?)^```[^\S\r\n]*$/gm;

/** A fenced code block of either kind, for taking out of the text. */
const FENCED_CODE = /^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1[^\S\r\n]*$/gm;

/**
 * Take a note apart. `undefined` when the note has no `cardsmith` block —
 * with nothing reported, since a note that is not a card is not a problem.
 * A block whose YAML does not parse is reported, naming the note, and the
 * note is not a card either.
 */
export function parseNote(
  text: string,
  path: string,
  diagnostics: Diagnostics
): CardNote | undefined {
  const source = text.replace(/\r\n?/g, "\n");
  const { frontmatter: frontmatterText, rest } = splitFrontmatter(source);

  const blocks = [...rest.matchAll(CARD_FORGE_BLOCK)];
  const first = blocks[0];
  if (!first) return undefined;
  if (blocks.length > 1) {
    diagnostics.warn(
      `${path}: ${blocks.length} cardsmith blocks; reading the first and ignoring the rest`
    );
  }

  const block = parseBlock(first[1] ?? "", path, diagnostics);
  if (!block) return undefined;

  const stripped = rest.replace(FENCED_CODE, "");
  return {
    path,
    name: basename(path),
    ...block,
    frontmatter: parseFrontmatter(frontmatterText, path, diagnostics),
    sections: extractSections(stripped, path, diagnostics),
    text: stripped,
  };
}

// ── The block ──────────────────────────────────────────────────────

const BLOCK_KEYS: readonly string[] = ["card", "data", "table"];

function parseBlock(
  yaml: string,
  path: string,
  diagnostics: Diagnostics
): Pick<CardNote, "card" | "data" | "table"> | undefined {
  let doc: unknown;
  try {
    doc = loadNoteYaml(yaml);
  } catch (error) {
    diagnostics.warn(
      `${path}: the cardsmith block is not valid YAML: ${describe(error)}`
    );
    return undefined;
  }
  if (doc === null) return { card: {}, data: {} };
  if (!isMapping(doc)) {
    diagnostics.warn(
      `${path}: the cardsmith block must be a mapping with card: and data:`
    );
    return undefined;
  }
  for (const key of Object.keys(doc)) {
    if (!BLOCK_KEYS.includes(key)) {
      diagnostics.warn(
        `${path}: "${key}:" in the cardsmith block is not one of ${BLOCK_KEYS.join(", ")}; ignoring it`
      );
    }
  }
  const out: Pick<CardNote, "card" | "data" | "table"> = {
    card: mappingOrEmpty(doc["card"], `${path}: card:`, diagnostics),
    data: mappingOrEmpty(doc["data"], `${path}: data:`, diagnostics),
  };
  if (doc["table"] !== undefined && doc["table"] !== null) {
    const table = parseTableColumns(doc["table"], path, diagnostics);
    if (table) out.table = table;
  }
  return out;
}

function parseTableColumns(
  raw: unknown,
  path: string,
  diagnostics: Diagnostics
): TableColumns | undefined {
  if (!isMapping(raw)) {
    diagnostics.warn(
      `${path}: table: must be a mapping of property: column; ignoring it`
    );
    return undefined;
  }
  const out: TableColumns = {};
  for (const [rawKey, rawColumn] of Object.entries(raw)) {
    const key = rawKey.trim().toLowerCase();
    if (!key) continue;
    if (Array.isArray(rawColumn)) {
      const columns = rawColumn
        .filter((c) => typeof c === "string" || typeof c === "number")
        .map((c) => String(c).trim())
        .filter((c) => c !== "");
      if (columns.length > 0) out[key] = columns;
      else diagnostics.warn(`${path}: table.${key} names no column; ignoring it`);
      continue;
    }
    if (typeof rawColumn !== "string" && typeof rawColumn !== "number") {
      diagnostics.warn(
        `${path}: table.${key} must be a column header or a list of them; ignoring it`
      );
      continue;
    }
    const column = String(rawColumn).trim();
    if (column) out[key] = column;
    else diagnostics.warn(`${path}: table.${key} names no column; ignoring it`);
  }
  if (Object.keys(out).length === 0) {
    diagnostics.warn(`${path}: table: maps no property to a column; ignoring it`);
    return undefined;
  }
  return out;
}

// ── Frontmatter ────────────────────────────────────────────────────

/**
 * A frontmatter block opens on the very first line and closes on a `---`
 * (or `...`) line of its own; an unterminated one is not frontmatter.
 */
function splitFrontmatter(source: string): { frontmatter: string; rest: string } {
  const lines = source.split("\n");
  if (lines[0]?.trim() !== "---") return { frontmatter: "", rest: source };
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]?.trim();
    if (line === "---" || line === "...") {
      return {
        frontmatter: lines.slice(1, i).join("\n"),
        rest: lines.slice(i + 1).join("\n"),
      };
    }
  }
  return { frontmatter: "", rest: source };
}

function parseFrontmatter(
  yaml: string,
  path: string,
  diagnostics: Diagnostics
): Record<string, unknown> {
  if (!yaml.trim()) return {};
  let doc: unknown;
  try {
    doc = loadNoteYaml(yaml);
  } catch (error) {
    diagnostics.warn(`${path}: the frontmatter is not valid YAML: ${describe(error)}`);
    return {};
  }
  return mappingOrEmpty(doc, `${path}: the frontmatter`, diagnostics);
}

// ── Sections ───────────────────────────────────────────────────────

/** A `##` heading on a line of its own; deeper headings stay inside their section. */
const SECTION_HEADING = /^##[ \t]+(.+?)[ \t]*$/m;

/**
 * The note's text as properties: the intro as `body`, each `##` heading as
 * the key it kebab-cases to. Values are raw markdown, trimmed, with inline
 * `#tags` dropped — vault metadata, not card text. An empty value sets
 * nothing, so a tag line above the block is not a body.
 */
function extractSections(
  text: string,
  path: string,
  diagnostics: Diagnostics
): Record<string, string> {
  const out: Record<string, string> = {};
  const parts = text.split(SECTION_HEADING);
  const set = (key: string, value: string): void => {
    const cleaned = stripTags(value).trim();
    if (cleaned) out[key] = cleaned;
  };
  set("body", parts[0] ?? "");
  for (let i = 1; i < parts.length; i += 2) {
    const heading = parts[i] ?? "";
    const key = sectionKey(heading);
    if (!key) {
      diagnostics.warn(
        `${path}: the heading "## ${heading}" yields no property name; ignoring its section`
      );
      continue;
    }
    set(key, parts[i + 1] ?? "");
  }
  return out;
}

/**
 * `## Front Side` → `front-side`, `## **Vorderseite** #card` → `vorderseite`:
 * markdown, links, tags and trailing `#`s stripped, then lowercased with
 * every run of anything that is not a letter or a digit as one hyphen.
 */
export function sectionKey(heading: string): string {
  const plain = wikilinkDisplayText(heading)
    .replace(/[ \t]+#+[ \t]*$/, "")
    .replace(/[*_`~]/g, "");
  return plain
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

// ── Helpers ────────────────────────────────────────────────────────

function mappingOrEmpty(
  raw: unknown,
  what: string,
  diagnostics: Diagnostics
): Record<string, unknown> {
  if (raw === null || raw === undefined) return {};
  if (!isMapping(raw)) {
    diagnostics.warn(`${what} must be a mapping; ignoring it`);
    return {};
  }
  return raw;
}

function isMapping(raw: unknown): raw is Record<string, unknown> {
  return typeof raw === "object" && raw !== null && !Array.isArray(raw);
}

function basename(path: string): string {
  const name = path.slice(path.lastIndexOf("/") + 1);
  return name.toLowerCase().endsWith(".md") ? name.slice(0, -3) : name;
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
