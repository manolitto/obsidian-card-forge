import { describe, expect, it } from "vitest";
import { CARD_BREAK_CLASS, isForcedBreakMarker } from "../src/layout/overflow-splitter";

/**
 * `isForcedBreakMarker(el)` is the pure predicate that recognises the forced
 * card-break (`%% card-break %%`) marker element. It reads only `nodeType` and
 * `classList.contains` — no layout — so it is fully testable with minimal fake
 * nodes, like `break-children.test.ts` and `keep-marker-boundary.test.ts`.
 *
 * The depth-aware detection (`firstEffectiveBreakMarker` / `bodyHasForcedBreak`)
 * and the Range-based `extractContents` cut need a live layout engine, so they
 * are the browser suite's, exactly as the splitter's other Range and
 * scrollHeight branches are.
 */

interface FakeNode {
  nodeType: number;
  classList: { contains(c: string): boolean };
}

/** A fake element node (nodeType 1) carrying the given class list. */
function el(classes: string[] = []): FakeNode {
  return {
    nodeType: 1,
    classList: { contains: (c: string) => classes.includes(c) },
  };
}

/** A fake text node (nodeType 3) — never a marker. */
function text(): FakeNode {
  return { nodeType: 3, classList: { contains: () => false } };
}

const marker = (n: FakeNode | null | undefined) =>
  isForcedBreakMarker(n as unknown as Node | null | undefined);

describe("isForcedBreakMarker", () => {
  it("true: element carrying cf-card-break", () => {
    expect(marker(el([CARD_BREAK_CLASS]))).toBe(true);
  });

  it("true: marker among other classes", () => {
    expect(marker(el(["foo", CARD_BREAK_CLASS, "bar"]))).toBe(true);
  });

  it("false: element without the class", () => {
    expect(marker(el(["cf-keep-together"]))).toBe(false);
  });

  it("false: a text node", () => {
    expect(marker(text())).toBe(false);
  });

  it("false: null / undefined", () => {
    expect(marker(null)).toBe(false);
    expect(marker(undefined)).toBe(false);
  });
});
