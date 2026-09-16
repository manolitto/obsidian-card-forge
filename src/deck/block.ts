import {
  isCardSettingKey,
  parseCardSettings,
  type CardSettings,
} from "../definitions/card-settings";
import {
  isDeckSettingKey,
  mergeDeckSettings,
  parseDeckSettings,
  type DeckSettings,
} from "../definitions/deck-settings";
import { prefixDiagnostics, type Diagnostics } from "../definitions/diagnostics";
import { loadNoteYaml } from "../render/yaml";
import { BASELINE } from "../systems/baseline";

/**
 * The `card-forge-deck` block, taken apart.
 *
 * A deck note is a note with such a block. The block says which notes are
 * the deck — a folder, a system, card types, tags, languages — and how the
 * deck is printed. Its keys fall into three groups, told apart by name:
 *
 *   - the **selection** keys, read here into `DeckSelection`;
 *   - the **deck settings** — `paper-size`, `cut-marks`, `folder-recursive`,
 *     `card-copies`, … — the deck's layer of the deck-setting chain, folded
 *     onto the baseline here, since nothing sits between the two;
 *   - the **card settings** — `card-size`, `language`, `overflow-mode`,
 *     `copies`, … — one layer for every card the deck holds, handed to the
 *     card chain as it is, since the card type and the note fold around it.
 *
 * A key in none of the three is reported by name and ignored.
 *
 * ```yaml
 * system: dragonbane
 * card-type: [gear, creature]      # also the order the cards are grouped in
 * folder: Karten/Ausrüstung        # default: the deck note's own folder
 * include-tags-all: [#Waffe]
 * card-languages: de
 * output-path: Export/Waffen.pdf
 * paper-size: A4 landscape         # a deck setting
 * card-size: poker                 # a card setting, for every card
 * ```
 */
export interface DeckBlock {
  selection: DeckSelection;
  /** Baseline → deck. */
  settings: DeckSettings;
  /** The deck's layer of the card-setting chain, unfolded. */
  cardLayer: CardSettings;
  /** Where the exports go, absent an `output-path:` beside the deck note. */
  outputPath: { pdf: string; html: string };
}

/** Which notes are the deck. Every list is empty when the block does not filter by it. */
export interface DeckSelection {
  /** Vault folder whose card notes are the candidates; `""` is the vault root. */
  folder: string;
  systemId: string;
  /** In the order written — the cards group in this order. Empty: every card type. */
  cardTypeIds: string[];
  /** A card must carry every one of these tags. */
  includeTagsAll: string[];
  /** A card must carry at least one of these. */
  includeTagsAny: string[];
  /** A card carrying any one of these is dropped. */
  excludeTagsAny: string[];
  /** A card carrying every one of these is dropped. */
  excludeTagsAll: string[];
  /** Language codes, lowercased; a card prints in one of them or is dropped. */
  languages: string[];
}

const TAG_KEYS = [
  "include-tags-all",
  "include-tags-any",
  "exclude-tags-any",
  "exclude-tags-all",
] as const;

const SELECTION_KEYS: readonly string[] = [
  "folder",
  "system",
  "card-type",
  ...TAG_KEYS,
  "card-languages",
  "output-path",
];

/** The block, line-anchored, whitespace-tolerant after the fence. */
const DECK_BLOCK =
  /^```[^\S\r\n]*card-forge-deck[^\S\r\n]*\r?\n([\s\S]*?)^```[^\S\r\n]*$/gm;

/**
 * Take a deck note apart. `undefined` when the note has no deck block — with
 * nothing reported, since most notes are not decks — and, reported, when
 * the block cannot be read or names no system.
 */
export function parseDeckBlock(
  text: string,
  path: string,
  diagnostics: Diagnostics
): DeckBlock | undefined {
  const source = text.replace(/\r\n?/g, "\n");
  const blocks = [...source.matchAll(DECK_BLOCK)];
  const first = blocks[0];
  if (!first) return undefined;
  if (blocks.length > 1) {
    diagnostics.warn(
      `${path}: ${blocks.length} card-forge-deck blocks; reading the first and ignoring the rest`
    );
  }

  let doc: unknown;
  try {
    doc = loadNoteYaml(quoteTagValues(first[1] ?? ""));
  } catch (error) {
    diagnostics.warn(
      `${path}: the card-forge-deck block is not valid YAML: ${describe(error)}`
    );
    return undefined;
  }
  if (doc === null) doc = {};
  if (!isMapping(doc)) {
    diagnostics.warn(`${path}: the card-forge-deck block must be a mapping`);
    return undefined;
  }

  const selectionRaw: Record<string, unknown> = {};
  const deckRaw: Record<string, unknown> = {};
  const cardRaw: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(doc)) {
    if (SELECTION_KEYS.includes(key)) selectionRaw[key] = value;
    else if (isDeckSettingKey(key)) deckRaw[key] = value;
    else if (isCardSettingKey(key)) cardRaw[key] = value;
    else {
      diagnostics.warn(
        `${path}: "${key}:" is not a key of the card-forge-deck block; ignoring it`
      );
    }
  }

  const systemId = String(selectionRaw["system"] ?? "")
    .trim()
    .toLowerCase();
  if (!systemId) {
    diagnostics.warn(`${path}: the card-forge-deck block names no system:`);
    return undefined;
  }

  const where = prefixDiagnostics(diagnostics, `${path}: `);
  const selection: DeckSelection = {
    folder: folderOf(selectionRaw["folder"], path),
    systemId,
    cardTypeIds: stringList(selectionRaw["card-type"], "card-type", where).map((id) =>
      id.toLowerCase()
    ),
    includeTagsAll: tagList(selectionRaw["include-tags-all"], "include-tags-all", where),
    includeTagsAny: tagList(selectionRaw["include-tags-any"], "include-tags-any", where),
    excludeTagsAny: tagList(selectionRaw["exclude-tags-any"], "exclude-tags-any", where),
    excludeTagsAll: tagList(selectionRaw["exclude-tags-all"], "exclude-tags-all", where),
    languages: stringList(selectionRaw["card-languages"], "card-languages", where).map(
      (code) => code.toLowerCase()
    ),
  };

  return {
    selection,
    settings: mergeDeckSettings([
      BASELINE.deckSettings,
      parseDeckSettings(deckRaw, where),
    ]),
    cardLayer: parseCardSettings(cardRaw, where),
    outputPath: outputPaths(selectionRaw["output-path"], path, where),
  };
}

// ── The values ─────────────────────────────────────────────────────

/** The block's folder, trailing slashes off; the deck note's own folder when it names none. */
function folderOf(raw: unknown, deckPath: string): string {
  const named = typeof raw === "string" ? raw.trim() : "";
  return named ? named.replace(/\/+$/, "") : parentFolder(deckPath);
}

/**
 * Both exports beside each other: the block's path with its extension
 * swapped, or `<deck folder>/<deck note>` with each one appended.
 */
function outputPaths(
  raw: unknown,
  deckPath: string,
  diagnostics: Diagnostics
): DeckBlock["outputPath"] {
  let stem: string | undefined;
  if (raw !== undefined && raw !== null) {
    const named = typeof raw === "string" ? raw.trim() : "";
    if (named) stem = named.replace(/\.(pdf|html?)$/i, "");
    else diagnostics.warn(`output-path: must be a path; ignoring it`);
  }
  if (stem === undefined) {
    const folder = parentFolder(deckPath);
    const name = basename(deckPath);
    stem = folder ? `${folder}/${name}` : name;
  }
  return { pdf: `${stem}.pdf`, html: `${stem}.html` };
}

/** A scalar or a list of scalars as trimmed strings; anything else in it is reported. */
function stringList(raw: unknown, key: string, diagnostics: Diagnostics): string[] {
  if (raw === undefined || raw === null) return [];
  const items = Array.isArray(raw) ? raw : [raw];
  const out: string[] = [];
  for (const item of items) {
    if (typeof item !== "string" && typeof item !== "number") {
      diagnostics.warn(`${key}: ${JSON.stringify(item)} is not a name; ignoring it`);
      continue;
    }
    const value = String(item).trim();
    if (value) out.push(value);
  }
  return out;
}

/** Tags as the vault knows them: without the `#`, lowercased. */
function tagList(raw: unknown, key: string, diagnostics: Diagnostics): string[] {
  return stringList(raw, key, diagnostics)
    .map((tag) => tag.replace(/^#/, "").toLowerCase())
    .filter((tag) => tag !== "");
}

// ── The `#tag` pre-pass ────────────────────────────────────────────

const TAG_KEY = `(?:${TAG_KEYS.join("|")})`;
const TAG_BLOCK_OPEN = new RegExp(`^(\\s*)${TAG_KEY}\\s*:\\s*$`);
const TAG_INLINE = new RegExp(`^(\\s*${TAG_KEY}\\s*:\\s*)(.+?)(\\s*)$`);

/**
 * Authors write tags the way Obsidian shows them, `- #Waffe`, and to YAML
 * a bare `#` starts a comment: the item would read as nothing. So before
 * the parse, every `#tag` that is the value of one of the four tag keys —
 * an item of its block sequence, its scalar, an item of its flow sequence —
 * is quoted. Nothing else in the block is touched, so a comment stays one.
 */
export function quoteTagValues(source: string): string {
  const lines = source.split("\n");
  let blockIndent: number | undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";

    if (blockIndent !== undefined) {
      if (line.trim() === "") continue;
      const indent = /^\s*/.exec(line)?.[0].length ?? 0;
      if (indent > blockIndent) {
        lines[i] = line.replace(/^(\s*-\s+)(#\S+)\s*$/, '$1"$2"');
        continue;
      }
      blockIndent = undefined;
    }

    const open = TAG_BLOCK_OPEN.exec(line);
    if (open) {
      blockIndent = open[1]?.length ?? 0;
      continue;
    }

    const inline = TAG_INLINE.exec(line);
    if (inline) {
      const [, prefix = "", value = "", trailing = ""] = inline;
      const quoted = value
        .replace(/^(#\S+)$/, '"$1"')
        .replace(/^\[([^\]]*)\]$/, (_flow, body: string) => {
          const items = body
            .split(",")
            .map((item) => item.replace(/^(\s*)(#\S+)(\s*)$/, '$1"$2"$3'));
          return `[${items.join(",")}]`;
        });
      lines[i] = `${prefix}${quoted}${trailing}`;
    }
  }
  return lines.join("\n");
}

// ── Helpers ────────────────────────────────────────────────────────

function parentFolder(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash < 0 ? "" : path.slice(0, slash);
}

function basename(path: string): string {
  const name = path.slice(path.lastIndexOf("/") + 1);
  return name.toLowerCase().endsWith(".md") ? name.slice(0, -3) : name;
}

function isMapping(raw: unknown): raw is Record<string, unknown> {
  return typeof raw === "object" && raw !== null && !Array.isArray(raw);
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
