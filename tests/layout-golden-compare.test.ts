import { describe, expect, it } from "vitest";
import { withScalesAligned } from "./browser/helpers/layout-golden";

const golden = [
  "Card · 1 card · 2 faces · clipped: no",
  "1. front [cs-front-first cs-front-has-next] scale 0.77",
  '   p "Eine Beizjagd dauert einen Tag"',
  "2. back-as-front [cs-front-continued] scale 0.77",
].join("\n");

describe("withScalesAligned", () => {
  it("reads a scale a hundredth off as the golden's", () => {
    const actual = golden.replace(/scale 0\.77/g, "scale 0.76");
    expect(withScalesAligned(actual, golden)).toBe(golden);
  });

  it("leaves a scale that moved further alone", () => {
    const actual = golden.replace(/scale 0\.77/g, "scale 0.72");
    expect(withScalesAligned(actual, golden)).toBe(actual);
  });

  it("touches nothing but the scale", () => {
    const actual = golden
      .replace('p "Eine Beizjagd', 'p "Die Beizjagd')
      .replace("0.77", "0.78");
    const aligned = withScalesAligned(actual, golden);
    expect(aligned).toContain('p "Die Beizjagd');
    expect(aligned.split("\n")[1]).toBe(golden.split("\n")[1]);
  });

  it("compares line by line, so a face that moved is not aligned across lines", () => {
    const actual =
      golden.split("\n").slice(0, 2).join("\n") + "\n" + "3. front [] scale 0.78";
    expect(withScalesAligned(actual, golden).split("\n")[2]).toBe(
      "3. front [] scale 0.78"
    );
  });
});
