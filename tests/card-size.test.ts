import { describe, expect, it } from "vitest";
import { CARD_PRESETS, parseCardSize } from "../src/model/card-size";

describe("parseCardSize", () => {
  it("resolves a preset name, case-insensitively", () => {
    expect(parseCardSize("poker")).toEqual(CARD_PRESETS.poker);
    expect(parseCardSize("  Tarot ")).toEqual(CARD_PRESETS.tarot);
  });

  it("reads explicit dimensions, with or without units", () => {
    expect(parseCardSize("63x88")).toEqual({ width: 63, height: 88 });
    expect(parseCardSize("88.9 mm × 127mm")).toEqual({ width: 88.9, height: 127 });
  });

  it("returns undefined for anything it cannot answer", () => {
    for (const raw of ["", "   ", "huge", "0x88", "63x", 63, null, undefined, {}]) {
      expect(parseCardSize(raw)).toBeUndefined();
    }
  });
});
