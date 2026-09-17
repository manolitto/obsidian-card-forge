import { dump } from "js-yaml";
import type { Editor } from "obsidian";
import { propertyDescription, propertySample } from "../definitions/property-defs";
import type { LoadedCardType, LoadedSystem } from "../systems/loader";
import { t } from "./strings";

/*
 * The `card-forge` block the insert commands write: `card:` naming the
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
 * `language`, falling back to the first the system documents.
 */
export function buildCardBlock(
  system: LoadedSystem,
  cardType: LoadedCardType,
  language: string,
  mode: InsertMode
): string {
  const lines = [
    "```card-forge",
    "card:",
    `  system: ${system.id}`,
    `  card-type: ${cardType.declaration.id}`,
    "data:",
  ];

  const bound = Object.entries(cardType.properties).filter(
    ([, def]) => (def.slot?.length ?? 0) > 0
  );
  if (bound.length === 0) {
    lines.push(`  # ${t("insert.no-properties")}`);
  }
  for (const [index, [key, def]] of bound.entries()) {
    if (index > 0) lines.push("");
    const description = propertyDescription(def, language);
    if (description) {
      for (const line of description.split(/\r?\n/)) lines.push(`  # ${line}`);
    }
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
