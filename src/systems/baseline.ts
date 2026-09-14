import { load } from "js-yaml";
import BASE_CARD_YAML from "../../resources/base-card.yaml";
import BASE_CARD_CSS from "../../resources/base-card.css";
import {
  isCardSettingKey,
  parseCardSettings,
  type CardSettings,
} from "../definitions/card-settings";
import {
  isDeckSettingKey,
  parseDeckSettings,
  type DeckSettings,
} from "../definitions/deck-settings";
import { collectDiagnostics } from "../definitions/diagnostics";
import { parsePropertyDefs, type PropertyDefsMap } from "../definitions/property-defs";

/**
 * The baseline — the seed of every fold.
 *
 * `resources/base-card.yaml` is one document read as three layers: the
 * properties every card has, the lowest layer of the card-setting chain, and
 * the lowest layer of the deck-setting chain. It is split here by key, once,
 * the way a deck block is split — a card setting and a deck setting are two
 * folds with different inputs, and the document does not have to know which
 * is which.
 *
 * `resources/base-card.css` is the structural stylesheet loaded under every
 * system's own.
 *
 * Both ship inside the plugin and are read at module load; a problem in them
 * is a bug in the plugin, not a diagnostic to show a user, so it throws.
 */
export interface Baseline {
  properties: PropertyDefsMap;
  cardSettings: CardSettings;
  deckSettings: DeckSettings;
  stylesheet: string;
}

export const BASELINE: Baseline = readBaseline(BASE_CARD_YAML, BASE_CARD_CSS);

/** Exposed for the test that proves the shipped document reads clean. */
export function readBaseline(yaml: string, stylesheet: string): Baseline {
  const diagnostics = collectDiagnostics();
  const doc = load(yaml);
  if (typeof doc !== "object" || doc === null || Array.isArray(doc)) {
    throw new Error("base-card.yaml must be a mapping");
  }

  const card: Record<string, unknown> = {};
  const deck: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(doc as Record<string, unknown>)) {
    if (key === "properties") continue;
    if (isCardSettingKey(key)) card[key] = value;
    else if (isDeckSettingKey(key)) deck[key] = value;
    else diagnostics.warn(`${key}: is neither a card setting nor a deck setting`);
  }

  const baseline: Baseline = {
    properties:
      parsePropertyDefs((doc as Record<string, unknown>)["properties"], diagnostics) ??
      {},
    cardSettings: parseCardSettings(card, diagnostics),
    deckSettings: parseDeckSettings(deck, diagnostics),
    stylesheet,
  };
  if (diagnostics.messages.length > 0) {
    throw new Error(`base-card.yaml: ${diagnostics.messages.join("; ")}`);
  }
  return baseline;
}
