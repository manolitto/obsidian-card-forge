import { describe, expect, it } from "vitest";
import { PAPER_PRESETS, parsePaperSize } from "../src/model/paper-size";

describe("parsePaperSize", () => {
  it("resolves a preset, case-insensitively, as auto orientation", () => {
    expect(parsePaperSize("a4")).toEqual({ ...PAPER_PRESETS.a4, orientation: "auto" });
    expect(parsePaperSize("  Letter ")).toEqual({
      ...PAPER_PRESETS.letter,
      orientation: "auto",
    });
  });

  it("takes an orientation after the preset", () => {
    expect(parsePaperSize("A4 landscape")?.orientation).toBe("landscape");
    expect(parsePaperSize("A3 portrait")?.orientation).toBe("portrait");
  });

  it("takes explicit dimensions as written, portrait", () => {
    expect(parsePaperSize("210 x 297 mm")).toEqual({
      width: 210,
      height: 297,
      orientation: "portrait",
    });
  });

  it("returns undefined for anything it cannot answer", () => {
    for (const raw of [
      "",
      "A7",
      "A4 sideways",
      "A4 landscape now",
      "0x297",
      210,
      null,
      {},
    ]) {
      expect(parsePaperSize(raw)).toBeUndefined();
    }
  });
});
