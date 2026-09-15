import { describe, expect, it } from "vitest";
import { roundUpToParity } from "../src/layout/overflow-splitter";

// The DOM-pagination behaviour of the parity branch (front-only pagination,
// blank padding, odd-only real-back re-append, scale-up fill) depends on real
// layout measurement (scrollHeight vs clientHeight), so it is the browser
// suite's. This file pins the pure parity arithmetic that drives the page count.
describe("roundUpToParity", () => {
  it("rounds up to the next odd integer", () => {
    expect(roundUpToParity(1, "odd")).toBe(1);
    expect(roundUpToParity(2, "odd")).toBe(3);
    expect(roundUpToParity(3, "odd")).toBe(3);
    expect(roundUpToParity(4, "odd")).toBe(5);
  });

  it("rounds up to the next even integer", () => {
    expect(roundUpToParity(1, "even")).toBe(2);
    expect(roundUpToParity(2, "even")).toBe(2);
    expect(roundUpToParity(3, "even")).toBe(4);
    expect(roundUpToParity(4, "even")).toBe(4);
  });

  it("leaves the count unchanged for any parity", () => {
    expect(roundUpToParity(2, "any")).toBe(2);
    expect(roundUpToParity(3, "any")).toBe(3);
  });

  it("models the overflow sequences (odd: 2→3→5, even: 2→4)", () => {
    // odd: a natural 2-page overflow grows to 3 (the +1 odd pad), then a
    // natural 4 grows to 5.
    expect(roundUpToParity(2, "odd")).toBe(3);
    expect(roundUpToParity(4, "odd")).toBe(5);
    // even: a natural 2 stays 2, a natural 3 grows to 4.
    expect(roundUpToParity(2, "even")).toBe(2);
    expect(roundUpToParity(3, "even")).toBe(4);
  });
});
