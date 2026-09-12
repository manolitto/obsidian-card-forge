import { describe, expect, it } from "vitest";
import { CARD_SETTING_KEYS } from "../src/definitions/card-settings";
import {
  DECK_SETTING_KEYS,
  isDeckSettingKey,
  mergeDeckSettings,
  parseDeckSettings,
} from "../src/definitions/deck-settings";
import { collectDiagnostics } from "../src/definitions/diagnostics";
import { yaml } from "./helpers/definitions";

const layer = (source: string, diagnostics = collectDiagnostics()) =>
  parseDeckSettings(yaml(source) as Record<string, unknown>, diagnostics);
const resolve = (sources: string[], diagnostics = collectDiagnostics()) =>
  mergeDeckSettings(sources.map((source) => layer(source, diagnostics)));

describe("the deck-setting fold", () => {
  it("lets the deck win over the baseline, whole, values typed", () => {
    const settings = resolve([
      "paper-size: A4\npage-margin: 10\nduplex-flip: long-edge\nfolder-recursive: true",
      "paper-size: A3 landscape\npaper-background: plain",
    ]);
    expect(settings).toEqual({
      paperSize: { width: 297, height: 420, orientation: "landscape" },
      pageMargin: 10,
      duplexFlip: "long-edge",
      folderRecursive: true,
      paperBackground: "plain",
    });
  });

  it("merges cut-marks per field, so a deck can change one of them", () => {
    // The one mapping-valued key: changing the colour should not require
    // restating the geometry.
    const settings = resolve([
      "cut-marks: { enabled: true, length: 3, margin: 0, color: '#aaaaaa', weight: 0.25 }",
      "cut-marks: { color: '#ff0000' }",
    ]);
    expect(settings.cutMarks).toEqual({
      enabled: true,
      length: 3,
      margin: 0,
      color: "#ff0000",
      weight: 0.25,
    });
  });

  it("refuses a cut-marks field it does not know, and keeps the layer below", () => {
    const diagnostics = collectDiagnostics();
    const settings = resolve(
      ["cut-marks: { length: 3 }", "cut-marks: { lenght: 5 }"],
      diagnostics
    );
    expect(settings.cutMarks).toEqual({ length: 3 });
    expect(diagnostics.matching("cut-marks")).toHaveLength(1);
  });

  it("reads per-card copy overrides, stripping wiki-link brackets", () => {
    const settings = resolve(["card-copies: [{ name: '[[Goblin]]', copies: 4 }]"]);
    expect(settings.cardCopies).toEqual([{ name: "Goblin", copies: 4 }]);
  });

  it("keeps the layer below when the deck writes an invalid value", () => {
    const diagnostics = collectDiagnostics();
    const settings = resolve(["paper-size: A4", "paper-size: A7"], diagnostics);
    expect(settings.paperSize?.width).toBe(210);
    expect(diagnostics.matching("A7")).toHaveLength(1);
  });

  it("says a card setting is not a deck setting", () => {
    // A deck block does carry card settings — as overrides for every card it
    // holds — but the deck parser hands those to the card chain. Here they
    // are simply the wrong list.
    const diagnostics = collectDiagnostics();
    const settings = resolve(["card-size: mini\npaper-size: A4"], diagnostics);
    expect(settings).toEqual({
      paperSize: { width: 210, height: 297, orientation: "auto" },
    });
    expect(diagnostics.matching("card-size")).toHaveLength(1);
  });
});

describe("the deck-setting keys", () => {
  it("names each key exactly once", () => {
    expect(new Set(DECK_SETTING_KEYS).size).toBe(DECK_SETTING_KEYS.length);
  });

  it("shares no key with the card settings", () => {
    // The deck parser splits a block by key; a key on both lists would have
    // to be resolved twice with two meanings.
    for (const key of CARD_SETTING_KEYS) expect(isDeckSettingKey(key)).toBe(false);
  });
});
