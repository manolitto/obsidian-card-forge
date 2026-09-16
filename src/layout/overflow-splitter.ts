import type { LayoutCandidate, OverflowMode } from "../definitions/card-settings";
import {
  cfApplyLayoutClasses,
  cfEligible,
  cfLayoutHasElementSize,
  cfMarkersForConfig,
  cfMeasureMarker,
  cfMeasureWhitespace,
  compareLayoutCandidates,
  readScaleFromTransform,
  resolveBodyMinScale,
  scaleRoot,
  scaleTitlesInRoot,
  type CfCandidateRun,
  type CfMeasuredSize,
  type LayoutConfig,
} from "./font-scaler";

/*
 * The overflow splitter: what happens when a body does not fit its face even
 * at the type floor.
 *
 * When `scaleOneBody` reports a body clipped at `--card-font-size-min`, the
 * splitter walks the direct children of `.card-body-scalable` and moves the
 * trailing content into a second container — a front-template clone rendered
 * onto the back, or a freshly spawned card's body — until every face fits at
 * one locked scale.
 *
 * The overflow modes (`OverflowMode` in the settings chain):
 *   "none"            — no split; the body clips and the caller warns.
 *   "extra-cards"     — spawn front/back pairs.
 *   "back-then-cards" — clone the front onto the back, then spawn cards. A
 *                       layout candidate with `front-face-count: odd | even`
 *                       paginates onto front faces only and pads the front
 *                       count to that parity: `odd` re-appends the designed
 *                       back as the final face (odd fronts + 1 back = even →
 *                       clean duplex), `even` appends none. `any` keeps plain
 *                       back-then-cards.
 *
 * The committed layout candidate is stamped on every card-root as the CSS hook
 * class `.cf-layout-<name>` (`cfApplyLayoutClasses`), applied BEFORE
 * measurement so templates can safely show or hide body content keyed on it.
 * A set that names its parity candidates `odd` / `even` therefore gets
 * `.cf-layout-odd` / `.cf-layout-even` as its parity hooks.
 *
 * The splitter works on a host: a container holding one `.cf-face` wrapper per
 * face — the front first, the back second — each wrapping a `.card-root`. It
 * appends further `.cf-face` wrappers to the same container as it spawns
 * cards. Everything here reads layout, like the font scaler it builds on.
 */

export const MAX_OVERFLOW_CARDS = 8;
/* The wrapper around each face in the host the splitter runs in. */
export const FACE_CLASS = "cf-face";
const FACE_SELECTOR = "." + FACE_CLASS;
export const OVERFLOW_BACK_AS_FRONT_CLASS = "cf-overflow-back-as-front";
/* Structural overflow-state hook, applied to every card-root in a committed
 * overflow group (see finalizeGroup). Applied AFTER the measure-split-scale pass
 * — it is a presentational flag only and must NOT gate front-body content size
 * (that would change the body height after the splitter measured it).
 *   OVERFLOW_ACTIVE_CLASS  — an overflow split produced more than one face. */
export const OVERFLOW_ACTIVE_CLASS = "cf-overflow-active";

/* Front-face position markers (see `base-card.css`, *What the layout engine
 * stamps*). Stamped on every `.card-front` root once the splitter has committed
 * the final face sequence, so template and system authors can target a front
 * face by its page-number position. Like `.cf-overflow-active`, they are
 * applied AFTER the measure-split-scale pass — a CHROME-ONLY hook that must NOT
 * gate front-body content size. */
export const FRONT_FIRST_CLASS = "cf-front-first"; // first front page (k === 1)
export const FRONT_CONTINUED_CLASS = "cf-front-continued"; // front page 2 or higher (k >= 2)
/* Stamped on every front face that is FOLLOWED BY another front face in the
 * committed sequence — i.e. all front faces EXCEPT the last one (k < total).
 * Lets CSS show a purely-declarative "continues on the next card" cue (an arrow,
 * a ribbon, …) without the splitter having to inject text into a placeholder:
 * CSS can't compare `--cf-front-index` < `--cf-front-total` itself, and the
 * faces aren't DOM siblings (a continuation can land on the back), so
 * `:not(:last-child)` won't work either. This boolean marker bridges that gap.
 * Compare `.cf-front-continued`, which means the OPPOSITE end (a face that
 * received a tail FROM a previous face). */
export const FRONT_HAS_NEXT_CLASS = "cf-front-has-next";
/* All front-position classes, for the idempotent clear before re-stamping. */
export const FRONT_MARKER_CLASSES = [
  FRONT_FIRST_CLASS,
  FRONT_CONTINUED_CLASS,
  FRONT_HAS_NEXT_CLASS,
];

/* Split-continuation marker classes (CSS hooks; see `base-card.css`, *What the
 * layout engine stamps*). Stamped by the splitter so CSS can undo
 * first-face-only styling on a paginated continuation — most importantly
 * bottom-anchoring (which floats continued text to the bottom of the next face)
 * and start-of-block decorations (first-line / hanging indents, top margins,
 * drop-caps, list markers) that a cloned tail wrapper would otherwise repeat.
 *
 *   BODY_CONTINUED_CLASS      — a `.card-body-scalable` that RECEIVED a tail
 *                               (its content began on an earlier face).
 *   BODY_CONTINUES_CLASS      — a `.card-body-scalable` that GAVE UP a tail
 *                               (its content continues on a later face).
 *   SPLIT_HEAD_CLASS          — the head half of a block wrapper that was split
 *                               mid-content, left on the earlier face.
 *   SPLIT_CONTINUATION_CLASS  — the cloned tail half of that wrapper, opening
 *                               the later face. */
export const BODY_CONTINUED_CLASS = "cf-body-continued";
export const BODY_CONTINUES_CLASS = "cf-body-continues";
export const SPLIT_HEAD_CLASS = "cf-split-head";
export const SPLIT_CONTINUATION_CLASS = "cf-split-continuation";

/* Forced card-break marker. A `%% card-break %%` line in the note body (see
 * `block-markdown.ts`) renders to an invisible `<div class="cf-card-break">`
 * body block. The splitter treats it as a HARD breakpoint: content up to the
 * marker stays on the current face, the marker is consumed, and everything
 * after it flows onto a continuation face — even when the content would
 * otherwise have fit on one card. Honoured only in a spawning overflow mode
 * (the entry gate and loop guards below); inert under `none`. */
export const CARD_BREAK_CLASS = "cf-card-break";

/* Widow/orphan line minimum for the block-level word splitter. When cutting a
 * splittable prose block across a card boundary would leave fewer than this many
 * rendered lines on EITHER side (the head kept on the current face = orphan, or
 * the tail moved to the next face = widow), the splitter moves the WHOLE block to
 * the next face instead — but only when the current face keeps a non-empty block
 * prefix (k >= 1, so the face isn't emptied) AND the block fits whole on a fresh
 * face (so it won't just be re-split there). Tunable; calibrated live. */
export const MIN_SPLIT_LINES = 2;

/* Minimum share of a face the committed head must fill, as a fraction of the
 * body's own height. Guards the child-boundary pull-back: moving a cut back
 * to a child boundary is a PREFERENCE for a clean break, and its cost is exactly
 * the space left empty on this face. Usually that cost is a line or two, because
 * the head is the largest prefix that fits. But when the child that would move is
 * itself nearly a whole face — a spell's effect paragraph too long to share one —
 * the head collapses to what preceded it: two stat lines, 7 of 282 words, 2 % of
 * the card, with the rest of the note repaginated behind it. Below this
 * threshold the pull-back is abandoned and the word-level cut is taken instead,
 * which fills the face.
 *
 * An abandoned pull-back means the paragraph is cut mid-sentence instead, so this
 * is a straight trade of clean block boundaries against empty space — a value
 * with no right answer, only a taste. Measured over an Eiserne-Zeit spell deck
 * (42 notes at four card sizes), where breaking between blocks is the default
 * and this guard therefore governs nearly every cut:
 *
 *     threshold   mid-sentence cuts   notes affected   deck size
 *      unguarded          4                  3          48 cards
 *        0.50            12                  7          47
 *        0.62            13                  8          47
 *        0.75            27                 18          47
 *
 * The knee is at 0.62 — 0.50 to 0.62 costs one extra cut, 0.62 to 0.75 doubles
 * them. 0.75 is nonetheless the setting, and the reason is that the number
 * being traded is not the only thing that matters: a face left a third empty
 * (0.67) is too loose to ship, and one threshold shared with the word-split
 * path is easier to reason about than two. Take 0.62 if torn sentences ever
 * start to outweigh that.
 *
 * Unguarded is not an option, whatever the threshold: it prints a face carrying
 * two stat lines and empty for the remaining four fifths. Tunable; calibrated
 * live. */
export const MIN_FACE_FILL = 0.75;

/* One face's front-position markers, as `computeFrontFaceMarkers` describes them. */
export interface FrontFaceMarker {
  /** 1-based front-page number. */
  index: number;
  /** Count of committed front faces. */
  total: number;
  /** The `cf-front-*` class names to add. */
  classes: string[];
}

/* What `moveOverflowChildren` reports: whether anything moved, and whether the
 * source face is stuck with content it cannot surrender. */
interface MoveResult {
  moved: number;
  remainsClipped: boolean;
}

export interface OverflowSplitOptions {
  /** The resolved overflow mode. */
  mode: OverflowMode;
  /** The candidate set and its decision rule, as the settings chain resolves them. */
  layout: LayoutConfig;
  /** The front face as rendered, before any scaling — the chrome a continuation face is cloned from. */
  frontHtml: string;
}

export interface OverflowSplitResult {
  /** Content still clipped after the splitter ran. The caller surfaces the warning. */
  clipped: boolean;
  /** The number of front faces produced (1 = no expansion). */
  cardCount: number;
}

/* The document a node lives in — the plugin window's or the test page's,
 * never a global. */
function docOf(node: Node): Document {
  return node.ownerDocument ?? (node as Document);
}

/* Smallest integer ≥ n whose parity matches `parity` ("odd" | "even"). For
 * "any" returns n unchanged. Used to pad the front-page count of a
 * `back-then-cards` overflow group to the candidate's requested parity. */
export function roundUpToParity(
  n: number,
  parity: LayoutCandidate["frontFaceCount"]
): number {
  if (parity === "odd") return n % 2 === 1 ? n : n + 1;
  if (parity === "even") return n % 2 === 0 ? n : n + 1;
  return n;
}

/* PURE: given the committed face sequence as a list of booleans (one per
 * `.card-root` in physical print order — `true` where the face uses the FRONT
 * template, i.e. carries `.card-front`), return a parallel array describing the
 * front-position markers for each face. Front entries are
 * `{ index, total, classes:[…] }` (1-based front-page index, total committed
 * front faces, and the `cf-front-*` class names to add); back entries are
 * `null` (back faces get no front markers).
 *
 * No DOM access — unit-tested directly; the DOM application is covered by the
 * browser suite. */
export function computeFrontFaceMarkers(
  isFrontList: readonly boolean[]
): (FrontFaceMarker | null)[] {
  const out: (FrontFaceMarker | null)[] = [];
  if (!isFrontList.length) return out;
  let total = 0;
  for (let t = 0; t < isFrontList.length; t++) if (isFrontList[t]) total++;
  let k = 0;
  for (let i = 0; i < isFrontList.length; i++) {
    if (!isFrontList[i]) {
      out.push(null);
      continue;
    }
    k++;
    const classes: string[] = [];
    classes.push(k === 1 ? FRONT_FIRST_CLASS : FRONT_CONTINUED_CLASS);
    if (k < total) classes.push(FRONT_HAS_NEXT_CLASS);
    out.push({ index: k, total: total, classes: classes });
  }
  return out;
}

/* Stamp the front-position markers (computeFrontFaceMarkers) onto an ordered
 * list of `.card-root`s (physical print order). For every root it first CLEARS
 * any stale `cf-front-*` classes (so it is idempotent across re-finalize /
 * revert), then — on front faces only — adds the computed classes. */
function applyFrontFaceMarkers(orderedRoots: ArrayLike<HTMLElement>): void {
  if (!orderedRoots.length) return;
  const isFrontList: boolean[] = [];
  for (let i = 0; i < orderedRoots.length; i++) {
    const r = orderedRoots[i];
    isFrontList.push(!!(r && r.classList.contains("card-front")));
  }
  const markers = computeFrontFaceMarkers(isFrontList);
  for (let j = 0; j < orderedRoots.length; j++) {
    const root = orderedRoots[j];
    if (!root) continue;
    for (let c = 0; c < FRONT_MARKER_CLASSES.length; c++)
      root.classList.remove(FRONT_MARKER_CLASSES[c]!);
    const m = markers[j];
    if (!m) {
      /* Non-front faces carry no page numbers — drop any stale inherited props
       * so a re-finalize never leaves them set on a back face. */
      root.style.removeProperty("--cf-front-index");
      root.style.removeProperty("--cf-front-total");
      continue;
    }
    for (let a = 0; a < m.classes.length; a++) root.classList.add(m.classes[a]!);
    /* Publish the page numbers as INHERITED custom properties so CSS can compose
     * the visible "X / N" counter via counter()/var() in an in-flow placeholder
     * nested inside the title (attr() can't reach .card-root). See
     * `base-card.css`, *What the layout engine stamps*. */
    root.style.setProperty("--cf-front-index", String(m.index));
    root.style.setProperty("--cf-front-total", String(m.total));
  }
}

/* Reserve the CSS "X / N" overflow counter's layout space on a front face
 * BEFORE its body is measured/split.
 *
 * The counter is `display:none` by default and only renders under
 * `.cf-overflow-active`, reading the inherited `--cf-front-index` /
 * `--cf-front-total` props — BOTH applied in finalizeGroup, AFTER the split has
 * already chosen how much body content stays on each face. Because the counter
 * lives inside the scalable header row, revealing it post-split can push a tight
 * title (e.g. a long compound name pinned at the title-min floor) onto an extra
 * line, growing the header and shrinking the body's available height below what
 * the splitter budgeted — clipping the trailing block the splitter measured as
 * fitting. finalizeGroup's relayout re-fits the title but never re-splits, so
 * the clip stands.
 *
 * Activating the counter here makes the MEASURED header height already include
 * it, so the committed split fits. With `font-variant-numeric: tabular-nums` the
 * counter's width is constant for single-digit counts (the overwhelmingly common
 * case), so the "1 / 2" placeholder matches the eventual "X / N" width;
 * finalizeGroup overwrites the props with the real values (same width → no
 * re-wrap). The measured title sits at its pre-finalize (larger-or-equal) font,
 * so the final scaleTitles pass can only keep the header at the measured height
 * or shrink it — never grow it past the budget. A card-type with no counter
 * placeholder is unaffected (nothing renders under `.cf-overflow-active`).
 *
 * Always correct to apply: performSplit only runs once the single card already
 * overflows at the scale floor, so the committed group always has >1 face and
 * the counter always ends up shown. Clones spawned below inherit the class +
 * props via `innerHTML`; the guard skips re-setting an inherited placeholder. */
function reserveOverflowCounter(cardRoot: HTMLElement): void {
  cardRoot.classList.add(OVERFLOW_ACTIVE_CLASS);
  if (!cardRoot.style.getPropertyValue("--cf-front-index")) {
    cardRoot.style.setProperty("--cf-front-index", "1");
  }
  if (!cardRoot.style.getPropertyValue("--cf-front-total")) {
    cardRoot.style.setProperty("--cf-front-total", "2");
  }
}

/* ── Layout-candidate helpers ────────────────────────────────────────────────
 * The decision comparator and the measurement live in the font scaler; these
 * two are what the whole-group loop needs beside them. */

/* The fallback candidate: the one flagged `fallback`, else the earliest declared. */
function pickFallback(candidates: readonly LayoutCandidate[]): LayoutCandidate {
  for (let i = 0; i < candidates.length; i++)
    if (candidates[i]!.fallback) return candidates[i]!;
  return candidates[0]!;
}

/* Stamp a candidate's `.cf-layout-<name>` on every card-root under `root`. */
function stampLayout(root: ParentNode, candidate: LayoutCandidate): void {
  cfApplyLayoutClasses(root.querySelectorAll<HTMLElement>(".card-root"), candidate);
}

/* Count words in `body`'s text content. A "word" is a maximal run of
 * non-whitespace characters. Walks all text-node descendants in DOM order
 * (TreeWalker SHOW_TEXT). Non-text elements (images, svg, …) contribute
 * zero words. */
function countWords(body: Node): number {
  const walker = docOf(body).createTreeWalker(body, NodeFilter.SHOW_TEXT, null);
  let count = 0;
  let inWord = false;
  let node: Node | null;
  while ((node = walker.nextNode()) !== null) {
    const text = (node as Text).data;
    for (let i = 0; i < text.length; i++) {
      const isWS = /\s/.test(text.charAt(i));
      if (!isWS && !inWord) {
        inWord = true;
        count++;
      } else if (isWS && inWord) {
        inWord = false;
      }
    }
  }
  return count;
}

/* Trim `body` to the first `n` words. Returns the extracted tail
 * (everything past word `n`) as a DocumentFragment so the caller can
 * append it to a destination. Returns `null` if `body` already has ≤ `n`
 * words (no trim happened).
 *
 * Uses a DOM Range cut at the start of the `(n+1)`-th word and
 * `extractContents()` — which preserves inline structure (`<em>`/`<strong>`/
 * `<a>`/…) by recursively cloning ancestor wrappers around the extracted
 * tail. Block-level wrappers like `<p>`, `<li>` straddling the cut are
 * split too.
 *
 * Block-boundary alignment: if the cut lands at offset 0 of a text node
 * AND every preceding sibling at every ancestor level up to (but not
 * including) `body` is empty or whitespace-only, we climb via
 * `setStartBefore(climbed)` instead of `setStart(cutNode, 0)`. That sends
 * the entire surrounding block (e.g. a `<p class="trait">` whose first
 * non-WS character is the (n+1)-th word) to the extracted tail intact,
 * rather than splitting it and leaving an orphan empty wrapper on the
 * front face. The binary-search measurement sees the climbed body, so
 * the search converges on the largest N whose post-climb body fits —
 * which for paragraph-aligned content means the cut naturally lands at
 * the paragraph boundary instead of one word earlier.
 *
 * Keep-together: when `respectKeepTogether` (default true) and the cut
 * falls inside an element carrying the `cf-keep-together` class, the cut is
 * moved to BEFORE the outermost such ancestor via `setStartBefore`, pushing
 * the entire marked element to the extracted tail intact (it is never split
 * across the card boundary). This takes precedence over the empty-sibling
 * climb above. Callers pass `respectKeepTogether: false` as a last-resort
 * fallback when a marked element is alone larger than a full card (see
 * `moveOverflowChildren`). The climb is skipped when NOTHING is rendered
 * before the marked ancestor on this face — moving all of the face's content
 * is not a split; see the guard's own comment below. */
function trimBodyToFirstNWords(
  body: HTMLElement,
  n: number,
  respectKeepTogether = true,
  respectBreakChildren = true
): DocumentFragment | null {
  if (n < 0) n = 0;

  const doc = docOf(body);
  const walker = doc.createTreeWalker(body, NodeFilter.SHOW_TEXT, null);
  let count = 0;
  let inWord = false;
  let cutNode: Text | null = null;
  let cutOffset = 0;

  let node: Node | null;
  outer: while ((node = walker.nextNode()) !== null) {
    const text = (node as Text).data;
    for (let i = 0; i < text.length; i++) {
      const isWS = /\s/.test(text.charAt(i));
      if (!isWS && !inWord) {
        inWord = true;
        count++;
        if (count > n) {
          cutNode = node as Text;
          cutOffset = i;
          break outer;
        }
      } else if (isWS && inWord) {
        inWord = false;
      }
    }
  }

  if (!cutNode) return null;

  const range = doc.createRange();
  range.selectNodeContents(body);

  // Keep-together: if the cut falls inside a `cf-keep-together` element,
  // send the entire (outermost) marked ancestor to the tail intact instead
  // of splitting it. Climb to the OUTERMOST marked ancestor so nested
  // markers are kept together at the outer boundary.
  let keepAncestor: Element | null = null;
  if (respectKeepTogether) {
    for (let ka = cutNode.parentNode; ka && ka !== body; ka = ka.parentNode) {
      if (ka.nodeType === 1 && (ka as Element).classList.contains("cf-keep-together")) {
        keepAncestor = ka as Element;
      }
    }
    // ...unless nothing is rendered BEFORE it on this face. Then the climb would
    // move the face's ENTIRE content to the tail, which is not a split: the face
    // is left empty and the oversized block arrives on the next one just as
    // oversized, so the spawn loop repeats it face after face up to
    // MAX_OVERFLOW_CARDS — the empty-faces "loop" symptom. Worse, the emptied
    // body MEASURES as fitting, so every binary search above reports a spurious
    // success at nearly the full word count and the callers' last-resort retry
    // (`respectKeepTogether: false`) never fires. Ignoring the marker here makes
    // the measurement honest: the keep-respecting pass reports "no cut fits" for
    // a leading block that must be force-split, and the cut lands inside it —
    // the documented last resort for a keep-together larger than a whole card.
    // Same rule the forced card-break uses (`hasContentBeforeMarker`): a marker
    // with nothing before it can only spawn an empty face, so it is inert.
    if (keepAncestor && !hasContentBeforeMarker(body, keepAncestor)) keepAncestor = null;
  }

  // Break-children: the mirror image of the climb above. A cut inside a
  // breakable container is moved back to the start of the CONTAINER'S OWN
  // CHILD that contains it, so the region breaks between its entries instead of
  // mid-sentence. `moveOverflowChildren` only consults the container test when
  // the wrapper is a TOP-LEVEL block of the body (`isBreakableContainer` reads
  // `topLevelBlocks`), which a template nesting the note's section inside a
  // wrapper of its own never satisfies: the splitter would see one big prose
  // block and word-split straight through the entries. Honouring the boundary
  // HERE makes it work at any depth, exactly as `cf-keep-together` does.
  // Skipped when nothing renders before the child (that would empty the face —
  // same rule as above, so an oversized single entry still force-splits).
  // The flat cut (`respectBreakChildren: false`) may go through a paragraph,
  // but never through a table cell — see `tableRowBoundary`.
  const breakChild = keepAncestor
    ? null
    : respectBreakChildren
      ? breakChildBoundary(body, cutNode)
      : tableRowBoundary(body, cutNode);

  // When the cut falls strictly inside a block, every element ancestor of
  // `cutNode` up to (but not including) `body` is straddled: extractContents()
  // leaves those originals in place (the HEAD halves) and emits cloned wrappers
  // at the leading edge of the returned fragment (the TAIL/continuation halves).
  // Captured in the genuine mid-content branch and in the child-boundary branch
  // (whose cut is between entries but still inside the wrappers around them);
  // the keep-together and block-boundary climbs cut BETWEEN top-level blocks, so
  // nothing is straddled there.
  let splitChain: Element[] | null = null;

  if (keepAncestor) {
    range.setStartBefore(keepAncestor);
  } else if (breakChild) {
    splitChain = [];
    for (let bc = breakChild.child.parentNode; bc && bc !== body; bc = bc.parentNode) {
      if (bc.nodeType === 1) splitChain.push(bc as Element);
    }
    range.setStartBefore(breakChild.child);
  } else if (cutOffset === 0) {
    // Climb to the nearest ancestor whose start is also the cut position.
    // An ancestor qualifies if none of its preceding siblings carry
    // visible content (empty elements + pure-whitespace text are skipped).
    let climbed: Node = cutNode;
    while (climbed.parentNode && climbed.parentNode !== body) {
      let hasPrevContent = false;
      for (let sib = climbed.previousSibling; sib; sib = sib.previousSibling) {
        if (sib.nodeType === 1) {
          // Element — counts as content unless it has no descendants
          // AND its own textContent is empty (treat empty wrappers as
          // invisible; they don't anchor a content boundary).
          if (
            sib.childNodes.length > 0 ||
            (sib.textContent && sib.textContent.length > 0)
          ) {
            hasPrevContent = true;
            break;
          }
        } else if (sib.nodeType === 3) {
          if (/\S/.test((sib as Text).data)) {
            hasPrevContent = true;
            break;
          }
        }
      }
      if (hasPrevContent) break;
      climbed = climbed.parentNode;
    }
    // The climb lands ON an element boundary, so the keep markers apply here
    // exactly as they do to a container's child boundary — a cut that
    // falls right after a heading would otherwise strand it. This path is also
    // where the fill guard's fallback cut lands, so without it raising
    // MIN_FACE_FILL reintroduces stranded headings (measured: 2 of them at 0.85).
    range.setStartBefore(pullBackForKeepMarkers(body, climbed));
  } else {
    splitChain = [];
    for (let anc = cutNode.parentNode; anc && anc !== body; anc = anc.parentNode) {
      if (anc.nodeType === 1) splitChain.push(anc as Element);
    }
    range.setStart(cutNode, cutOffset);
  }

  const fragment = range.extractContents();

  if (splitChain) {
    // Tag the head halves — the captured originals, still attached in `body`.
    for (let h = 0; h < splitChain.length; h++) {
      splitChain[h]!.classList.add(SPLIT_HEAD_CLASS);
    }
    // Tag the cloned tail halves — descend the fragment's leading element edge
    // for as many nesting levels as we split.
    let tailEl = fragment.firstElementChild;
    let depth = 0;
    while (tailEl && depth < splitChain.length) {
      tailEl.classList.add(SPLIT_CONTINUATION_CLASS);
      tailEl = tailEl.firstElementChild;
      depth++;
    }
  }

  // A split TABLE leaves its `<thead>` on the head side. Same repair as
  // `splitContainerAtChild` makes for a top-level table.
  if (breakChild && breakChild.wrapper) repeatTableHead(breakChild.wrapper, fragment);

  return fragment;
}

/* A markdown/HTML heading. Headings BIND TO WHAT FOLLOWS THEM with no marker
 * needed — the same default every typesetting system has: Word's heading styles
 * ship with "Keep with next", LaTeX's `\section` sets `\@nobreaktrue`, InDesign's
 * heading styles keep with the next n lines. A heading alone at the foot of a
 * face is a setting defect, not an authoring choice, so it is not something a
 * card author should have to remember. (The evidence that it belongs in the
 * engine rather than in a marker: every spell note of a 42-note deck wanted the
 * same marker in the same place.)
 *
 * Deliberately tag-based, so it also covers a heading a TEMPLATE emits, not only
 * one rendered from a note's markdown. A heading-like element that is not an
 * `<h*>` — a `<div class="section-heading">` — keeps using the explicit
 * `cf-keep-with-next`, which composes with this. */
function isHeading(el: Node | null | undefined): boolean {
  if (!el || el.nodeType !== 1) return false;
  const t = (el as Element).tagName.toLowerCase();
  return t === "h1" || t === "h2" || t === "h3" || t === "h4" || t === "h5" || t === "h6";
}

/* Whether `el` must travel with the block that FOLLOWS it: explicitly marked
 * `cf-keep-with-next`, or a heading (implicit — see `isHeading`). */
function bindsToNext(el: Node | null | undefined): boolean {
  if (!el || el.nodeType !== 1) return false;
  if ((el as Element).classList.contains("cf-keep-with-next")) return true;
  return isHeading(el);
}

/* Whether `el` must travel with the block that PRECEDES it. No implicit case:
 * an ornament that has to sit under something says so, and there is no tag that
 * means it. */
function bindsToPrev(el: Node | null | undefined): boolean {
  return !!(
    el &&
    el.nodeType === 1 &&
    (el as Element).classList.contains("cf-keep-with-prev")
  );
}

/* What renders immediately BEFORE `el` among its siblings. Empty wrappers and
 * whitespace-only text are skipped, matching the block-boundary climb's own
 * test. Returns the element, the string "text" when bare text precedes `el`
 * (there is no element boundary there, and ascending past it would drag that
 * text along), or null when `el` leads its parent's content. */
function precedingContent(el: Node): Element | "text" | null {
  for (let sib = el.previousSibling; sib; sib = sib.previousSibling) {
    if (sib.nodeType === 1) {
      if (sib.childNodes.length > 0 || (sib.textContent && sib.textContent.length > 0))
        return sib as Element;
    } else if (sib.nodeType === 3 && /\S/.test((sib as Text).data)) {
      return "text";
    }
  }
  return null;
}

/* Walk a cut backwards while a keep marker straddles it. `el` is the first
 * node that would MOVE to the tail; the return value is the node to cut before
 * instead.
 *
 * This is `keepMarkerBoundary` at any depth. That one indexes
 * `topLevelBlocks(body)`, so it cannot see a marker one wrapper down — and a
 * template that nests the note's section inside a wrapper of its own puts EVERY
 * author marker one wrapper down: a `%% keep-with-next %%` heading above a list
 * of entries would be silently inert there, and the heading would stay behind
 * alone as soon as the list's first entry moved.
 *
 * Two moves, applied until neither fires:
 *   - `el` leads its parent's content: cutting before `el` and before the PARENT
 *     move the same content (only an empty wrapper shell differs), so ascend and
 *     re-ask one level out. This is what brings a marker sitting OUTSIDE the
 *     wrapper into view at all.
 *   - the preceding sibling carries `cf-keep-with-next`, or `el` itself carries
 *     `cf-keep-with-prev`: the pair must travel together, so the cut moves before
 *     the predecessor. The two markers can interleave, which is why one loop
 *     handles both — same reasoning as `keepMarkerBoundary`.
 *
 * Never pulls back past the point where nothing is rendered before the cut: a
 * marker that can only be honoured by emptying the face is ignored, exactly the
 * last-resort rule the other markers follow. */
function pullBackForKeepMarkers(body: HTMLElement, el: Node): Node {
  let best: Node = el;
  for (let guard = 0; guard < 64; guard++) {
    const prev = precedingContent(best);
    if (prev === "text") return best; // no element boundary to pull back to
    if (!prev) {
      const up = best.parentNode;
      if (!up || up === body || up.nodeType !== 1) return best;
      best = up;
      continue;
    }
    const pull = bindsToNext(prev) || bindsToPrev(best);
    if (!pull || !hasContentBeforeMarker(body, prev)) return best;
    best = prev;
  }
  return best;
}

/* The flat cut's one exception: a table. A word-level cut through a cell does
 * not yield a shorter table — `extractContents` clones the row with only the
 * cell the cut fell in, so the continuation opens with a row missing its
 * leading cells, under no head. A table has no meaningful word-level cut point
 * (the reason a top-level one is atomic), so even the fill guard's flat cut,
 * which is free to go through a paragraph, snaps to the start of the ROW the
 * cut fell in — or before the whole table when the cut fell in its head or in
 * its first row, since a head-only table is not a split either. Null when
 * nothing renders before that boundary on this face: an oversized row is then
 * force-split like any oversized block, and the cut lands inside it. */
function tableRowBoundary(
  body: HTMLElement,
  cutNode: Text
): { wrapper: Element | null; child: Node } | null {
  let table: Element | null = null;
  let row: Element | null = null;
  for (let a = cutNode.parentNode; a && a !== body; a = a.parentNode) {
    if (a.nodeType !== 1) continue;
    const tag = (a as Element).tagName.toLowerCase();
    if (tag === "tr" && !row) row = a as Element;
    if (tag === "table") {
      table = a as Element;
      break;
    }
  }
  if (!table) return null;
  const rows = breakableChildren(table);
  const index = row ? rows.indexOf(row) : -1;
  const boundary = index > 0 ? row! : table;
  if (!hasContentBeforeMarker(body, boundary)) return null;
  const cut = pullBackForKeepMarkers(body, boundary);
  return {
    wrapper: table.contains(cut) && cut !== table ? table : null,
    child: cut,
  };
}

/* Where a cut inside a breakable container should be moved back to: the
 * wrapper's own breakable CHILD containing `cutNode`, so the region paginates
 * between its entries. Returns null when there is no such wrapper, when it has
 * too few children to break between, or when nothing is rendered before the
 * child on this face (honouring it would empty the face — the caller then falls
 * through to the word-level cut, which is the right last resort for a single
 * entry larger than a whole card).
 *
 * The INNERMOST wrapper wins — nested containers mean progressively finer
 * granularity, and the finest is the one that keeps the most on the face.
 * `breakableChildren` supplies the child set, so a `<table>` yields the `<tr>`
 * containing the cut rather than its `<tbody>`. */
function breakChildBoundary(
  body: HTMLElement,
  cutNode: Text
): { wrapper: Element | null; child: Node } | null {
  let wrapper: Element | null = null;
  for (let a = cutNode.parentNode; a && a !== body; a = a.parentNode) {
    if (a.nodeType === 1 && isBreakableContainer(a)) {
      wrapper = a as Element;
      break;
    }
  }
  if (!wrapper) return null;

  const kids = breakableChildren(wrapper);
  for (let n: Node | null = cutNode.parentNode; n && n !== wrapper; n = n.parentNode) {
    for (let i = 0; i < kids.length; i++) {
      if (kids[i] !== n) continue;
      if (!hasContentBeforeMarker(body, n)) return null;
      // Honour cf-keep-with-next / cf-keep-with-prev around the chosen boundary.
      // The pull-back may land OUTSIDE the wrapper (a heading above the list),
      // in which case the wrapper is not straddled and needs no head repair.
      const cut = pullBackForKeepMarkers(body, n);
      return {
        wrapper: wrapper.contains(cut) && cut !== wrapper ? wrapper : null,
        child: cut,
      };
    }
  }
  return null;
}

/* Repeat a straddled table's `<thead>` at the top of the extracted tail, so the
 * continuation table keeps its column labels. `container` is the ORIGINAL table
 * (still attached in the body) that holds the head; the tail copy is found by
 * descending the fragment's leading element edge — the chain of cloned
 * ancestors — for the first `<table>` that has none. A no-op when `container`
 * is not a table (an ordinary `<div>` needs no repair). */
function repeatTableHead(container: Element, fragment: DocumentFragment): void {
  const head = tableHead(container);
  if (!head) return;
  for (let el = fragment.firstElementChild; el; el = el.firstElementChild) {
    if (el.tagName.toLowerCase() === "table" && !tableHead(el)) {
      el.insertBefore(head.cloneNode(true), el.firstChild);
      return;
    }
  }
}

/* The ordered top-level ELEMENT children of `body` — the atomic "blocks" the
 * splitter breaks BETWEEN. Whitespace / comment nodes between blocks are
 * skipped (block indices are over elements; the cut Range still spans all
 * nodes). */
function topLevelBlocks(body: Node): Element[] {
  const blocks: Element[] = [];
  for (let n = body.firstChild; n; n = n.nextSibling) {
    if (n.nodeType === 1) blocks.push(n as Element);
  }
  return blocks;
}

/* A block is ATOMIC — never word-split, always moved whole across a card
 * boundary — when it is explicitly marked keep-together, is replaced media or a
 * table (no meaningful word-level cut point), or holds at most one word (an
 * image wrapper, a lone token). Splittable blocks (multi-word prose) are the
 * only ones the word-level search is allowed to cut through. */
function isAtomicBlock(el: Element): boolean {
  if (el.classList.contains("cf-keep-together")) return true;
  const tag = el.tagName.toLowerCase();
  if (
    tag === "img" ||
    tag === "svg" ||
    tag === "video" ||
    tag === "canvas" ||
    tag === "picture" ||
    tag === "table" ||
    tag === "tr"
  ) {
    return true;
  }
  // An image/icon wrapper (`<div class="image-wrap"><img></div>`) has no words
  // to surrender; treat single-token blocks as atomic too.
  if (countWords(el) <= 1) return true;
  return false;
}

/* The children a BREAKABLE CONTAINER paginates between.
 *
 * For an ordinary wrapper that is simply its element children. A `<table>` is
 * the exception, and the reason this helper exists: a table's element children
 * are `<thead>` / `<tbody>` / `<tfoot>`, which are not breakpoints anyone wants
 * — cutting there yields a head-only face. The rows are the breakpoints, so a
 * table paginates between the `<tr>`s of its `<tbody>`s.
 *
 * `<thead>` and `<tfoot>` are deliberately NOT in the list: they are not places
 * to cut, and the head is instead REPEATED on the continuation table (see
 * `splitContainerAtChild`) so the tail's columns keep their labels.
 *
 * Pure DOM walking (firstChild / nextSibling / tagName), no layout. */
function breakableChildren(el: Element): Element[] {
  const tag = el.tagName.toLowerCase();
  if (tag !== "table") return topLevelBlocks(el);
  const rows: Element[] = [];
  const sections = topLevelBlocks(el);
  for (let i = 0; i < sections.length; i++) {
    const st = sections[i]!.tagName.toLowerCase();
    if (st !== "tbody") continue;
    const kids = topLevelBlocks(sections[i]!);
    for (let j = 0; j < kids.length; j++) {
      if (kids[j]!.tagName.toLowerCase() === "tr") rows.push(kids[j]!);
    }
  }
  return rows;
}

/* The `<thead>` of a table, or null. Used to repeat the header row on a
 * continuation table. */
function tableHead(el: Element): Element | null {
  if (el.tagName.toLowerCase() !== "table") return null;
  const sections = topLevelBlocks(el);
  for (let i = 0; i < sections.length; i++) {
    if (sections[i]!.tagName.toLowerCase() === "thead") return sections[i]!;
  }
  return null;
}

/* Display values that make an element a BLOCK — a thing with its own line box,
 * which is what makes the gap before it a legitimate place to cut. Inline
 * displays are deliberately absent: they are the whole reason this test exists. */
const BLOCK_DISPLAYS: Record<string, 1> = {
  block: 1,
  "flow-root": 1,
  flex: 1,
  grid: 1,
  "list-item": 1,
  table: 1,
  "table-row": 1,
  "table-caption": 1,
};

function displayOf(el: Element): string {
  const win = el.ownerDocument.defaultView;
  if (!win) return "";
  return win.getComputedStyle(el).display;
}

function isHiddenEl(el: Element): boolean {
  return displayOf(el) === "none";
}

function isBlockLevel(el: Element): boolean {
  return BLOCK_DISPLAYS[displayOf(el)] === 1;
}

/* Structural table sections are never the wrapper: they ARE the table's insides,
 * and cutting "between the children of a tbody" loses the `<thead>` repeat that
 * `splitContainerAtChild` does for a table. The enclosing `<table>` is chosen
 * instead, and `breakableChildren` hands back its `<tr>`s. */
const TABLE_SECTIONS: Record<string, 1> = { thead: 1, tbody: 1, tfoot: 1 };

/* Whether `el` is a BREAKABLE CONTAINER — one the splitter may descend into and
 * paginate between the children of, rather than word-splitting through it.
 *
 * This is the DEFAULT, not an opt-in. Breaking between paragraphs is the normal
 * case and cutting inside a sentence is the emergency, so the engine should not
 * need to be told; `cf-keep-together` is the marker, and it says the opposite.
 *
 * What a marker would assert, the test infers: EVERY element child must be
 * block-level. That is the load-bearing half. Element children alone would
 * happily "break between" the `<strong>` and the `<em>` of
 * `<p><strong>Effect:</strong> … <em>Dispel Magic</em> …</p>` — a mid-sentence
 * cut wearing the costume of a clean boundary.
 *
 * Reads `display`, so it is NOT pure: the node tests hand it fakes that answer
 * `getComputedStyle` themselves, and the browser suite covers the rest. */
export function isBreakableContainer(el: Node | null | undefined): boolean {
  if (!el || el.nodeType !== 1) return false;
  const element = el as Element;
  if (TABLE_SECTIONS[element.tagName.toLowerCase()] === 1) return false;
  const kids = breakableChildren(element);
  let visible = 0;
  for (let i = 0; i < kids.length; i++) {
    // A `display: none` child renders nothing: it is neither a breakpoint nor a
    // reason to refuse the container. Skipping it is not a nicety — hiding a
    // conditional element by CSS is exactly how layout candidates are meant to
    // differ, so hidden siblings are routine: an item body carrying a hidden
    // image wrap under two of its three candidates is one visible block plus
    // that wrap, and counting the wrap would make it read as non-breakable.
    if (isHiddenEl(kids[i]!)) continue;
    if (!isBlockLevel(kids[i]!)) return false;
    visible++;
  }
  return visible >= 2;
}

/* Whether `el` is the invisible forced card-break marker (see CARD_BREAK_CLASS).
 * Pure (classList check only, no layout) — exported for unit testing. */
export function isForcedBreakMarker(el: Node | null | undefined): boolean {
  return !!(
    el &&
    el.nodeType === 1 &&
    (el as Element).classList.contains(CARD_BREAK_CLASS)
  );
}

/* CSS selector for the marker, used for depth-aware (querySelector) lookups —
 * the marker may be nested inside a template's section wrapper, not just a
 * top-level body block. */
const CARD_BREAK_SELECTOR = "." + CARD_BREAK_CLASS;
/* Replaced/meaningful elements that count as rendered content even with no text
 * (so a break preceded only by an image is NOT treated as leading). */
const CONTENT_BEFORE_SELECTOR = "img,svg,video,canvas,picture,table,hr,input,button";

/* Whether anything is rendered BEFORE `marker` within `body` (text or replaced
 * media), at any depth. A marker with nothing before it on this face is a
 * "leading" break — honouring it would only spawn an empty face, so it is inert.
 * Uses a Range over [body-start, marker) and inspects the cloned contents. */
function hasContentBeforeMarker(body: HTMLElement, marker: Node): boolean {
  const range = docOf(body).createRange();
  range.setStart(body, 0);
  range.setEndBefore(marker);
  const frag = range.cloneContents();
  if (frag.textContent && frag.textContent.trim() !== "") return true;
  return !!frag.querySelector(CONTENT_BEFORE_SELECTOR);
}

/* The first forced-break marker in `body` (document order, ANY depth) that has
 * rendered content before it — consuming (removing) any inert leading markers
 * encountered first. Returns the marker element, or null when none is effective.
 * Mutates `body` only by dropping leading markers (they are display:none, so the
 * measured height is unchanged). */
function firstEffectiveBreakMarker(body: HTMLElement): Element | null {
  for (let guard = 0; guard < 64; guard++) {
    const marker = body.querySelector(CARD_BREAK_SELECTOR);
    if (!marker) return null;
    if (hasContentBeforeMarker(body, marker)) return marker;
    if (!marker.parentNode) return null;
    marker.parentNode.removeChild(marker); // leading marker — inert, consume it
  }
  return null;
}

/* Non-mutating peek: does `body` still carry a forced break that would trigger a
 * split (a marker, at any depth, with rendered content before it)? Used by the
 * entry gate and the spawn-loop guards. */
function bodyHasForcedBreak(body: HTMLElement): boolean {
  const markers = body.querySelectorAll(CARD_BREAK_SELECTOR);
  for (let i = 0; i < markers.length; i++) {
    if (hasContentBeforeMarker(body, markers[i]!)) return true;
  }
  return false;
}

/* Whether any `.card-body-scalable` in `root`'s subtree carries a forced break.
 * Used by the entry gate so a break forces the split path even when content fits
 * (spawning modes only). */
export function rootHasForcedBreak(root: ParentNode): boolean {
  const bodies = root.querySelectorAll<HTMLElement>(".card-body-scalable");
  for (let i = 0; i < bodies.length; i++) {
    if (bodyHasForcedBreak(bodies[i]!)) return true;
  }
  return false;
}

/* What share of its own box `body`'s laid-out content fills, 0..1 (a body that
 * overflows reports > 1; callers only ever ask about one that fits).
 *
 * Deliberately NOT `scrollHeight / clientHeight`, which is the obvious formula
 * and is always exactly 1 here: `applyForcedBodyScale` gives the body a DEFINITE
 * height, and `scrollHeight` never reports less than the client box, so
 * UNDERFILL is invisible that way — `bodyFits` only ever needed the overflow
 * direction. Measure the bottom of the last child against the body's own box
 * instead. Both are `getBoundingClientRect` values, so the FontScaler's
 * transform scales numerator and denominator alike and cancels; mixing a rect
 * with `clientHeight` would not. Body children are `flex-shrink: 0` and do not
 * grow, so the last child's bottom IS the content height. */
function faceFill(body: HTMLElement): number {
  const last = body.lastElementChild;
  if (!last) return 0;
  const box = body.getBoundingClientRect();
  if (!(box.height > 0)) return 1;
  return (last.getBoundingClientRect().bottom - box.top) / box.height;
}

/* Whether `body`'s laid-out content fits within its own box (no clipping). The
 * single measurement primitive shared by every binary search here. CSS
 * transforms applied by the FontScaler don't affect `scrollHeight`, so this
 * reads the true post-reflow height. */
function bodyFits(body: HTMLElement): boolean {
  return body.scrollHeight <= body.clientHeight + 1;
}

/* Rendered line count of a laid-out block element: its content height (scrollHeight
 * minus vertical padding) divided by the line height. `line-height: normal` (which
 * `parseFloat` can't read) falls back to `font-size * 1.2`. Floored at 1. The
 * FontScaler's CSS transform doesn't affect `scrollHeight` or computed lengths, so
 * this reads true post-reflow lines — same assumption as `bodyFits`. */
function countBlockLines(el: Element | undefined): number {
  if (!el) return 0;
  const win = el.ownerDocument.defaultView;
  if (!win) return 1;
  const cs = win.getComputedStyle(el);
  let lh = parseFloat(cs.lineHeight);
  if (!isFinite(lh) || lh <= 0) lh = parseFloat(cs.fontSize) * 1.2;
  if (!isFinite(lh) || lh <= 0) return 1;
  let pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
  if (!isFinite(pad)) pad = 0;
  const h = el.scrollHeight - pad;
  return Math.max(1, Math.round(h / lh));
}

/* Whether the block at index `k` fits WHOLE on a fresh (otherwise empty) face:
 * isolate it in `body` (drop every sibling block), measure, restore. Used as the
 * widow/orphan safety guard — we only move a block whole when it won't just be
 * re-split on the next face. Always restores `originalHTML` before returning. */
function blockFitsOnFreshFace(
  body: HTMLElement,
  originalHTML: string,
  k: number
): boolean {
  body.innerHTML = originalHTML;
  const blocks = topLevelBlocks(body);
  if (k >= blocks.length) {
    body.innerHTML = originalHTML;
    return false;
  }
  for (let i = blocks.length - 1; i >= 0; i--) {
    if (i !== k && blocks[i]!.parentNode) blocks[i]!.parentNode!.removeChild(blocks[i]!);
  }
  const fits = bodyFits(body);
  body.innerHTML = originalHTML;
  return fits;
}

/* Binary-search the largest count `k` of leading WHOLE blocks that fit on the
 * face. Each trial restores the pristine body, removes element children from
 * index `mid` onward, and measures. `.card-body-scalable` children are
 * `flex-shrink:0`, so removing a trailing block only frees height —
 * `scrollHeight` is monotonic in `k` and the search is well-defined. Returns a
 * value in `[0, blockCount-1]` (the caller has verified the body overflows, so
 * not every whole block fits). */
function largestWholePrefixThatFits(
  body: HTMLElement,
  originalHTML: string,
  blockCount: number
): number {
  let lo = 0,
    hi = blockCount,
    best = 0;
  const MAX_ITER = 16;
  for (let iter = 0; iter < MAX_ITER && lo < hi; iter++) {
    const mid = Math.floor((lo + hi + 1) / 2);
    body.innerHTML = originalHTML;
    const blocks = topLevelBlocks(body);
    for (let i = blocks.length - 1; i >= mid; i--) {
      if (blocks[i]!.parentNode) blocks[i]!.parentNode!.removeChild(blocks[i]!);
    }
    if (bodyFits(body)) {
      best = mid;
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return best;
}

/* Binary-search the max words `j` (0..`bWords`) of the boundary block such that
 * the `prefixWords` whole-block words PLUS the first `j` words of the boundary
 * block fit. Reuses `trimBodyToFirstNWords` for both measurement and (later)
 * the committed cut, so what we measure is exactly what we commit. */
function maxBoundaryWordsThatFit(
  body: HTMLElement,
  originalHTML: string,
  prefixWords: number,
  bWords: number,
  respectKeepTogether: boolean,
  respectBreakChildren = true
): number {
  let lo = 0,
    hi = bWords,
    best = 0;
  const MAX_ITER = 16;
  for (let iter = 0; iter < MAX_ITER && lo < hi; iter++) {
    const mid = Math.floor((lo + hi + 1) / 2);
    body.innerHTML = originalHTML;
    trimBodyToFirstNWords(
      body,
      prefixWords + mid,
      respectKeepTogether,
      respectBreakChildren
    );
    if (bodyFits(body)) {
      best = mid;
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return best;
}

/* Binary-search the largest count `j` (0..`childCount`) of leading element
 * children of the breakable container at top-level block index `k` that fit on
 * the face, keeping blocks `0..k-1` whole and dropping every block after `k`.
 * Each trial restores the pristine body, isolates the prefix + container, trims
 * the container to its first `mid` children, and measures. Removing trailing
 * children only frees height, so `scrollHeight` is monotonic in `j`. Mirrors
 * `largestWholePrefixThatFits`, one nesting level down. */
function largestChildPrefixThatFits(
  body: HTMLElement,
  originalHTML: string,
  k: number,
  childCount: number
): number {
  let lo = 0,
    hi = childCount,
    best = 0;
  const MAX_ITER = 16;
  for (let iter = 0; iter < MAX_ITER && lo < hi; iter++) {
    const mid = Math.floor((lo + hi + 1) / 2);
    body.innerHTML = originalHTML;
    const blocks = topLevelBlocks(body);
    for (let i = blocks.length - 1; i > k; i--) {
      if (blocks[i]!.parentNode) blocks[i]!.parentNode!.removeChild(blocks[i]!);
    }
    const kids = breakableChildren(blocks[k]!);
    for (let c = kids.length - 1; c >= mid; c--) {
      if (kids[c]!.parentNode) kids[c]!.parentNode!.removeChild(kids[c]!);
    }
    if (bodyFits(body)) {
      best = mid;
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return best;
}

/* Cut `container` (a breakable wrapper still attached in `body`) BEFORE its
 * `j`-th element child (j >= 1) and extract everything from there to end-of-body
 * as one fragment. `extractContents()` straddles the wrapper: children `0..j-1`
 * stay in the original `container`, while the fragment opens with a shallow clone
 * of the wrapper holding children `j..end`, followed by any trailing top-level
 * blocks. Tags the head wrapper `SPLIT_HEAD_CLASS` and the cloned tail wrapper
 * `SPLIT_CONTINUATION_CLASS` — same hooks the word-split path stamps so CSS can
 * undo first-face-only wrapper decorations. Returns the fragment, or null when
 * `j` is out of range (nothing to move). */
function splitContainerAtChild(
  body: HTMLElement,
  container: Element,
  j: number
): DocumentFragment | null {
  const kids = breakableChildren(container);
  if (j < 1 || j >= kids.length) return null;
  // Honour the keep markers at this boundary, exactly as `breakChildBoundary`
  // does at its own. Any block-level container is breakable, so the heading
  // above a list usually sits INSIDE the container — a note's section wrapper
  // holds the lot — where `keepMarkerBoundary`, which sees top-level blocks
  // only, cannot reach it; without this the cut lands right after the heading
  // and strands it (measured: 26 stranded headings across a spell deck).
  const cut = pullBackForKeepMarkers(body, kids[j]!);
  const straddled = container.contains(cut) && cut !== container;
  const range = docOf(body).createRange();
  range.selectNodeContents(body);
  range.setStartBefore(cut);
  const fragment = range.extractContents();
  // Only tag when the container really was cut in half; a pull-back that landed
  // outside it moved the whole thing, and neither half is a continuation.
  if (straddled) container.classList.add(SPLIT_HEAD_CLASS);
  const tailEl = straddled ? fragment.firstElementChild : null; // the cloned tail wrapper
  if (tailEl) tailEl.classList.add(SPLIT_CONTINUATION_CLASS);
  // A split TABLE leaves its `<thead>` behind: the header lies before the cut,
  // so `extractContents` never reaches it and the continuation table would show
  // unlabelled columns. Repeat it at the top of the tail — the one thing a
  // paginated table needs that a paginated `<div>` list does not. Only when the
  // table really was straddled; a pull-back that moved it whole needs no repair.
  if (straddled) repeatTableHead(container, fragment);
  return fragment;
}

/* Attempt a child-boundary split of the breakable container at top-level block
 * index `k`. Returns the tail fragment (prefix blocks + the container's first
 * fitting children stay; the rest + trailing blocks flow), or null when not even
 * one child fits alongside the prefix — leaving the caller to move the whole
 * container (k >= 1) or word-split inside the first item (k === 0). Resets `body`
 * to pristine before measuring and before the committed cut so block indices are
 * read off the live DOM. */
function trySplitBreakableContainer(
  body: HTMLElement,
  originalHTML: string,
  k: number
): DocumentFragment | null {
  body.innerHTML = originalHTML;
  let container = topLevelBlocks(body)[k];
  if (!container) return null;
  const childCount = breakableChildren(container).length;
  if (childCount < 2) return null;
  const j = largestChildPrefixThatFits(body, originalHTML, k, childCount);
  if (j < 1) return null;
  body.innerHTML = originalHTML;
  container = topLevelBlocks(body)[k]!;
  return splitContainerAtChild(body, container, j);
}

/* Move overflowing content from `srcBody` into `dstContainer` — BLOCK-AWARE.
 *
 * Preconditions: `srcBody` already has FontScaler applied (transform + width +
 * height stretch). The body's content overflows at the current scale (caller
 * has verified `scrollHeight > clientHeight`).
 *
 * The natural breakpoints are BETWEEN the body's top-level blocks. The
 * algorithm:
 *   1. Keeps the largest prefix of WHOLE blocks that fit (`k`).
 *   2. Looks at the first block that doesn't fit whole — the boundary block
 *      `B = blocks[k]`. If `B` is atomic (keep-together / media / ≤1 word /
 *      table) it is moved WHOLE to the tail along with every following block.
 *      Only when `B` is splittable multi-word prose is it word-split, keeping
 *      as many of its leading words as fit and flowing the remainder.
 *   3. A single Range from the chosen start to end-of-body extracts the
 *      tail-of-B (when split) plus all trailing whole blocks in one fragment.
 *
 * So a wrapped part (e.g. a names table) stays on the current face if IT fits,
 * and only moves as a whole if IT does not — it is never dragged across the
 * boundary just because some later block (an image) doesn't fit.
 *
 * Returns `{ moved: 0/1, remainsClipped: bool }`. `remainsClipped: true` means
 * even a near-empty face can't hold the first block (pathological — an
 * oversized atomic block at the body start); the caller's spawn loop then
 * stops rather than looping forever.
 *
 * The body's own inline styles (transform / width / height / min-height) are
 * preserved across `innerHTML` resets because they live on the body element
 * itself, not on its children. */
export function moveOverflowChildren(
  srcBody: HTMLElement,
  dstContainer: HTMLElement
): MoveResult {
  if (srcBody.clientHeight <= 0) return { moved: 0, remainsClipped: false };

  // Locate the first EFFECTIVE forced card-break (any depth), consuming inert
  // leading markers. The marker may be nested inside a template's section wrapper,
  // so this is a subtree (querySelector) lookup, not a top-level-block index.
  const marker = firstEffectiveBreakMarker(srcBody);

  // Fast path: body already fits AND no forced break wants to cut it. A forced
  // card-break is honoured even when the content fits, so it bypasses this.
  if (!marker && bodyFits(srcBody)) return { moved: 0, remainsClipped: false };

  const originalHTML = srcBody.innerHTML;

  // Forced card-break: cut EXACTLY at the marker. Extract [marker … end-of-body]
  // into a fragment — `extractContents` straddles every ancestor between the
  // marker and the body, so the section wrapper is cloned: its pre-marker content
  // stays on this face, a fresh copy holding the post-marker content flows to the
  // tail. We commit only when the pre-marker remainder FITS; otherwise the
  // pre-marker content itself overflows, so we restore and fall through to the
  // normal overflow handling (which cuts before the marker — the marker rides
  // along in the tail to fire on a later face, preserving reading order).
  if (marker) {
    const brkRange = docOf(srcBody).createRange();
    brkRange.selectNodeContents(srcBody);
    brkRange.setStartBefore(marker);
    const brkTail = brkRange.extractContents();
    if (bodyFits(srcBody)) {
      // Drop the consumed marker itself (the first marker in the extracted tail).
      const brkLead = brkTail.querySelector(CARD_BREAK_SELECTOR);
      if (isForcedBreakMarker(brkLead) && brkLead!.parentNode)
        brkLead!.parentNode.removeChild(brkLead!);
      dstContainer.appendChild(brkTail);
      srcBody.classList.add(BODY_CONTINUES_CLASS);
      dstContainer.classList.add(BODY_CONTINUED_CLASS);
      return { moved: 1, remainsClipped: false };
    }
    srcBody.innerHTML = originalHTML; // pre-marker overflows — restore, fall through
  }

  const totalWords = countWords(srcBody);
  const blockCount = topLevelBlocks(srcBody).length;

  // 0 or 1 top-level block: no inter-block boundary exists. If the sole block is
  // a breakable container, paginate between its child items; otherwise fall back
  // to a whole-body word split (the behaviour for one big prose container).
  if (blockCount <= 1) {
    if (blockCount === 1 && isBreakableContainer(topLevelBlocks(srcBody)[0])) {
      let soleFragment = trySplitBreakableContainer(srcBody, originalHTML, 0);
      // The fill guard applies here as it does at a later boundary: a template
      // that wraps the whole body in one block sends every cut through this
      // path, and a clean break between the wrapper's children can leave the
      // face as empty as any other.
      soleFragment = fillGuard(
        srcBody,
        originalHTML,
        soleFragment,
        0,
        totalWords,
        true,
        function () {
          return trySplitBreakableContainer(srcBody, originalHTML, 0);
        }
      );
      if (soleFragment) {
        dstContainer.appendChild(soleFragment);
        srcBody.classList.add(BODY_CONTINUES_CLASS);
        dstContainer.classList.add(BODY_CONTINUED_CLASS);
        return { moved: 1, remainsClipped: false };
      }
      // Not even one child fits on an otherwise-empty face — fall through to the
      // word split, which cuts inside the first item (oversized-item fallback).
    }
    return wordSplitWholeBody(srcBody, dstContainer, originalHTML, totalWords);
  }

  // 1) Largest prefix of whole blocks that fit. k is in [0, blockCount-1] (the
  //    caller has verified the body overflows here — a forced break that fits was
  //    already committed above).
  const k = largestWholePrefixThatFits(srcBody, originalHTML, blockCount);

  // 2) Inspect the boundary block B = blocks[k] in a pristine state.
  srcBody.innerHTML = originalHTML;
  const blocks = topLevelBlocks(srcBody);
  const boundary = blocks[k];
  if (!boundary) {
    // Shouldn't happen (body overflows ⇒ k < blockCount), but stay safe.
    return { moved: 0, remainsClipped: false };
  }
  const atomic = isAtomicBlock(boundary);
  let prefixWords = 0;
  for (let pi = 0; pi < k; pi++) prefixWords += countWords(blocks[pi]!);
  const boundaryWords = countWords(boundary);

  let fragment: DocumentFragment | null = null;

  // A keep-together block is a container the splitter may not break inside,
  // however many blocks it holds: with content before it (k >= 1) it moves
  // whole, as its marker says. Only a marked block that LEADS the face is
  // paginated between its children — the last resort for a block larger than
  // a face, the same rule the word split and the keep climb follow.
  const keepWhole = k >= 1 && boundary.classList.contains("cf-keep-together");

  if (!keepWhole && isBreakableContainer(boundary)) {
    // Boundary is a breakable container: paginate between its child items —
    // keep the prefix blocks + the items that fit, flow the rest (+ trailing
    // blocks) to the next face. No mid-sentence cut, so the widow/orphan line
    // guard below is unnecessary (each item is whole).
    fragment = trySplitBreakableContainer(srcBody, originalHTML, k);
    // Same fill guard the word-split path uses. Breaking between children is
    // the DEFAULT, so most cuts arrive here, and an unguarded one can leave a
    // face nearly blank: a spell card's face 1/4 carrying two short stat lines
    // and empty for the remaining four fifths, because its oversized effect
    // paragraph moved whole to the next face.
    fragment = fillGuard(
      srcBody,
      originalHTML,
      fragment,
      prefixWords,
      boundaryWords,
      true,
      function () {
        return trySplitBreakableContainer(srcBody, originalHTML, k);
      }
    );
    if (!fragment && k >= 1) {
      // Not even one child fits alongside the prefix — move the whole container
      // (and trailing blocks) to the next face, where it recurses as a sole block.
      fragment = moveWholeBlockToEnd(srcBody, originalHTML, k);
    }
    // If still null (k === 0, no child fits even on an empty face) fall through to
    // the word-split path below, which cuts inside the first item.
  }

  if (!fragment) {
    if (k >= 1 && atomic) {
      // Keep the whole prefix; move the atomic boundary block + everything after
      // it, intact, to the next face. Guaranteed progress (B leaves this face).
      // `moveWholeBlockToEnd` honours cf-keep-with-next / cf-keep-with-prev: a
      // marked predecessor of the boundary travels with it instead of being
      // stranded as the last block, and a keep-with-prev boundary block pulls its
      // predecessor along.
      fragment = moveWholeBlockToEnd(srcBody, originalHTML, k);
    } else {
      // Splittable boundary, or k === 0 (not even the first whole block fits).
      // Word-split within the boundary block: keep prefix whole + first j words.
      let respectKeepTogether = true;
      let bestJ = maxBoundaryWordsThatFit(
        srcBody,
        originalHTML,
        prefixWords,
        boundaryWords,
        true
      );

      if (bestJ === 0 && k === 0) {
        // First block alone overflows a near-empty face. If it is a keep-together
        // unit larger than a whole card, force-split it (ignore keep-together) as
        // a last resort so the spawn loop makes progress instead of stalling.
        respectKeepTogether = false;
        bestJ = maxBoundaryWordsThatFit(
          srcBody,
          originalHTML,
          prefixWords,
          boundaryWords,
          false
        );
        if (bestJ === 0) {
          // Not even one word fits — clip on this face; stop the spawn loop.
          srcBody.innerHTML = originalHTML;
          return { moved: 0, remainsClipped: true };
        }
      } else if (bestJ === 0) {
        // k >= 1 and the boundary surrenders no words after the prefix (e.g. a
        // nested keep-together pushed the cut back). Move it whole instead.
        // `moveWholeBlockToEnd` resets to pristine first — required here, since the
        // preceding `maxBoundaryWordsThatFit` left `srcBody` trimmed — and honours
        // cf-keep-with-next / cf-keep-with-prev.
        fragment = moveWholeBlockToEnd(srcBody, originalHTML, k);
      }

      // Widow/orphan protection. If the committed cut would strand fewer than
      // MIN_SPLIT_LINES rendered lines on EITHER side — the head kept here (orphan)
      // or the tail moved on (widow) — move the WHOLE boundary block to the next
      // face instead. Only when a non-empty prefix stays (k >= 1, so this face
      // isn't emptied) and the block fits whole on a fresh face (so it won't just
      // be re-split there). A genuinely oversized block (doesn't fit alone) or the
      // keep-together last-resort path falls through to the normal word-split.
      if (
        !fragment &&
        bestJ > 0 &&
        k >= 1 &&
        respectKeepTogether &&
        blockFitsOnFreshFace(srcBody, originalHTML, k)
      ) {
        srcBody.innerHTML = originalHTML;
        trimBodyToFirstNWords(srcBody, prefixWords + bestJ, true);
        const headLines = countBlockLines(topLevelBlocks(srcBody)[k]);
        // Whole-block line count, measured in isolation (same width as in context).
        srcBody.innerHTML = originalHTML;
        const isoBlocks = topLevelBlocks(srcBody);
        for (let ib = isoBlocks.length - 1; ib >= 0; ib--) {
          if (ib !== k && isoBlocks[ib]!.parentNode)
            isoBlocks[ib]!.parentNode!.removeChild(isoBlocks[ib]!);
        }
        const totalLines = countBlockLines(topLevelBlocks(srcBody)[0]);
        const tailLines = Math.max(1, totalLines - headLines);
        if (headLines < MIN_SPLIT_LINES || tailLines < MIN_SPLIT_LINES) {
          fragment = moveWholeBlockToEnd(srcBody, originalHTML, k);
        }
      }

      if (!fragment) {
        srcBody.innerHTML = originalHTML;
        fragment = trimBodyToFirstNWords(
          srcBody,
          prefixWords + bestJ,
          respectKeepTogether
        );
        // Fill guard: a child-boundary pull-back that collapses the head is
        // not worth its clean boundary (see MIN_FACE_FILL). Re-run the search with
        // the pull-back off and keep whichever fills the face better. Costs a
        // second binary search only on the faces that actually collapsed.
        fragment = fillGuard(
          srcBody,
          originalHTML,
          fragment,
          prefixWords,
          boundaryWords,
          respectKeepTogether,
          function () {
            srcBody.innerHTML = originalHTML;
            return trimBodyToFirstNWords(
              srcBody,
              prefixWords + bestJ,
              respectKeepTogether
            );
          }
        );
      }
    }
  }

  if (!fragment) {
    srcBody.innerHTML = originalHTML;
    return { moved: 0, remainsClipped: false };
  }

  dstContainer.appendChild(fragment);
  // Flag the pagination relationship so CSS can undo first-face-only positioning
  // on the continuation (e.g. bottom-anchored content flowing to the top of the
  // next face). Classes live on the body elements, so they survive the
  // `innerHTML` resets above (which only touch children) and the destination
  // carries `cf-body-continued` before the caller measures it.
  srcBody.classList.add(BODY_CONTINUES_CLASS);
  dstContainer.classList.add(BODY_CONTINUED_CLASS);
  return { moved: 1, remainsClipped: false };
}

/* Keep a committed cut only while it fills enough of the face.
 *
 * A clean boundary is worth a little empty space and not a lot: pushing a whole
 * oversized paragraph to the next face is right when it costs a line or two and
 * wrong when it costs a third of the page. Below `MIN_FACE_FILL` this re-cuts
 * with the child-boundary pull-back switched OFF — a word-level cut, which can
 * always fill the face — and keeps whichever of the two fills more. `redo`
 * restores the original fragment when the flat cut turns out no better, since
 * both attempts leave `srcBody` trimmed.
 *
 * Costs a second binary search only on the faces that actually collapsed. */
function fillGuard(
  srcBody: HTMLElement,
  originalHTML: string,
  fragment: DocumentFragment | null,
  prefixWords: number,
  boundaryWords: number,
  respectKeepTogether: boolean,
  redo: () => DocumentFragment | null
): DocumentFragment | null {
  if (!fragment || faceFill(srcBody) >= MIN_FACE_FILL) return fragment;
  const wholeFill = faceFill(srcBody);
  const flatJ = maxBoundaryWordsThatFit(
    srcBody,
    originalHTML,
    prefixWords,
    boundaryWords,
    respectKeepTogether,
    false
  );
  srcBody.innerHTML = originalHTML;
  const flat =
    flatJ > 0
      ? trimBodyToFirstNWords(srcBody, prefixWords + flatJ, respectKeepTogether, false)
      : null;
  if (flat && faceFill(srcBody) > wholeFill) return flat;
  srcBody.innerHTML = originalHTML;
  return redo();
}

/* Extract the block at index `k` (recomputed fresh) through end-of-body as one
 * fragment — used to move an atomic boundary block plus all trailing blocks
 * intact. No `SPLIT_*` tagging: no wrapper is straddled. */
function extractFromBlockToEnd(body: HTMLElement, k: number): DocumentFragment | null {
  const blocks = topLevelBlocks(body);
  if (k >= blocks.length) return null;
  const range = docOf(body).createRange();
  range.selectNodeContents(body);
  range.setStartBefore(blocks[k]!);
  return range.extractContents();
}

/* Keep-marker pull-back. Given a clean WHOLE-BLOCK boundary at index `k`
 * (k >= 1; blocks[0..k-1] stay on the face, blocks[k..] move to the tail intact),
 * walk the boundary backwards while EITHER of the two symmetric "keep" markers
 * straddles the cut:
 *
 *   - `cf-keep-with-next` on the LAST STAYING block (blocks[m-1]) — the analogue
 *     of Word's "Keep with next": a marked block is never left as the last block
 *     on a face while its successor is pushed entirely to the next face. A
 *     HEADING binds this way with no marker (see `bindsToNext` / `isHeading`).
 *   - `cf-keep-with-prev` on the FIRST MOVING block (blocks[m]) — the mirror
 *     image: a marked block (a filler / border / ornament that must sit directly
 *     below the element above it) never becomes the first block on a continuation
 *     face while its predecessor stays behind; instead the predecessor is pulled
 *     along so the pair travels together.
 *
 * Both markers reduce the boundary by one and can interleave (a pull-back that
 * satisfies one marker can expose a fresh block that triggers the other), so a
 * single loop handles both. Stops at m = 1: it never pulls back to 0 (that would
 * empty the face), so a marker that can only be honoured by emptying the face is
 * a no-op, accepted as a last resort, mirroring the keep-together fallback.
 *
 * Requires `body` in its PRISTINE state (block indices read off the live DOM).
 * Both markers only fire at whole-block boundaries: in the word-split path the
 * intent is already satisfied — a keep-with-next predecessor is immediately
 * followed on the SAME face by the boundary block's surviving head, and a
 * keep-with-prev block lands directly beneath the boundary block's tail on the
 * continuation face. Returns the adjusted boundary index in [1, k]. */
export function keepMarkerBoundary(body: Node, k: number): number {
  if (k < 1) return k;
  const blocks = topLevelBlocks(body);
  let m = k;
  while (m >= 2) {
    const stayingLast = blocks[m - 1]; // last block remaining on this face
    const movingFirst = blocks[m]; // first block moving to the tail
    const pull = bindsToNext(stayingLast) || bindsToPrev(movingFirst);
    if (pull) {
      m--;
    } else {
      break;
    }
  }
  return m;
}

/* Move the block at index `k` (k >= 1) through end-of-body to the tail as one
 * intact fragment, honouring cf-keep-with-next / cf-keep-with-prev. Resets
 * `body` to pristine first so both `topLevelBlocks` lookups — `keepMarkerBoundary`'s
 * and `extractFromBlockToEnd`'s — see correct indices (some callers reach this
 * with `body` left trimmed by a prior binary search). */
function moveWholeBlockToEnd(
  body: HTMLElement,
  originalHTML: string,
  k: number
): DocumentFragment | null {
  body.innerHTML = originalHTML;
  return extractFromBlockToEnd(body, keepMarkerBoundary(body, k));
}

/* Whole-body word split — the path for a body with 0 or 1 top-level block (one
 * big prose container, or a single oversized atomic block). Binary-searches the
 * max N words that fit, with the keep-together last-resort retry. Returns the
 * same shape as `moveOverflowChildren`. */
function wordSplitWholeBody(
  srcBody: HTMLElement,
  dstContainer: HTMLElement,
  originalHTML: string,
  totalWords: number
): MoveResult {
  if (totalWords === 0) {
    return { moved: 0, remainsClipped: true };
  }

  const MAX_ITER = 16;
  let best = 0;
  let respectKeepTogether = true;

  for (let attempt = 0; attempt < 2; attempt++) {
    let lo = 0;
    let hi = totalWords;
    best = 0;

    for (let iter = 0; iter < MAX_ITER && lo < hi; iter++) {
      const mid = Math.floor((lo + hi + 1) / 2);
      srcBody.innerHTML = originalHTML;
      trimBodyToFirstNWords(srcBody, mid, respectKeepTogether);
      if (bodyFits(srcBody)) {
        best = mid;
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }

    if (best > 0 || !respectKeepTogether) break;
    respectKeepTogether = false; // last-resort retry: allow splitting it
  }

  srcBody.innerHTML = originalHTML;

  if (best === 0) {
    return { moved: 0, remainsClipped: true };
  }
  if (best >= totalWords) {
    return { moved: 0, remainsClipped: false };
  }

  const fragment = trimBodyToFirstNWords(srcBody, best, respectKeepTogether);
  if (!fragment) {
    return { moved: 0, remainsClipped: false };
  }

  dstContainer.appendChild(fragment);
  srcBody.classList.add(BODY_CONTINUES_CLASS);
  dstContainer.classList.add(BODY_CONTINUED_CLASS);
  return { moved: 1, remainsClipped: false };
}

/* Strategy: render the front template a second time AS the back, then move
 * the front body's tail into the cloned back's .card-body-scalable.
 *
 *   - Returns the newly-created back .card-root on success, so the caller can
 *     re-scale its body to the locked groupScale.
 *   - Returns null on failure (no frontHtml, no backRoot, no body, or nothing
 *     could be moved); caller falls back to "warn" or to overflow-cards
 *     depending on strategy.
 *
 * The cloned back inherits the front's `.card-front` class — that's
 * intentional: it lets relayoutGroup() pick up the cloned body for re-scaling
 * the same as a real front body. The strategy is signalled instead by the
 * extra marker class `.cf-overflow-back-as-front` on the new card-root, a
 * template/system CSS hook (no plugin-default rules ship). */
function splitIntoBackAsFront(
  frontBody: HTMLElement,
  backRoot: HTMLElement | null,
  frontHtml: string
): HTMLElement | null {
  if (!backRoot) return null;
  if (!frontHtml) return null;
  const parent = backRoot.parentElement;
  if (!parent) return null;

  // Snapshot the original back BEFORE mutating, so the whole operation is
  // transactional: if nothing actually flows into the clone we restore the
  // pristine back instead of leaving an emptied front-clone face committed.
  // This guards the marginal case where the caller's trigger check flagged the
  // front body as clipped at the font floor but `moveOverflowChildren` — using
  // the +1px-tolerant `bodyFits` — sees the body as fitting and moves nothing.
  const originalBackHtml = backRoot.outerHTML;

  // Replace the back's card-root with a fresh copy of the front HTML.
  // outerHTML reassignment detaches the old node and parses the new HTML in
  // place, so the parent now holds the cloned front structure.
  backRoot.outerHTML = frontHtml;
  const newBackRoot = parent.querySelector<HTMLElement>(".card-root");
  if (!newBackRoot) return null;

  newBackRoot.classList.add(OVERFLOW_BACK_AS_FRONT_CLASS);

  const newBackBody = newBackRoot.querySelector<HTMLElement>(".card-body-scalable");
  if (!newBackBody) {
    newBackRoot.outerHTML = originalBackHtml;
    return null;
  }

  // Clear the duplicated body, then move the front body's tail into it.
  newBackBody.innerHTML = "";
  const moved = moveOverflowChildren(frontBody, newBackBody);
  if (moved.moved === 0) {
    // Nothing flowed onto the clone — roll back to the pristine back face so a
    // marginal (sub-pixel) overflow can't strand an empty continuation face.
    newBackRoot.outerHTML = originalBackHtml;
    return null;
  }
  return newBackRoot;
}

/* Apply a forced body scale to `bodyEl`. Bypasses the FontScaler's binary
 * search — used by `scaleAndSplitInDom` to lock every body in an overflow
 * group to the same scale as the first (clipped-at-min) card so the group
 * reads as one paginated sheet instead of cards with mismatched font sizes.
 *
 * Stretches the body's layout box (both width and height) by 1/scale so
 * that after `transform: scale(s)` from top-left, the visible body fills
 * the container's content area — without the stretch the body renders
 * at only `parent.height * s` tall, leaving a visible empty band between
 * the body and the footer (or the card edge).
 *
 * For this to layout cleanly the footer is a flex sibling of
 * `.card-content-container` under `.card-root` (the header → body → footer
 * convention; see base-card.css `.card-footer`). The container's flex slot is
 * fixed by `.card-root`'s flex distribution, so the body's stretch is absorbed
 * WITHIN the container (its `overflow: hidden`, lifted to `visible` here) and
 * never reaches the footer. The card-root's `overflow: hidden` clips the body's
 * pre-transform layout overflow; visually the body fills its slot
 * edge-to-edge.
 *
 * Returns true if the body's content still overflows its stretched
 * layout box at the forced scale. */
function applyForcedBodyScale(bodyEl: HTMLElement, scale: number): boolean {
  if (!(scale > 0)) return false;
  bodyEl.style.transform = "";
  bodyEl.style.width = "";
  bodyEl.style.height = "";
  bodyEl.style.minHeight = "";
  bodyEl.style.transformOrigin = "top left";
  if (bodyEl.parentElement) bodyEl.parentElement.style.overflow = "visible";
  const inv = (100 / scale).toFixed(2) + "%";
  bodyEl.style.width = inv;
  // Stretch the layout box main-axis. `height` alone is ignored by flex
  // (base CSS sets `flex: 1 1 0` which forces flex-basis: 0); `min-height`
  // is a hard floor flex layout respects. Set both for cross-browser
  // robustness.
  bodyEl.style.height = inv;
  bodyEl.style.minHeight = inv;
  bodyEl.style.transform = "scale(" + scale + ")";
  if (bodyEl.clientHeight <= 0) return false;
  return bodyEl.scrollHeight > bodyEl.clientHeight + 1;
}

/* Re-apply the locked group scale to every FRONT body in the root and
 * re-run title scaling. Used after marker/hint population so titles re-fit
 * their (potentially widened) headers without disturbing the body's
 * forced scale.
 *
 * Back-face bodies are deliberately NOT touched — they were sized by the
 * initial `scaleRoot` pass to fit their own content (typically a back
 * graphic / system logo) and shouldn't be shrunk just because the front
 * has overflow. */
function relayoutGroup(root: ShadowRoot | HTMLElement, groupScale: number): boolean {
  scaleTitlesInRoot(root);
  const bodies = root.querySelectorAll<HTMLElement>(
    ".card-root.card-front .card-body-scalable"
  );
  let anyClipped = false;
  for (let i = 0; i < bodies.length; i++) {
    if (applyForcedBodyScale(bodies[i]!, groupScale)) anyClipped = true;
  }
  return anyClipped;
}

/* The state one `performSplit` pass leaves behind: the faces it committed, in
 * print order, and whether the last of them still clips. */
interface SplitState {
  /** Physical cards: fronts (the back is the same card's other face). */
  cardCount: number;
  clipped: boolean;
  /** The committed `.card-root`s, in print order. */
  markerTargets: HTMLElement[];
  /** The designed back a parity run detaches, for `odd` to re-append. */
  detachedBack: HTMLElement | null;
}

/* A candidate's committed split at its committed scale. */
interface SplitOutcome {
  st: SplitState;
  scale: number;
  /** Physical card count, the `printed-cards` metric. */
  printedCards: number;
}

/* A rendered candidate as the comparator consumes it. */
type GroupRun = SplitOutcome & CfCandidateRun;

/* The splitter's entry point. Runs the font scaler on the host, and — when the
 * front body clips at the floor or carries a forced break, in a spawning mode
 * — paginates it: the back-as-front clone, spawned cards, the parity pad, one
 * scale locked across the group and grown back up to fill the faces, the
 * candidate loop when a set has more than one way to lay the card out, and the
 * markers a stylesheet keys on.
 *
 * Inputs:
 *   - root: the host — a shadow root or element holding one `.cf-face` per
 *     face in print order, the front first.
 *   - opts: the mode, the candidate set with its decision rule, and the
 *     pristine front HTML the continuation faces are cloned from.
 *
 * Mutates the host: may append further `.cf-face` siblings so it holds every
 * output face, front and back.
 *
 * Returns `{ clipped, cardCount }`. `clipped` is true if the splitter ran out
 * of room before everything fit (the caller surfaces the "content clipped"
 * warning). `cardCount` is the number of front faces produced (original +
 * overflow). */
export function scaleAndSplitInDom(
  root: ShadowRoot | HTMLElement,
  opts: OverflowSplitOptions
): OverflowSplitResult {
  const mode = opts.mode;
  const frontHtml = opts.frontHtml;
  const layoutCfg = opts.layout;
  const candidates = layoutCfg.layouts;
  const decision = layoutCfg.decision;
  const fallbackCandidate = pickFallback(candidates);
  // The candidate whose render is currently committed (for finalize re-stamp).
  let committedCandidate = fallbackCandidate;
  // The candidate currently being RENDERED (read by performSplit to re-stamp its
  // class after each pristine restore) and whether that candidate forces parity
  // pagination. Both are updated by renderCandidate / splitWithParity / splitAny.
  let currentCandidate = fallbackCandidate;
  let parityForce = false;

  // Stamp the fallback candidate's `.cf-layout-<name>` on every card-root BEFORE
  // any measurement. The candidate loop re-stamps the winning candidate's class;
  // non-overflowing cards keep this fallback stamp.
  stampLayout(root, fallbackCandidate);

  // First pass: scale the original card; check clipping on the front body.
  // (For element-size candidates this also makes the per-card pick in
  // processBody — re-decided at group level below if the card overflows.)
  // Detect a forced card-break once, before scaling/splitting consumes anything.
  // Reused by the entry gate AND by `splitAny`: when a break (not genuine
  // overflow) caused the split, each face is capped BEFORE it fills, so the
  // group must grow the font UP from the un-split min-scale floor to fill the
  // available space on every face.
  const hasForcedBreak = rootHasForcedBreak(root);
  const firstClipped = scaleRoot(root, layoutCfg);
  // A forced card-break (`%% card-break %%`) takes the split path even when the
  // content fits at the current scale — but only in a spawning mode, so `none`
  // (clip, never spawn) still bails first and the break is inert there.
  if (mode === "none" || (!firstClipped && !hasForcedBreak)) {
    // No split: the single front is page 1 of 1.
    applyFrontFaceMarkers(root.querySelectorAll<HTMLElement>(".card-root"));
    return { clipped: firstClipped, cardCount: 1 };
  }

  // Pull the original front + back faces.
  const faces = root.querySelectorAll<HTMLElement>(FACE_SELECTOR);
  if (faces.length === 0) {
    return { clipped: firstClipped, cardCount: 1 };
  }
  const container = faces[0]!.parentElement;
  if (!container) {
    return { clipped: firstClipped, cardCount: 1 };
  }

  const originalFront = faces[0]!;

  const originalFrontRoot = originalFront.querySelector<HTMLElement>(".card-root");
  const originalFrontBody = originalFrontRoot
    ? originalFrontRoot.querySelector<HTMLElement>(".card-body-scalable")
    : null;
  if (!originalFrontBody) {
    return { clipped: firstClipped, cardCount: 1 };
  }

  // Capture the first card's scale. Because firstClipped=true here, the
  // FontScaler converged at the min-scale floor. This is the BASELINE scale:
  // every card in the overflow group is locked to it so the group reads as one
  // paginated sheet. The fill pass (below) may raise it. A body that fits and
  // is here only for its forced break carries no transform; its floor is the
  // baseline then, and the fill grows it back up.
  let minScale = readScaleFromTransform(originalFrontBody);
  if (!(minScale > 0)) minScale = resolveBodyMinScale(originalFrontBody);

  // Snapshot the pristine (post-FontScaler, pre-split) container so the split
  // can be re-simulated at different scales. Titles' inline font-sizes and the
  // bodies' min-scale transforms are serialized into the HTML, so restoring it
  // reproduces the measured starting state without re-running title scaling.
  const pristineHTML = container.innerHTML;

  /* Run the resolved strategy with every body locked to `scale`, producing the
   * full overflow group (parity front-only pagination, back-injection, or
   * spawned overflow cards) but NO finalization (parity padding / markers /
   * relayout — those run once, after the committed scale is chosen).
   *
   * `needRestore`: when true the container is first reset to `pristineHTML` and
   * all node refs re-queried (used for re-simulation at trial scales).
   *
   * Returns the split state: `cardCount` counts physical cards (fronts; the
   * back is the same card's other face), `markerTargets` the committed roots in
   * print order. */
  function performSplit(scale: number, needRestore: boolean): SplitState {
    if (needRestore) container!.innerHTML = pristineHTML;

    // Re-stamp the rendering candidate's `.cf-layout-<name>`. A restore resets
    // the roots to the pristine snapshot's classes, and each candidate renders
    // under its own class (which conditional CSS keys on), so it must be
    // re-applied here BEFORE measuring. Clones/pads spawned below inherit it via
    // `innerHTML`; finalizeGroup re-asserts it on the final committed group.
    stampLayout(root, currentCandidate);

    const pcs = container!.querySelectorAll<HTMLElement>(FACE_SELECTOR);
    const oFront = pcs[0] || null;
    const oBack = pcs.length > 1 ? pcs[1]! : null;
    const oFrontRoot = oFront ? oFront.querySelector<HTMLElement>(".card-root") : null;
    const oBackRoot = oBack ? oBack.querySelector<HTMLElement>(".card-root") : null;
    const oFrontBody = oFrontRoot
      ? oFrontRoot.querySelector<HTMLElement>(".card-body-scalable")
      : null;
    // The PRISTINE designed back, captured before back-injection mutates `oBack`
    // into a back-as-front content clone. Spawned "then-cards" use this for their
    // (content-less) backs — cloning the mutated `oBack` would duplicate the
    // injected back's body onto every spawned card's back.
    const pristineBackInner = oBack ? oBack.innerHTML : null;

    const st: SplitState = {
      cardCount: 1,
      clipped: true,
      markerTargets: oFrontRoot ? [oFrontRoot] : [],
      detachedBack: null,
    };
    if (!oFront || !oFrontRoot || !oFrontBody) return st;

    // Reserve the CSS "X / N" counter's header space before any body
    // measurement (see reserveOverflowCounter). Clones spawned below inherit
    // the activation class + placeholder props via `innerHTML`; the
    // back-as-front clone (built from the `frontHtml` string, which carries
    // neither) is reserved explicitly when created.
    reserveOverflowCounter(oFrontRoot);

    // Lock the original front body to the trial scale before any
    // measuring/splitting so moveOverflowChildren sees this scale's layout.
    st.clipped = applyForcedBodyScale(oFrontBody, scale);

    // --- Parity pagination: content on FRONT faces only (front-face-count) ---
    // Only for `back-then-cards` with a parity candidate. Detach the real back
    // and paginate body content across cloned-front faces (never consuming the
    // real back). This produces the NATURAL front-page count at `scale`; the
    // parity pad (to odd/even) and the real-back re-append (odd only) happen
    // post-commit in finishParity(). The detached back node is stashed on
    // `st.detachedBack` so finishParity can re-append it for the "odd" case.
    if (parityForce) {
      const realBackCell = oBack;
      if (realBackCell && realBackCell.parentNode) {
        realBackCell.parentNode.removeChild(realBackCell);
      }
      st.detachedBack = realBackCell || null;

      let fbSource = oFrontBody;
      let fbIter = 0;
      // Continue while the source clips OR still carries an unconsumed forced
      // card-break (so a manual break paginates onto another front face).
      while (
        (st.clipped || bodyHasForcedBreak(fbSource)) &&
        fbIter < MAX_OVERFLOW_CARDS
      ) {
        fbIter++;
        const fbFront = oFront.cloneNode(false) as HTMLElement;
        fbFront.innerHTML = oFront.innerHTML;
        container!.appendChild(fbFront);

        const fbFrontRoot = fbFront.querySelector<HTMLElement>(".card-root");
        const fbFrontBody = fbFrontRoot
          ? fbFrontRoot.querySelector<HTMLElement>(".card-body-scalable")
          : null;
        if (!fbFrontRoot || !fbFrontBody) {
          fbFront.remove();
          break;
        }
        reserveOverflowCounter(fbFrontRoot);

        fbFrontBody.innerHTML = "";
        const fbMoved = moveOverflowChildren(fbSource, fbFrontBody);
        if (fbMoved.moved === 0) {
          fbFront.remove();
          break;
        }

        st.markerTargets.push(fbFrontRoot);
        st.cardCount++;

        applyForcedBodyScale(fbSource, scale);
        st.clipped = applyForcedBodyScale(fbFrontBody, scale);
        // Advance the source; the while condition re-checks clip + remaining
        // forced break on the new face, ending the loop naturally when neither holds.
        fbSource = fbFrontBody;
      }

      return st;
    }

    // --- Back-injection (back-then-cards): clone front onto the back ----
    // Gated on st.clipped: only inject when the front body actually overflows
    // at the LOCKED scale. The initial trigger check (scaleOneBody) and this
    // locked-scale check (applyForcedBodyScale) measure in the same
    // stretched-box frame (`scrollHeight > clientHeight + 1`) but at different
    // scales, so the gate stays: injecting unconditionally clones the front
    // onto a back that then receives no content (splitIntoBackAsFront rolls
    // back, but skipping the call entirely is cheaper and clearer).
    // The body the spawn loop continues paginating FROM. Default: the front
    // body (extra-cards, or a back-injection that didn't happen). When the back
    // injection succeeds, the front's tail now lives on the BACK face, so any
    // further overflow (a back that itself needs another page — e.g. a large
    // post-`%% card-break %%` chunk lands on the back) must spill from the back,
    // not the now-fitting front.
    let spawnSource = oFrontBody;
    if (mode === "back-then-cards" && (st.clipped || bodyHasForcedBreak(oFrontBody))) {
      const nbRoot = splitIntoBackAsFront(oFrontBody, oBackRoot, frontHtml);
      if (nbRoot) {
        reserveOverflowCounter(nbRoot);
        st.clipped = applyForcedBodyScale(oFrontBody, scale);
        const nbBody = nbRoot.querySelector<HTMLElement>(".card-body-scalable");
        if (nbBody) {
          if (applyForcedBodyScale(nbBody, scale)) st.clipped = true;
          spawnSource = nbBody; // continue paginating from the back
        }
        st.markerTargets.push(nbRoot);
      }
    }

    // --- Overflow-card spawning ----------------------------------------
    const spawnStrategy = mode === "extra-cards" || mode === "back-then-cards";
    if (spawnStrategy && (st.clipped || bodyHasForcedBreak(spawnSource))) {
      let sourceBody = spawnSource;
      let iter = 0;
      // Keep spawning faces while the source still clips OR still carries an
      // unconsumed forced card-break.
      while (
        (st.clipped || bodyHasForcedBreak(sourceBody)) &&
        iter < MAX_OVERFLOW_CARDS
      ) {
        iter++;
        const newFront = oFront.cloneNode(false) as HTMLElement;
        newFront.innerHTML = oFront.innerHTML;
        const newBack = oBack ? (oBack.cloneNode(false) as HTMLElement) : null;
        if (newBack && pristineBackInner !== null) newBack.innerHTML = pristineBackInner;

        container!.appendChild(newFront);
        if (newBack) container!.appendChild(newBack);

        const newFrontRoot = newFront.querySelector<HTMLElement>(".card-root");
        const newFrontBody = newFrontRoot
          ? newFrontRoot.querySelector<HTMLElement>(".card-body-scalable")
          : null;
        if (!newFrontRoot || !newFrontBody) break;
        reserveOverflowCounter(newFrontRoot);

        // Clear the destination body, then run the word-level binary-search
        // cut. The footer lives OUTSIDE `.card-body-scalable` (a flex sibling
        // of the content container), so cloning the original front carries it along.
        newFrontBody.innerHTML = "";
        const moveResult = moveOverflowChildren(sourceBody, newFrontBody);
        if (moveResult.moved === 0) {
          // Couldn't free any room (single oversized child). Drop + stop.
          newFront.remove();
          if (newBack) newBack.remove();
          break;
        }

        st.markerTargets.push(newFrontRoot);
        st.cardCount++;

        // Lock both bodies (sourceBody was reset by moveOverflowChildren).
        applyForcedBodyScale(sourceBody, scale);
        st.clipped = applyForcedBodyScale(newFrontBody, scale);
        // Advance the source; the while condition re-checks both clip and a
        // remaining forced break on this new face, so the loop ends naturally
        // when neither holds.
        sourceBody = newFrontBody;

        // Fill THIS card's back before spawning another card. `back-then-cards`
        // promises a note becomes one physical card where it can — an over-long
        // front spills onto the back before a second card appears — and the
        // promise holds for every card, not only the first. Were each further
        // card to get a pristine designed back, a long note would print
        // front/back/front/LOGO/front: the reader hits a blank back mid-note and
        // the deck spends a whole card side on nothing — a three-face body
        // costing three physical cards where two would do.
        //
        // `extra-cards` deliberately does NOT do this — there the mode's whole
        // meaning is that content stays on fronts — hence the mode check.
        if (
          mode === "back-then-cards" &&
          newBack &&
          (st.clipped || bodyHasForcedBreak(newFrontBody))
        ) {
          const sbRoot = splitIntoBackAsFront(
            newFrontBody,
            newBack.querySelector<HTMLElement>(".card-root"),
            frontHtml
          );
          if (sbRoot) {
            reserveOverflowCounter(sbRoot);
            st.clipped = applyForcedBodyScale(newFrontBody, scale);
            const sbBody = sbRoot.querySelector<HTMLElement>(".card-body-scalable");
            if (sbBody) {
              if (applyForcedBodyScale(sbBody, scale)) st.clipped = true;
              sourceBody = sbBody; // keep paginating from this card's back
            }
            st.markerTargets.push(sbRoot);
          }
        }
      }
    }

    return st;
  }

  /* True if any committed face in `st` still holds an UNCONSUMED forced break —
   * a marker that rode along to a later face because the pre-marker content
   * overflowed at the trial scale instead of being honoured exactly. The font
   * fill uses this to STOP growing before a forced break would be relocated:
   * growing the font may make a break's leading chunk overflow its face, at
   * which point the splitter falls back to a natural cut elsewhere and strands
   * the marker — visibly moving the author's break. Rejecting such trials caps
   * the scale at the largest size where every break is still honoured exactly. */
  function groupHasUnconsumedBreak(st: SplitState): boolean {
    const t = st.markerTargets;
    for (let i = 0; i < t.length; i++) {
      const body = t[i]!.querySelector<HTMLElement>(".card-body-scalable");
      if (body && bodyHasForcedBreak(body)) return true;
    }
    return false;
  }

  /* Pad a committed parity group's front pages up to `targetP` with blank
   * front-chrome clones (empty body), then — for `parity === "odd"` — re-append
   * the detached designed back as the final face so the total face count
   * stays even and pairs cleanly 2-by-2 for duplex. `even` leaves the detached
   * back dropped. `parity` is the concrete parity of THIS run. Updates
   * `st.cardCount` (front-face count) and `st.markerTargets` (front pages, then
   * the real back for odd). */
  function finishParity(
    st: SplitState,
    scale: number,
    targetP: number,
    parity: "odd" | "even"
  ): void {
    const frontTemplate = container!.querySelector<HTMLElement>(FACE_SELECTOR);
    while (st.cardCount < targetP && frontTemplate) {
      const pad = frontTemplate.cloneNode(false) as HTMLElement;
      pad.innerHTML = frontTemplate.innerHTML;
      container!.appendChild(pad);
      const padRoot = pad.querySelector<HTMLElement>(".card-root");
      const padBody = padRoot
        ? padRoot.querySelector<HTMLElement>(".card-body-scalable")
        : null;
      if (padBody) {
        padBody.innerHTML = "";
        applyForcedBodyScale(padBody, scale);
      }
      if (padRoot) st.markerTargets.push(padRoot);
      st.cardCount++;
    }
    if (parity === "odd" && st.detachedBack) {
      container!.appendChild(st.detachedBack);
      const backRoot = st.detachedBack.querySelector<HTMLElement>(".card-root");
      if (backRoot) st.markerTargets.push(backRoot);
    }
  }

  /* Finalize a committed split group at `scale`: stamp layout + overflow-state
   * + front-face markers (which also publish the inherited `--cf-front-*`
   * page-number custom properties the CSS counter reads), then re-run the
   * title/body relayout. Mutates `st` (may flip `st.clipped`). Runs exactly once
   * per committed result. The image-slot choice is already baked in by the
   * committed candidate's `.cf-layout-*` class (no per-face re-pick needed). */
  function finalizeGroup(st: SplitState, scale: number): void {
    // Re-assert the committed candidate's `.cf-layout-<name>` hook on every
    // card-root (covers spawned / padded faces and the re-appended real back).
    stampLayout(root, committedCandidate);

    // Structural overflow-state hook — applied to EVERY card-root in the
    // committed group (including spawned designed backs, which aren't in
    // markerTargets). `toggle` keeps it idempotent across re-renders and the
    // revert path. markerTargets.length > 1 == an overflow split actually
    // produced more than one face.
    const allRoots = container!.querySelectorAll<HTMLElement>(".card-root");
    const overflowSplit = st.markerTargets.length > 1;
    for (let r = 0; r < allRoots.length; r++) {
      allRoots[r]!.classList.toggle(OVERFLOW_ACTIVE_CLASS, overflowSplit);
    }

    // Front-face position markers — `allRoots` is the committed face sequence
    // in physical print order (pairs 2-by-2 onto duplex cards), so this is the
    // authoritative input for the per-front page-number markers. This also
    // publishes the inherited `--cf-front-index/total` props the CSS counter
    // renders, so it MUST run BEFORE the title re-fit below (the counter's
    // `::after` width depends on them). Idempotent (clears stale state) so the
    // revert re-finalize is safe.
    applyFrontFaceMarkers(allRoots);

    // Re-fit titles now that the counter renders, so the title pass accounts
    // for any width the CSS counter adds inside the title.
    if (st.markerTargets.length > 1) {
      if (relayoutGroup(root, scale)) st.clipped = true;
    }
  }

  /* Run the full parity pagination for ONE concrete parity ("odd" | "even"):
   * set it as the active render parity, paginate the body onto front-only faces
   * at the min scale, then fill the font UP to the parity's page count `P`
   * (largest scale in (minScale, 1] that stays ≤ P and unclipped), pad to `P`,
   * and (odd) re-append the real back. Always restores from pristine first, so
   * each call is independent — the candidate loop calls it once per parity
   * candidate and the comparator keeps the smaller printed-card group.
   *
   * `printedCards` is the physical card count: odd → ceil((P+1)/2) (P odd
   * fronts + 1 real back), even → P/2 (even fronts pair 2-by-2, no back). */
  function splitWithParity(parity: "odd" | "even"): SplitOutcome {
    parityForce = mode === "back-then-cards";
    let st = performSplit(minScale, true);
    // Natural front-page count at the min scale → round up to the parity.
    let P = Math.min(
      roundUpToParity(st.cardCount, parity),
      roundUpToParity(MAX_OVERFLOW_CARDS + 1, parity)
    );
    let scale = minScale;
    // Fill: largest scale in (minScale, 1] whose front-page count stays ≤ P and
    // unclipped, so the pages fill as much as possible (bigger font →
    // monotonically ≥ as many pages).
    if (!st.clipped && minScale < 0.999) {
      let lo = minScale,
        hi = 1,
        best = minScale;
      const ITERS = 6;
      for (let i = 0; i < ITERS; i++) {
        const mid = (lo + hi) / 2;
        const trial = performSplit(mid, true);
        // As in `splitAny`: don't grow the font past where a forced break would
        // be relocated (a stranded marker on a later face).
        if (!trial.clipped && trial.cardCount <= P && !groupHasUnconsumedBreak(trial)) {
          best = mid;
          lo = mid;
        } else {
          hi = mid;
        }
      }
      st = performSplit(best, true);
      scale = best;
      // Safety net: if the chosen scale clipped, overshot P, or stranded a break,
      // fall back to the min-scale baseline (re-derive P from its natural count).
      if (st.clipped || st.cardCount > P || groupHasUnconsumedBreak(st)) {
        st = performSplit(minScale, true);
        scale = minScale;
        P = Math.min(
          roundUpToParity(st.cardCount, parity),
          roundUpToParity(MAX_OVERFLOW_CARDS + 1, parity)
        );
      }
    }
    finishParity(st, scale, P, parity);
    const printedCards = Math.ceil((P + (parity === "odd" ? 1 : 0)) / 2);
    return { st: st, scale: scale, printedCards: printedCards };
  }

  /* Split a non-parity ("any") candidate: the baseline split at the min scale,
   * then grow the locked scale so the committed faces fill, never adding a
   * card. Restores from pristine first, so each call is independent — the
   * candidate loop calls it once per `any` candidate. `printedCards` is the
   * face count, a monotonic proxy used only to compare `any` candidates. NO
   * finalize. */
  function splitAny(): SplitOutcome {
    parityForce = false;
    let st = performSplit(minScale, true);
    let scale = minScale;
    // Grow the locked scale to fill, exactly as `splitWithParity` does. The
    // split above ran at the FLOOR scale; without this pass that floor is also
    // the printed size, however much room the committed faces actually have.
    //
    // The growth is unconditional rather than gated on the loud symptoms — a
    // sparse last face, a forced break — because those are only the loudest
    // cases, not the condition. A face keeps slack whenever the next block
    // cannot follow it, and the most ordinary reason is a `cf-keep-together`
    // block that no longer fits: it moves whole, and everything the floor
    // scale gave away stays given away. A card whose command list and
    // advancement table are each unbreakable renders at exactly
    // `--card-font-size-min` under a gated fill, 5 % below the largest size
    // that still fits, leaving 11 % of the card blank — and neither gate
    // fires, since the last face is not an orphan (it carries a table) and
    // there is no forced break.
    //
    // Growing unconditionally is safe because the loop's own guards, not the
    // entry condition, are what protect the layout: a trial is accepted only if
    // it neither clips, nor adds a card (`trial.cardCount <= baselineCount`),
    // nor strands a forced break. The cost is six extra split passes per
    // overflowing card — the same six the parity path pays.
    if (!st.clipped && minScale < 0.999) {
      const baselineCount = st.cardCount;
      let lo = minScale,
        hi = 1,
        best = minScale;
      const BAL_ITERS = 6;
      for (let bi = 0; bi < BAL_ITERS; bi++) {
        const mid = (lo + hi) / 2;
        const trial = performSplit(mid, true);
        // Accept only when the trial neither clips, nor adds a card, nor strands
        // (relocates) a forced break — the last guard keeps an author's break at
        // its exact position instead of growing the font by repaginating across it.
        if (
          !trial.clipped &&
          trial.cardCount <= baselineCount &&
          !groupHasUnconsumedBreak(trial)
        ) {
          best = mid;
          lo = mid;
        } else {
          hi = mid;
        }
      }
      if (best > minScale) {
        const t2 = performSplit(best, true);
        if (
          !t2.clipped &&
          t2.cardCount <= baselineCount &&
          !groupHasUnconsumedBreak(t2)
        ) {
          st = t2;
          scale = best;
        } else {
          st = performSplit(minScale, true);
          scale = minScale;
        }
      } else {
        st = performSplit(minScale, true);
        scale = minScale;
      }
    }
    return { st: st, scale: scale, printedCards: st.cardCount };
  }

  /* Render ONE layout candidate from pristine: stamp its class, run the
   * appropriate split (parity for odd/even on back-then-cards, else `any`),
   * re-stamp the class on every committed face, then measure the decision's
   * `data-cf-measure` markers and evaluate the candidate's `eligible-if` guard.
   * Returns a run object consumed by the decision comparator. */
  function renderCandidate(
    candidate: LayoutCandidate,
    markers: Record<string, true>
  ): GroupRun {
    currentCandidate = candidate;
    const outcome =
      (candidate.frontFaceCount === "odd" || candidate.frontFaceCount === "even") &&
      mode === "back-then-cards"
        ? splitWithParity(candidate.frontFaceCount)
        : splitAny();
    // Re-stamp on every committed face so conditional CSS + measurement see it.
    stampLayout(root, candidate);
    const sizes = measureCandidate(outcome, markers);
    return {
      ...outcome,
      candidate: candidate,
      clipped: outcome.st.clipped,
      sizes: sizes,
      whitespace: cfMeasureWhitespace(frontFaceRoots(outcome.st)),
      eligible: cfEligible(candidate, sizes),
    };
  }

  /* The committed FRONT face roots in order (excludes the re-appended real back
   * of an odd-parity group). The whitespace metric reads the trailing front face. */
  function frontFaceRoots(st: SplitState): HTMLElement[] {
    const out: HTMLElement[] = [];
    const t = st.markerTargets;
    for (let i = 0; i < t.length; i++) {
      if (t[i]!.classList.contains("card-front")) out.push(t[i]!);
    }
    return out;
  }

  /* Measure the requested markers on the committed front face at its body scale. */
  function measureCandidate(
    outcome: SplitOutcome,
    markers: Record<string, true>
  ): Record<string, CfMeasuredSize> {
    const sizes: Record<string, CfMeasuredSize> = {};
    const front = outcome.st.markerTargets[0];
    if (!front) return sizes;
    const fbody = front.querySelector<HTMLElement>(".card-body-scalable");
    let fscale = fbody ? readScaleFromTransform(fbody) : 1;
    if (!(fscale > 0)) fscale = 1;
    for (const m in markers) {
      if (Object.prototype.hasOwnProperty.call(markers, m))
        sizes[m] = cfMeasureMarker(front, m, fscale);
    }
    return sizes;
  }

  // --- Layout-candidate decision ----------------------------------------
  // Fast path: a single `any` candidate with no element-size decision and no
  // guard is the plain split + fill — the overwhelming majority of overflowing
  // cards, and any system on the default config.
  if (
    candidates.length === 1 &&
    candidates[0]!.frontFaceCount === "any" &&
    !candidates[0]!.eligibleIf &&
    !cfLayoutHasElementSize(layoutCfg)
  ) {
    currentCandidate = candidates[0]!;
    committedCandidate = candidates[0]!;
    const only = splitAny();
    finalizeGroup(only.st, only.scale);
    // Safety net: if finalize (title/body relayout) flips clipped after we grew
    // the scale, revert to the min-scale baseline so the fill never worsens it.
    if (only.st.clipped && only.scale > minScale) {
      currentCandidate = candidates[0]!;
      only.st = performSplit(minScale, true);
      only.scale = minScale;
      finalizeGroup(only.st, only.scale);
    }
    return { clipped: only.st.clipped, cardCount: only.st.cardCount };
  }

  // General loop: render every candidate from pristine, measure its metrics,
  // then let the decision rule pick the winner (eligible → ordered metrics +
  // epsilon + declaration-order tie-break; none eligible → the fallback). This
  // covers a two-candidate parity set (printed-cards minimize) and image
  // candidates (element-size) — and decides parity + image jointly when a
  // card type uses both.
  const markers = cfMarkersForConfig(layoutCfg);
  const runs: GroupRun[] = [];
  for (let ci = 0; ci < candidates.length; ci++) {
    runs.push(renderCandidate(candidates[ci]!, markers));
  }
  let winIdx = compareLayoutCandidates(runs, decision);
  if (winIdx < 0 || winIdx >= runs.length) winIdx = 0;
  // Re-commit the winner from pristine (the loop left the LAST candidate
  // committed); skip the re-render when the winner already is the last one.
  const winner =
    winIdx === runs.length - 1
      ? runs[winIdx]!
      : renderCandidate(candidates[winIdx]!, markers);
  committedCandidate = winner.candidate;
  finalizeGroup(winner.st, winner.scale);
  return { clipped: winner.st.clipped, cardCount: winner.st.cardCount };
}
