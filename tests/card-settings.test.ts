import { describe, expect, it } from "vitest";
import {
  CARD_SETTING_KEYS,
  isCardSettingKey,
  mergeCardSettings,
  parseCardSettings,
} from "../src/definitions/card-settings";
import { collectDiagnostics } from "../src/definitions/diagnostics";
import { yaml } from "./helpers/definitions";

const layer = (source: string, diagnostics = collectDiagnostics()) =>
  parseCardSettings(yaml(source) as Record<string, unknown>, diagnostics);
const resolve = (sources: string[], diagnostics = collectDiagnostics()) =>
  mergeCardSettings(sources.map((source) => layer(source, diagnostics)));

describe("the card-setting chain", () => {
  it("lets every layer set every key, highest wins, values typed", () => {
    // baseline → system → card type → deck → note, and no per-key permission:
    // a deck overriding a card's size for one print run is the whole point of
    // the deck being a layer here.
    const settings = resolve([
      "card-size: poker\noverflow-mode: none",
      "overflow-mode: back-then-cards",
      "card-size: tarot",
      "card-size: 44 x 63 mm",
      "copies: 3\nside: front\nexpand-by-roll: true\ndisplay-height: 350",
    ]);
    expect(settings).toEqual({
      cardSize: { width: 44, height: 63 },
      overflowMode: "back-then-cards",
      copies: 3,
      side: "front",
      expandByRoll: true,
      displayHeight: 350,
    });
  });

  it("keeps the layer below when a higher one writes an invalid value", () => {
    // Parsed at the boundary, absent when invalid: a card type's typo must not
    // shadow the system's valid answer and fall through to the plugin default.
    const diagnostics = collectDiagnostics();
    const settings = resolve(["card-size: poker", "card-size: huge"], diagnostics);
    expect(settings.cardSize).toEqual({ width: 63, height: 88 });
    expect(diagnostics.matching("huge")).toHaveLength(1);
  });

  it("skips a layer that declared nothing at all", () => {
    expect(mergeCardSettings([layer("side: front"), undefined])).toEqual({
      side: "front",
    });
  });

  it("refuses the wrong shape, not just the wrong word", () => {
    const diagnostics = collectDiagnostics();
    const settings = resolve(
      ["copies: 1.5\ndisplay-height: -10\nexpand-by-roll: yes"],
      diagnostics
    );
    expect(settings).toEqual({});
    expect(diagnostics.messages).toHaveLength(3);
  });

  it("says a deck setting is not a card setting, wherever it is written", () => {
    // Not a permission: the deck fold reads these. All twelve predecessors
    // wrote a `page-margin:` on the system, and it meant nothing.
    const diagnostics = collectDiagnostics();
    const settings = resolve(["paper-size: A3\ncard-size: poker"], diagnostics);
    expect(settings).toEqual({ cardSize: { width: 63, height: 88 } });
    expect(diagnostics.matching("paper-size")).toHaveLength(1);
  });

  it("reports a key that is not a setting at all", () => {
    const diagnostics = collectDiagnostics();
    resolve(["card-siz: poker"], diagnostics);
    expect(diagnostics.matching("card-siz")).toHaveLength(1);
  });
});

describe("layout candidates", () => {
  it("reads the list, with the defaults a candidate may leave out", () => {
    const settings = resolve([
      `layouts:
  - { name: default, fallback: true }
  - name: image-side
    front-face-count: odd
    eligible-if: { element: portrait, min-width: 30% }`,
    ]);
    expect(settings.layouts).toEqual([
      { name: "default", frontFaceCount: "any", fallback: true },
      {
        name: "image-side",
        frontFaceCount: "odd",
        fallback: false,
        eligibleIf: { element: "portrait", minWidth: "30%" },
      },
    ]);
  });

  it("replaces the list rather than merging into it", () => {
    // Candidates are positional; a card type that declares its own list means
    // that list, not the baseline's plus its own.
    const settings = resolve([
      "layouts: [{ name: default }]",
      "layouts: [{ name: odd }]",
    ]);
    expect(settings.layouts?.map((c) => c.name)).toEqual(["odd"]);
  });

  it("refuses a candidate with no name, and keeps the list below", () => {
    const diagnostics = collectDiagnostics();
    const settings = resolve(
      ["layouts: [{ name: default }]", "layouts: [{ front-face-count: odd }]"],
      diagnostics
    );
    expect(settings.layouts?.map((c) => c.name)).toEqual(["default"]);
    expect(diagnostics.matching("layouts")).toHaveLength(1);
  });

  it("reads the decision, and requires an element for element-size", () => {
    const settings = resolve([
      `layout-decision:
  order:
    - { metric: element-size, direction: maximize, element: portrait, dimension: width, epsilon: 2 }
    - { metric: printed-cards, direction: minimize }`,
    ]);
    expect(settings.layoutDecision).toEqual({
      order: [
        {
          metric: "element-size",
          direction: "maximize",
          element: "portrait",
          dimension: "width",
          epsilon: 2,
        },
        { metric: "printed-cards", direction: "minimize" },
      ],
      tieBreak: "declaration-order",
    });
    const diagnostics = collectDiagnostics();
    resolve(
      ["layout-decision: { order: [{ metric: element-size, direction: maximize }] }"],
      diagnostics
    );
    expect(diagnostics.matching("layout-decision")).toHaveLength(1);
  });
});

describe("the card-setting keys", () => {
  it("names each key exactly once", () => {
    expect(new Set(CARD_SETTING_KEYS).size).toBe(CARD_SETTING_KEYS.length);
  });

  it("subsumes the deck-only overrides the predecessor had separate keys for", () => {
    // `overflow-support: false` on a deck was `overflow-mode: none` on the
    // deck layer; `copies-per-card: 2` was `copies: 2`. With the deck a layer
    // of this chain, neither needs a name of its own.
    expect(isCardSettingKey("overflow-mode")).toBe(true);
    expect(isCardSettingKey("copies")).toBe(true);
    expect(isCardSettingKey("overflow-support")).toBe(false);
    expect(isCardSettingKey("copies-per-card")).toBe(false);
  });

  it("counts roll expansion as a property of the kind of card", () => {
    expect(isCardSettingKey("expand-by-roll")).toBe(true);
  });

  it("does not know the scalar front-face-count, which layouts: replaced", () => {
    expect(isCardSettingKey("front-face-count")).toBe(false);
  });
});
