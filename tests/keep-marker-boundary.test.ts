import { describe, expect, it } from "vitest";
import { keepMarkerBoundary } from "../src/layout/overflow-splitter";

/**
 * `keepMarkerBoundary(body, k)` adjusts a whole-block split boundary backwards
 * to honour the two symmetric markers:
 *   - `cf-keep-with-next` on the LAST STAYING block (blocks[m-1])
 *   - `cf-keep-with-prev` on the FIRST MOVING block (blocks[m])
 *
 * The function only walks the DOM via firstChild / nextSibling / nodeType and
 * reads classList.contains — no layout measurement — so it is fully testable
 * with minimal fake nodes.
 */

interface FakeNode {
  nodeType: number;
  tagName?: string;
  classList: { contains(c: string): boolean };
  nextSibling: FakeNode | null;
}
interface FakeBody {
  firstChild: FakeNode | null;
}

/**
 * Build a fake body from a list of class-name arrays (one per top-level block).
 * An entry may name a TAG instead by prefixing it with `<`, e.g. `["<h3"]` — the
 * implicit heading rule reads `tagName`, everything else reads `classList`.
 */
function body(blocks: string[][]): Node {
  const nodes: FakeNode[] = blocks.map((classes) => ({
    nodeType: 1,
    tagName: (classes.find((c) => c.startsWith("<")) ?? "<div").slice(1).toUpperCase(),
    classList: { contains: (c: string) => classes.includes(c) },
    nextSibling: null,
  }));
  for (let i = 0; i < nodes.length - 1; i++) nodes[i]!.nextSibling = nodes[i + 1]!;
  const fake: FakeBody = { firstChild: nodes[0] ?? null };
  return fake as unknown as Node;
}

describe("keepMarkerBoundary", () => {
  it("returns k unchanged when no markers straddle the boundary", () => {
    const b = body([["a"], ["b"], ["c"], ["d"]]);
    expect(keepMarkerBoundary(b, 2)).toBe(2);
  });

  it("k < 1 is returned verbatim (no predecessor to pull)", () => {
    expect(keepMarkerBoundary(body([["a"], ["b"]]), 0)).toBe(0);
  });

  // ── cf-keep-with-prev ─────────────────────────────────────────────────
  it("pulls the predecessor along when the first MOVING block has cf-keep-with-prev", () => {
    // [statblock, spacer, E, ornament(kwp)] — ornament is first moving (k=3).
    // Expect the boundary pulled back to 2 so E moves WITH the ornament.
    const b = body([["statblock"], ["spacer"], ["e"], ["ornament", "cf-keep-with-prev"]]);
    expect(keepMarkerBoundary(b, 3)).toBe(2);
  });

  it("control: same geometry without cf-keep-with-prev leaves the ornament alone", () => {
    const b = body([["statblock"], ["spacer"], ["e"], ["ornament"]]);
    expect(keepMarkerBoundary(b, 3)).toBe(3);
  });

  it("does NOT empty the face — a kwp block with only one predecessor is a no-op", () => {
    // [a, b(kwp)], k=1: honouring would pull to 0 (empty face). Guard stops at 1.
    expect(keepMarkerBoundary(body([["a"], ["b", "cf-keep-with-prev"]]), 1)).toBe(1);
  });

  // ── cf-keep-with-next ─────────────────────────────────────────────────
  it("pulls a cf-keep-with-next block forward with its successor", () => {
    // [a, b(kwn), c], k=2: b is the last staying block, c moves → pull b along.
    expect(keepMarkerBoundary(body([["a"], ["b", "cf-keep-with-next"], ["c"]]), 2)).toBe(
      1
    );
  });

  it("walks back a contiguous run of cf-keep-with-next blocks", () => {
    // [a, b(kwn), c(kwn), d], k=3: c then b both pulled → boundary 1.
    const b = body([
      ["a"],
      ["b", "cf-keep-with-next"],
      ["c", "cf-keep-with-next"],
      ["d"],
    ]);
    expect(keepMarkerBoundary(b, 3)).toBe(1);
  });

  it("kwn marker not adjacent to the boundary does not fire", () => {
    // [a, b(kwn), c, d], k=3: last staying is c (unmarked), so no pull-back.
    const b = body([["a"], ["b", "cf-keep-with-next"], ["c"], ["d"]]);
    expect(keepMarkerBoundary(b, 3)).toBe(3);
  });

  it("kwn last-resort: marker on the only staying block is a no-op", () => {
    // [a(kwn), b], k=1: honouring would empty the face → stays at 1.
    expect(keepMarkerBoundary(body([["a", "cf-keep-with-next"], ["b"]]), 1)).toBe(1);
  });

  // ── headings bind implicitly, with no marker ──────────────────────────
  // Every typesetting system does this by default (Word's heading styles ship
  // with "Keep with next"); a heading alone at the foot of a face is a setting
  // defect, not an authoring choice.
  it("pulls an unmarked heading forward with its successor", () => {
    // [p, h3, p], k=2: the heading is the last staying block → pulled along.
    expect(keepMarkerBoundary(body([["<p"], ["<h3"], ["<p"]]), 2)).toBe(1);
  });

  it("applies to every heading level, and to nothing else", () => {
    for (const tag of ["h1", "h2", "h3", "h4", "h5", "h6"]) {
      expect(keepMarkerBoundary(body([["<p"], [`<${tag}`], ["<p"]]), 2)).toBe(1);
    }
    for (const tag of ["p", "div", "ul", "table", "blockquote"]) {
      expect(keepMarkerBoundary(body([["<p"], [`<${tag}`], ["<p"]]), 2)).toBe(2);
    }
  });

  it("walks back a run of consecutive headings", () => {
    // [p, h2, h3, p], k=3: h3 then h2 both pulled → the pair travels together.
    expect(keepMarkerBoundary(body([["<p"], ["<h2"], ["<h3"], ["<p"]]), 3)).toBe(1);
  });

  it("heading last-resort: a heading as the only staying block is a no-op", () => {
    // [h3, p], k=1: honouring would empty the face → stays at 1.
    expect(keepMarkerBoundary(body([["<h3"], ["<p"]]), 1)).toBe(1);
  });

  it("a heading NOT adjacent to the boundary does not fire", () => {
    expect(keepMarkerBoundary(body([["<p"], ["<h3"], ["<p"], ["<p"]]), 3)).toBe(3);
  });

  // ── interleaving: a kwp pull-back exposes a kwn predecessor ────────────
  it("interleaves both markers in a single pass", () => {
    // [a, b(kwn), c, d(kwp)], k=3:
    //   m=3: first-moving d has kwp → m=2
    //   m=2: last-staying b has kwn → m=1
    // → boundary 1 (b, c, d all travel together).
    const b = body([
      ["a"],
      ["b", "cf-keep-with-next"],
      ["c"],
      ["d", "cf-keep-with-prev"],
    ]);
    expect(keepMarkerBoundary(b, 3)).toBe(1);
  });
});
