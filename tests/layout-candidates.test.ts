import { describe, expect, it } from "vitest";
import type { LayoutDecision } from "../src/definitions/card-settings";
import {
  compareLayoutCandidates,
  type CfCandidateRun,
  type CfMeasuredSize,
} from "../src/layout/font-scaler";

// The decision comparator is pure: measured runs in, the winner's index out.
// Parsing a candidate set is the settings chain's job and tested there.

const decl = "declaration-order" as const;

function run(
  name: string,
  opts: Partial<{
    printedCards: number;
    sizes: Record<string, Partial<CfMeasuredSize>>;
    clipped: boolean;
    eligible: boolean;
    fallback: boolean;
    whitespace: number;
  }>
): CfCandidateRun {
  return {
    candidate: { name, frontFaceCount: "any", fallback: opts.fallback ?? false },
    printedCards: opts.printedCards ?? 1,
    sizes: (opts.sizes ?? {}) as Record<string, CfMeasuredSize>,
    clipped: opts.clipped ?? false,
    eligible: opts.eligible ?? true,
    whitespace: opts.whitespace ?? 0,
  };
}

describe("compareLayoutCandidates", () => {
  it("maximizes element-size (hero area); a tie goes to declaration order", () => {
    const runs = [
      run("image-side", { sizes: { hero: { width: 10, height: 10, area: 100 } } }),
      run("image-bottom", { sizes: { hero: { width: 10, height: 10, area: 100 } } }),
      run("image-none", {
        fallback: true,
        sizes: { hero: { width: 0, height: 0, area: 0 } },
      }),
    ];
    const decision: LayoutDecision = {
      order: [{ metric: "element-size", element: "hero", direction: "maximize" }],
      tieBreak: decl,
    };
    expect(compareLayoutCandidates(runs, decision)).toBe(0);
  });

  it("measures the area when the key names no dimension, else the named one", () => {
    const runs = [
      run("wide", { sizes: { hero: { width: 20, height: 5, area: 100 } } }),
      run("tall", { sizes: { hero: { width: 5, height: 20, area: 100 } } }),
    ];
    const byHeight: LayoutDecision = {
      order: [
        {
          metric: "element-size",
          element: "hero",
          dimension: "height",
          direction: "maximize",
        },
      ],
      tieBreak: decl,
    };
    const byArea: LayoutDecision = {
      order: [{ metric: "element-size", element: "hero", direction: "maximize" }],
      tieBreak: decl,
    };
    expect(compareLayoutCandidates(runs, byHeight)).toBe(1);
    expect(compareLayoutCandidates(runs, byArea)).toBe(0);
  });

  it("lets epsilon turn a near-tie into a fall-through to the next key", () => {
    const runs = [
      run("a", { sizes: { hero: { area: 100 } }, printedCards: 2 }),
      run("b", { sizes: { hero: { area: 101 } }, printedCards: 1 }), // within 2 % on area
    ];
    const decision: LayoutDecision = {
      order: [
        { metric: "element-size", element: "hero", direction: "maximize", epsilon: 0.02 },
        { metric: "printed-cards", direction: "minimize" },
      ],
      tieBreak: decl,
    };
    expect(compareLayoutCandidates(runs, decision)).toBe(1);
  });

  it("compares printed-cards exactly, as integers", () => {
    const runs = [
      run("odd", { printedCards: 2, fallback: true }),
      run("even", { printedCards: 1 }),
    ];
    const decision: LayoutDecision = {
      order: [{ metric: "printed-cards", direction: "minimize" }],
      tieBreak: decl,
    };
    expect(compareLayoutCandidates(runs, decision)).toBe(1);
  });

  it("breaks equal printed-cards on whitespace — the tighter pack wins under minimize", () => {
    const runs = [
      run("with-back", { printedCards: 1, whitespace: 0.4, fallback: true }),
      run("front-image", { printedCards: 1, whitespace: 0.1 }),
    ];
    const decision: LayoutDecision = {
      order: [
        { metric: "printed-cards", direction: "minimize" },
        { metric: "whitespace", direction: "minimize" },
      ],
      tieBreak: decl,
    };
    expect(compareLayoutCandidates(runs, decision)).toBe(1);
  });

  it("lets an earlier key decide before a later one is consulted", () => {
    const runs = [
      run("odd", { printedCards: 1, whitespace: 0.9, fallback: true }),
      run("even", { printedCards: 2, whitespace: 0.0 }),
    ];
    const decision: LayoutDecision = {
      order: [
        { metric: "printed-cards", direction: "minimize" },
        { metric: "whitespace", direction: "minimize" },
      ],
      tieBreak: decl,
    };
    expect(compareLayoutCandidates(runs, decision)).toBe(0);
  });

  it("keeps clipped and ineligible candidates out of the running", () => {
    const runs = [
      run("a", { printedCards: 1, clipped: true }),
      run("b", { printedCards: 5, eligible: false }),
      run("c", { printedCards: 9, fallback: true }),
    ];
    const decision: LayoutDecision = {
      order: [{ metric: "printed-cards", direction: "minimize" }],
      tieBreak: decl,
    };
    expect(compareLayoutCandidates(runs, decision)).toBe(2);
  });

  it("falls back to the flagged candidate when none is eligible", () => {
    const runs = [
      run("a", { clipped: true }),
      run("b", { clipped: true, fallback: true }),
      run("c", { clipped: true }),
    ];
    const decision: LayoutDecision = {
      order: [{ metric: "printed-cards", direction: "minimize" }],
      tieBreak: decl,
    };
    expect(compareLayoutCandidates(runs, decision)).toBe(1);
  });

  it("falls back to the first candidate when none is eligible and none is flagged", () => {
    const runs = [run("a", { clipped: true }), run("b", { clipped: true })];
    const decision: LayoutDecision = {
      order: [{ metric: "printed-cards", direction: "minimize" }],
      tieBreak: decl,
    };
    expect(compareLayoutCandidates(runs, decision)).toBe(0);
  });

  it("answers -1 for no runs at all", () => {
    expect(compareLayoutCandidates([], undefined)).toBe(-1);
  });
});
