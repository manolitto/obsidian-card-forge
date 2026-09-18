import { dump } from "js-yaml";
import { SELECTION_KEYS } from "../deck/block";
import { CARD_SETTING_KEYS } from "../definitions/card-settings";
import { DECK_SETTING_KEYS } from "../definitions/deck-settings";
import { BASELINE } from "../systems/baseline";
import { translate, type ResolvedLanguage, type StringKey } from "./strings";

/*
 * The `cardsmith-deck` block the insert command writes: `system` and
 * `card-type` filled in, then every other key the deck parser knows —
 * the selection keys, the deck settings, the card layer — commented out
 * with a one-line description and the baseline's default. The block is
 * the deck grammar's documentation, in the note where it is edited.
 * Pure; the goldens under `tests/fixtures/` hold it.
 */

/** The block for a system and the card types it should collect, in `language`. */
export function buildDeckBlock(
  systemId: string,
  cardTypeIds: readonly string[],
  language: ResolvedLanguage
): string {
  const lines = ["```cardsmith-deck", `system: ${systemId}`];
  lines.push(
    cardTypeIds.length === 1
      ? `card-type: ${cardTypeIds[0]}`
      : `card-type: [${cardTypeIds.join(", ")}]`
  );

  const documented = (key: string, description: StringKey): void => {
    lines.push("", `# ${translate(language, description)}`);
    const fallback = BASELINE.defaults[key];
    lines.push(fallback === undefined ? `# ${key}:` : `# ${key}: ${flow(fallback)}`);
  };
  for (const key of SELECTION_KEYS) {
    if (key === "system" || key === "card-type") continue;
    documented(key, `deck-key.${key}` as StringKey);
  }
  for (const key of DECK_SETTING_KEYS) documented(key, `deck-key.${key}` as StringKey);
  for (const key of CARD_SETTING_KEYS) documented(key, `card-key.${key}` as StringKey);

  lines.push("```", "");
  return lines.join("\n");
}

/** A default on one line: a scalar as YAML writes it, a list or a map in flow style. */
function flow(value: unknown): string {
  return dump(value, { flowLevel: 0, lineWidth: -1, noRefs: true }).trimEnd();
}
