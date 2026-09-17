/*
 * The rewrites the copy-into-vault action makes, all pure: the copied
 * root document with the id and name the dialog chose, and — when the id
 * changed — the notes naming the old one, `system: <id>` inside a
 * `card-forge` or `card-forge-deck` fence and nowhere else.
 */

/**
 * The root document with `id:` and `name:` set. Each is a top-level line,
 * replaced where the document has it; `name:` is added under `id:` where
 * it does not, since a document may leave the name to fall back to the
 * id. The name is written double-quoted, so a colon or a hash in it stays
 * part of the name. Line endings are kept.
 */
export function rewriteDeclaration(text: string, id: string, name: string): string {
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const nameLine = `name: ${JSON.stringify(name)}`;
  const out = text.replace(/^id\s*:.*$/m, `id: ${id}`);
  return /^name\s*:/m.test(out)
    ? out.replace(/^name\s*:.*$/m, nameLine)
    : out.replace(/^id\s*:.*$/m, (line) => `${line}${eol}${nameLine}`);
}

const FENCE_OPEN = /^```[^\S\r\n]*card-forge(?:-deck)?[^\S\r\n]*$/;
const FENCE_CLOSE = /^```[^\S\r\n]*$/;

/**
 * `system: <from>` → `system: <to>`, inside `card-forge` and
 * `card-forge-deck` fences and nowhere else: not in prose, not in the
 * frontmatter, not in another fence. Line endings and the line's own
 * spacing, quoting and comment are kept.
 */
export function rewriteSystemId(text: string, from: string, to: string): string {
  return mapSystemLines(text, from, (line, key) => line.replace(key, `$1$2${to}$2$3`));
}

/** True when the note names `id` as its system inside a card or deck fence. */
export function namesSystem(text: string, id: string): boolean {
  let found = false;
  mapSystemLines(text, id, (line) => {
    found = true;
    return line;
  });
  return found;
}

/**
 * Every line inside a card or deck fence that says `system: <id>` —
 * however spaced, quoted or commented — through `map`; the text with the
 * lines it returned, line endings as they were.
 */
function mapSystemLines(
  text: string,
  id: string,
  map: (line: string, key: RegExp) => string
): string {
  const key = new RegExp(
    `^(\\s*system\\s*:\\s*)(["']?)${escapeRegExp(id)}\\2(\\s*(?:#.*)?)$`,
    "i"
  );
  let inFence = false;
  return text
    .split(/(\r?\n)/)
    .map((piece) => {
      if (piece === "\n" || piece === "\r\n") return piece;
      if (inFence) {
        if (FENCE_CLOSE.test(piece)) inFence = false;
        else if (key.test(piece)) return map(piece, key);
      } else if (FENCE_OPEN.test(piece)) inFence = true;
      return piece;
    })
    .join("");
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
