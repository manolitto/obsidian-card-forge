/*
 * Which notes name a system, and renaming it in them: `system: <id>`
 * inside a `card-forge` or `card-forge-deck` fence and nowhere else. What
 * the copy-into-vault action runs over the vault when a copy gets a new
 * id. Pure.
 */

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
