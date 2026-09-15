import { describe, expect, it } from "vitest";
import { isBreakableContainer } from "../src/layout/overflow-splitter";

/**
 * `isBreakableContainer(el)` gates the child-boundary split path: the splitter
 * may descend into the element and paginate between its children.
 *
 * This is the splitter's DEFAULT, not an opt-in — breaking between paragraphs
 * is the normal case and cutting inside a sentence is the emergency. The
 * predicate therefore has to INFER what a marker would otherwise assert, and
 * the load-bearing half is that every element child must be block-level:
 * element children alone would happily "break" between the `<strong>` and the
 * `<em>` of a sentence.
 *
 * It reads `display`, so it is not pure. The fakes below carry their own
 * `ownerDocument.defaultView.getComputedStyle`, which is all the function asks
 * for — no DOM needed. What still needs a real layout engine (the Range cut,
 * the scrollHeight child search) is the browser suite's.
 */

interface FakeNode {
  nodeType: number;
  tagName?: string;
  firstChild: FakeNode | null;
  nextSibling: FakeNode | null;
  ownerDocument: { defaultView: { getComputedStyle(n: FakeNode): { display: string } } };
}

const view = {
  getComputedStyle: (n: FakeNode) => ({
    display: (n as { display?: string }).display ?? "block",
  }),
};
const doc = { defaultView: view };

/** A fake element. `display` is what `getComputedStyle` will report for it. */
function el(tagName = "DIV", children: FakeNode[] = [], display = "block"): FakeNode {
  const node = {
    nodeType: 1,
    tagName,
    display,
    firstChild: children[0] ?? null,
    nextSibling: null,
    ownerDocument: doc,
  } as FakeNode;
  for (let i = 0; i < children.length - 1; i++)
    children[i]!.nextSibling = children[i + 1]!;
  return node;
}

const p = () => el("P");
const inline = (t: string) => el(t, [], "inline");
const row = () => el("TR", [], "table-row");
const tbody = (rows: FakeNode[]) => el("TBODY", rows, "table-row-group");
const text = (): FakeNode => ({ nodeType: 3 }) as FakeNode;

const breakable = (n: FakeNode | null) =>
  isBreakableContainer(n as unknown as Node | null);

describe("isBreakableContainer — the default, inferred from display", () => {
  it("true: two block children", () => {
    expect(breakable(el("DIV", [p(), p()]))).toBe(true);
  });

  it("true: many block children", () => {
    expect(breakable(el("DIV", [p(), p(), p(), p(), p(), p()]))).toBe(true);
  });

  it("false: a single child has no interior boundary", () => {
    expect(breakable(el("DIV", [p()]))).toBe(false);
  });

  it("false: no children at all", () => {
    expect(breakable(el("DIV"))).toBe(false);
  });

  // THE case the display test exists for: `<p><strong>x</strong> … <em>y</em></p>`
  // has two element children, and breaking between them is a mid-sentence cut
  // wearing the costume of a clean boundary.
  it("false: inline children — a sentence is not a list of blocks", () => {
    expect(breakable(el("P", [inline("STRONG"), inline("EM")]))).toBe(false);
  });

  it("false: even ONE inline child disqualifies the container", () => {
    expect(breakable(el("DIV", [p(), inline("SPAN"), p()]))).toBe(false);
  });

  it("accepts the other block-ish displays", () => {
    for (const d of [
      "flow-root",
      "flex",
      "grid",
      "list-item",
      "table",
      "table-caption",
    ]) {
      expect(breakable(el("DIV", [el("DIV", [], d), el("DIV", [], d)]))).toBe(true);
    }
  });

  it("counts only ELEMENT children — bare text between blocks is ignored", () => {
    const container = el("DIV", [p(), text(), p()]);
    expect(breakable(container)).toBe(true);
  });

  // Hiding a conditional element by CSS is how layout candidates are meant to
  // differ, so hidden siblings are routine — an item body carries a hidden
  // image wrap under two of its three candidates. Counting one would make a
  // body of one visible block plus that wrap read as non-breakable.
  it("ignores display:none children — they are neither breakpoint nor veto", () => {
    const hidden = () => el("DIV", [], "none");
    expect(breakable(el("DIV", [p(), hidden(), p()]))).toBe(true);
    // an inline child that is HIDDEN must not veto either
    expect(breakable(el("DIV", [p(), el("SPAN", [], "none"), p()]))).toBe(true);
  });

  it("false: one visible block beside a hidden sibling is not two breakpoints", () => {
    expect(breakable(el("DIV", [p(), el("DIV", [], "none")]))).toBe(false);
  });

  it("rejects non-elements", () => {
    expect(breakable(text())).toBe(false);
    expect(breakable(null)).toBe(false);
  });
});

describe("isBreakableContainer — tables paginate by row", () => {
  it("true: a table whose tbody holds two rows", () => {
    expect(breakable(el("TABLE", [tbody([row(), row()])], "table"))).toBe(true);
  });

  it("counts rows across several tbody sections", () => {
    const t = el("TABLE", [tbody([row()]), tbody([row()])], "table");
    expect(breakable(t)).toBe(true);
  });

  it("false: a one-row table", () => {
    expect(breakable(el("TABLE", [tbody([row()])], "table"))).toBe(false);
  });

  // `<thead>` / `<tfoot>` are not breakpoints — the head is REPEATED on the
  // continuation instead, so it must not count towards the two-child minimum.
  it("ignores thead and tfoot when counting breakpoints", () => {
    const t = el(
      "TABLE",
      [
        el("THEAD", [row()], "table-header-group"),
        tbody([row()]),
        el("TFOOT", [row()], "table-footer-group"),
      ],
      "table"
    );
    expect(breakable(t)).toBe(false);
  });

  // A tbody is never the wrapper: cutting "between the children of a tbody"
  // would lose the thead repeat that the enclosing table gets.
  it("false: a structural table section is never itself the container", () => {
    expect(breakable(tbody([row(), row()]))).toBe(false);
    expect(breakable(el("THEAD", [row(), row()], "table-header-group"))).toBe(false);
    expect(breakable(el("TFOOT", [row(), row()], "table-footer-group"))).toBe(false);
  });
});
