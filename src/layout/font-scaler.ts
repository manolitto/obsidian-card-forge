import type {
  LayoutCandidate,
  LayoutDecision,
  LayoutMetric,
} from "../definitions/card-settings";

/*
 * The font scaler: fitting a face's text into the box it has.
 *
 * Two things shrink. A title — any `.text-scalable` — has its font size
 * binary-searched down until it fits its container, and never below the
 * title floor. A body — a `.card-body-scalable` — keeps its font size and is
 * scaled as a whole instead: its box is stretched to (100 / scale) % and
 * `transform: scale(scale)` applied, so the visible body still fills its
 * slot edge to edge, and the search stops at the body floor. Both floors are
 * read from the cascade (`--card-font-size-title-min`, `--card-font-size-min`)
 * at the element itself, so a system declares its legibility limits where it
 * declares its type, and a card type or a deck can override them in CSS.
 *
 * Everything here reads layout — `scrollHeight`, `clientWidth`, a computed
 * font size — so nothing is safe to call outside a rendered DOM. The overflow
 * splitter builds on these functions; `scaleRoot` is the whole pass for a
 * single card that does not overflow.
 */

export const BINARY_SEARCH_ITERATIONS = 12;
export const FALLBACK_MIN_SCALE = 0.5;

/** A candidate set with its decision rule, as the settings chain resolves it. */
export interface LayoutConfig {
  layouts: readonly LayoutCandidate[];
  decision: LayoutDecision;
}

/** Element size in layout px, as measured by `cfMeasureMarker`. */
export interface CfMeasuredSize {
  width: number;
  height: number;
  area: number;
}

/** One candidate's committed run, as the comparator consumes it. */
export interface CfCandidateRun {
  candidate: LayoutCandidate;
  eligible: boolean;
  clipped: boolean;
  printedCards?: number;
  whitespace?: number;
  sizes?: Record<string, CfMeasuredSize>;
}

/* Parse "10mm" / "0.5in" / "37.8px" → CSS px. Returns NaN if unparseable.
 * `em` / `rem` / `%` are NOT supported — they need an inherited reference
 * and aren't useful for the absolute auto-shrink floor this serves. */
export function parseCssLengthToPx(value: string | null | undefined): number {
  if (!value) return NaN;
  const s = (value + "").trim();
  if (!s) return NaN;
  const m = s.match(/^([\d.]+)(mm|cm|in|pt|pc|px)?$/);
  if (!m) return parseFloat(s);
  const n = parseFloat(m[1]!);
  const u = m[2] || "px";
  if (u === "mm") return (n * 96) / 25.4;
  if (u === "cm") return (n * 96) / 2.54;
  if (u === "in") return n * 96;
  if (u === "pt") return (n * 96) / 72;
  if (u === "pc") return n * 16;
  return n;
}

/* Parse a resolved `getComputedStyle` length ("9.52px") → number, treating
 * anything unparseable as 0. Used for padding subtraction, where a missing
 * value must not poison the arithmetic into NaN. */
export function cssPx(value: string): number {
  const n = parseFloat(value);
  return isFinite(n) ? n : 0;
}

/* Horizontal-overflow probe — checks .cf-check-overflow markers under root. */
export function hasHorizontalOverflow(root: ShadowRoot | HTMLElement): boolean {
  const targets = root.querySelectorAll(".cf-check-overflow");
  for (let i = 0; i < targets.length; i++) {
    const el = targets[i]!;
    if (el.scrollWidth > el.clientWidth + 1) return true;
  }
  return false;
}

/* Resolve the body-scaler's per-element scale floor.
 *
 * Reads --card-font-size-min from the body element's cascade, converts it
 * from a target font-size in CSS px to a transform-scale floor:
 *   scaleFloor = minPx / bodyCssFontSizePx
 * (capped at 1 — never upscale). If unparseable, falls back to 0.5. */
export function resolveBodyMinScale(htmlEl: HTMLElement): number {
  const cssMinPx = parseCssLengthToPx(
    getComputedStyle(htmlEl).getPropertyValue("--card-font-size-min")
  );
  const bodyFsPx = parseFloat(getComputedStyle(htmlEl).fontSize);
  if (isFinite(cssMinPx) && cssMinPx > 0 && bodyFsPx > 0) {
    return Math.min(1, cssMinPx / bodyFsPx);
  }
  return FALLBACK_MIN_SCALE;
}

/* Binary-search the font-size of a single .text-scalable title element so
 * it fits inside its container both horizontally and vertically. */
export function scaleFontSize(el: HTMLElement): void {
  const container = el.parentElement;
  if (!container) return;

  // Clear any inline font-size baked by an earlier pass so this run starts
  // from the CSS-cascade size (the clamp), not a stale value. The binary
  // search below only ever shrinks, never grows, so without this reset a
  // second pass is capped by the first. That asymmetry matters for overflow
  // groups: the genuine front is scaled twice (initial + post-split relayout)
  // while a spawned/back-as-front face is scaled once — capping the front at
  // its first-pass size makes the two faces converge to *different* sizes.
  // Resetting first also means containerW/H are measured with the title at
  // its true cascade size (e.g. the flex-constrained width once the counter
  // shares the header row), so both faces shrink against an identical box.
  el.style.fontSize = "";

  // Measure the container's CONTENT box, not its padding box. `clientWidth`
  // /`clientHeight` include the padding, but the title only ever gets the
  // content box to lay out in — so comparing the title's scrollWidth against
  // the padding box hands it the padding as free width and the search stops
  // one padding too late. The overflow is then clipped by the card root and
  // reads as a cut-off heading: a category line with `padding: 0 4%` holding
  // one long word settles 8 % of the card width too wide and loses its final
  // glyph. Subtract the padding so the bound is the box the text is actually
  // laid out in.
  const containerStyle = getComputedStyle(container);
  const containerH =
    container.clientHeight -
    cssPx(containerStyle.paddingTop) -
    cssPx(containerStyle.paddingBottom);
  const containerW =
    container.clientWidth -
    cssPx(containerStyle.paddingLeft) -
    cssPx(containerStyle.paddingRight);
  if (containerH <= 0 && containerW <= 0) return;

  // Read CSS-defined font size as the upper bound, derive lower bound.
  const computedPx = parseFloat(getComputedStyle(el).fontSize);
  if (!computedPx || computedPx <= 0) return;

  // Lower bound: read --card-font-size-title-min from the cascade. If the
  // variable resolves above the starting size (e.g. tiny card where the
  // clamp already pinned the title at the floor), Math.min keeps the
  // search non-degenerate. If unparseable, fall back to 50% of start.
  const cssMinPx = parseCssLengthToPx(
    getComputedStyle(el).getPropertyValue("--card-font-size-title-min")
  );
  const minPx =
    isFinite(cssMinPx) && cssMinPx > 0
      ? Math.min(cssMinPx, computedPx)
      : computedPx * FALLBACK_MIN_SCALE;

  let lo = minPx,
    hi = computedPx,
    best = minPx;
  for (let j = 0; j < BINARY_SEARCH_ITERATIONS; j++) {
    const mid = (lo + hi) / 2;
    el.style.fontSize = mid + "px";
    const fitsW = el.scrollWidth <= containerW + 1;
    const fitsH = el.scrollHeight <= containerH + 1;
    if (fitsW && fitsH) {
      best = mid;
      lo = mid;
    } else {
      hi = mid;
    }
  }
  el.style.fontSize = best + "px";
}

/* Scale a single .card-body-scalable element to fit its parent container.
 * Resets any prior transform/width, runs the binary search, applies the
 * resulting scale, returns true if content still overflows at the floor.
 *
 * If `forcedScale` is a finite positive number, the binary search is
 * skipped: the body is laid out at the given scale (width = 100/scale %,
 * transform = scale(forcedScale)) and the function returns whether the
 * content still overflows at that locked scale. Used by the overflow
 * splitter to lock every card in an overflow group to the same scale as
 * the first (clipped-at-min) card, so the group reads as one paginated
 * sheet instead of cards with mismatched font sizes. */
export function scaleOneBody(htmlEl: HTMLElement, forcedScale?: number): boolean {
  htmlEl.style.transform = "";
  htmlEl.style.width = "";
  htmlEl.style.height = "";
  htmlEl.style.minHeight = "";

  const availableH = htmlEl.clientHeight;
  if (availableH === 0) return false;

  if (
    forcedScale !== undefined &&
    isFinite(forcedScale) &&
    forcedScale > 0 &&
    forcedScale <= 1
  ) {
    // Forced-scale path: skip the binary search, lay out at the locked
    // scale and report whether content still overflows.
    htmlEl.style.transformOrigin = "top left";
    const fixedContainer = htmlEl.parentElement;
    if (fixedContainer) fixedContainer.style.overflow = "visible";
    const fixedInv = (100 / forcedScale).toFixed(2) + "%";
    htmlEl.style.width = fixedInv;
    htmlEl.style.height = fixedInv;
    htmlEl.style.minHeight = fixedInv;
    htmlEl.style.transform = "scale(" + forcedScale + ")";
    // Measure in the STRETCHED box, the same frame the splitter's clipping
    // checks use — see the block comment on the binary search below for why
    // the pre-stretch form is wrong.
    const fixedH =
      htmlEl.clientHeight > 0 && htmlEl.scrollHeight > htmlEl.clientHeight + 1;
    const fixedW = hasHorizontalOverflow(htmlEl);
    return fixedH || fixedW;
  }

  const contentH = htmlEl.scrollHeight;
  const needsScale =
    (availableH > 0 && contentH > availableH) || hasHorizontalOverflow(htmlEl);
  if (!needsScale) return false;

  htmlEl.style.transformOrigin = "top left";
  const container = htmlEl.parentElement;
  if (container) container.style.overflow = "visible";

  const minScale = resolveBodyMinScale(htmlEl);
  let lo = Math.max(minScale, contentH > availableH ? availableH / contentH : minScale);
  let hi = 1;
  let best = lo;
  // Probe in the SAME geometry the search commits below — width AND the
  // height/min-height stretch — and test the SAME predicate every later
  // clipping check uses (`scrollHeight <= clientHeight + 1`).
  //
  // The pre-stretch form (`scrollHeight * mid <= availableH + 1`) spends its
  // 1px tolerance in the SCALED frame, i.e. `1 / mid` ≈ 2px of unscaled
  // content, while the splitter's clipping checks spend theirs in the
  // UNSCALED frame — and `clientHeight` truncates the stretched allocation
  // downwards for up to a pixel more. A maximizing binary search converges
  // hard against its own bound by construction, so any dense body landing in
  // that ~2px band would be committed as fitting and then re-read as
  // overflowing, raising a "content clipped" warning for cards that visually
  // lose nothing (the real overshoot is under one rendered pixel). Measuring
  // in the committed geometry makes the result satisfy the later checks by
  // construction; it costs at most one search step (well under a percent of
  // scale on a dense deck).
  for (let j = 0; j < BINARY_SEARCH_ITERATIONS; j++) {
    const mid = (lo + hi) / 2;
    const midInv = (100 / mid).toFixed(2) + "%";
    htmlEl.style.width = midInv;
    htmlEl.style.height = midInv;
    htmlEl.style.minHeight = midInv;
    const fitsH = htmlEl.scrollHeight <= htmlEl.clientHeight + 1;
    const fitsW = !hasHorizontalOverflow(htmlEl);
    if (fitsH && fitsW) {
      best = mid;
      lo = mid;
    } else {
      hi = mid;
    }
  }
  htmlEl.style.transform = "scale(" + best + ")";
  const bestInv = (100 / best).toFixed(2) + "%";
  htmlEl.style.width = bestInv;
  // Stretch the layout box (height + min-height) by 1/best so that after
  // `transform: scale(best)`, the visible body fills its original flex
  // allocation. Without this stretch, the visible body renders at only
  // `allocation × best` tall — fine when the chrome below it (footer,
  // …) is in the flex flow with `margin-top: auto`, but problematic
  // when the chrome is absolutely positioned and would overlap content
  // visually anchored to the body's box. The card-root's `overflow: hidden`
  // clips the body's pre-transform overflow; visually the body fills its
  // slot edge-to-edge.
  htmlEl.style.height = bestInv;
  htmlEl.style.minHeight = bestInv;

  // Detect clipping: content still overflows at the scale floor. Same frame
  // as the search above and as every later check.
  if (Math.abs(best - minScale) < 0.001) {
    const stillOverflowsH =
      htmlEl.clientHeight > 0 && htmlEl.scrollHeight > htmlEl.clientHeight + 1;
    const stillOverflowsW = hasHorizontalOverflow(htmlEl);
    if (stillOverflowsH || stillOverflowsW) return true;
  }
  return false;
}

/* ── Layout candidates ───────────────────────────────────────────────────────
 *
 * A "layout candidate" is one named, mutually-exclusive way of rendering a card
 * (`LayoutCandidate` in the settings chain). These helpers measure
 * `data-cf-measure` markers, compare candidates against the decision rule, and
 * stamp the `.cf-layout-<name>` class. The single-card driver
 * `pickLayoutCandidateInBody` runs inside `processBody`; the overflow splitter
 * reuses `compareLayoutCandidates` for whole-group candidates. */

/* True when the config's decision references an `element-size` metric or any
 * candidate carries an `eligibleIf` guard — i.e. candidates differ at SINGLE-card
 * scale and the per-card driver must actually loop. Parity-only configs (the
 * default `any`, or odd/even) return false: they only differ under overflow,
 * which the splitter resolves. */
export function cfLayoutHasElementSize(cfg: LayoutConfig | undefined): boolean {
  if (!cfg) return false;
  const d = cfg.decision;
  if (d && d.order) {
    for (let i = 0; i < d.order.length; i++) {
      if (d.order[i] && d.order[i]!.metric === "element-size") return true;
    }
  }
  for (let j = 0; j < cfg.layouts.length; j++) {
    if (cfg.layouts[j] && cfg.layouts[j]!.eligibleIf) return true;
  }
  return false;
}

/* Read the inline `transform: scale(N)` of a body element (default 1). */
export function cfBodyScale(body: HTMLElement): number {
  const m = (body.style.transform || "").match(/scale\(([\d.]+)\)/);
  return m ? parseFloat(m[1]!) : 1;
}

/* Measure the element(s) marked `data-cf-measure="<marker>"` inside `cardRoot`,
 * scaled by `scale` (the body's committed transform). Returns `{ width, height,
 * area }` in layout px. When several elements share the marker (e.g. the same
 * image rendered into a side AND a bottom slot, only one visible per candidate),
 * the LARGEST-area match wins — so the visible slot is measured and hidden ones
 * (clientHeight 0) are ignored. A missing element or a broken `<img>` (loaded but
 * zero natural size) measures 0 in every dimension. */
export function cfMeasureMarker(
  cardRoot: HTMLElement,
  marker: string,
  scale: number
): CfMeasuredSize {
  const zero = { width: 0, height: 0, area: 0 };
  const els = cardRoot.querySelectorAll('[data-cf-measure="' + marker + '"]');
  if (!els.length) return zero;
  const s = isFinite(scale) && scale > 0 ? scale : 1;
  let best = zero;
  for (let i = 0; i < els.length; i++) {
    const el = els[i]!;
    const img = el.tagName === "IMG" ? (el as HTMLImageElement) : el.querySelector("img");
    if (img && img.complete && img.naturalWidth === 0) continue; // broken image
    const w = el.clientWidth * s;
    const h = el.clientHeight * s;
    const area = w * h;
    if (area > best.area) best = { width: w, height: h, area: area };
  }
  return best;
}

/* Whitespace metric (trailing-face gap). Returns the unfilled fraction [0,1]
 * of the LAST committed front face's body — `1 − min(scrollHeight,
 * clientHeight) / clientHeight`. A full/clipped last face → 0; a sparse orphan
 * last face → toward 1. Earlier front faces are full by construction of the
 * greedy split, so the trailing face carries the gap. `frontRoots` is the ordered
 * list of committed FRONT `.card-root`s (the single body for a non-split card). */
export function cfMeasureWhitespace(frontRoots: ArrayLike<HTMLElement>): number {
  if (!frontRoots.length) return 0;
  const last = frontRoots[frontRoots.length - 1];
  const body = last ? last.querySelector(".card-body-scalable") : null;
  if (!body) return 0;
  const avail = body.clientHeight;
  if (!(avail > 0)) return 0;
  const content = Math.min(body.scrollHeight, avail);
  const ws = 1 - content / avail;
  return ws > 0 ? ws : 0;
}

/* Stamp `.cf-layout-<name>` on each root, clearing any prior `.cf-layout-*`.
 * Idempotent. */
export function cfApplyLayoutClasses(
  roots: ArrayLike<HTMLElement>,
  candidate: LayoutCandidate
): void {
  const name = candidate.name;
  for (let i = 0; i < roots.length; i++) {
    const root = roots[i];
    if (!root) continue;
    const cl = root.classList;
    const stale: string[] = [];
    for (let t = 0; t < cl.length; t++) {
      if (cl[t]!.indexOf("cf-layout-") === 0) stale.push(cl[t]!);
    }
    for (let r = 0; r < stale.length; r++) cl.remove(stale[r]!);
    cl.add("cf-layout-" + name);
  }
}

/* Value of one decision key for a measured run. printed-cards → integer face
 * count; element-size → the requested dimension of the run's measured marker,
 * the area when none is named. */
function cfMetricValue(run: CfCandidateRun, key: LayoutMetric): number {
  if (key.metric === "printed-cards") return run.printedCards || 0;
  if (key.metric === "whitespace") return run.whitespace || 0;
  if (key.metric === "element-size") {
    const s = run.sizes && key.element !== undefined ? run.sizes[key.element] : undefined;
    if (!s) return 0;
    return key.dimension === "width"
      ? s.width
      : key.dimension === "height"
        ? s.height
        : s.area;
  }
  return 0;
}

/* Does run `a` beat run `b` under the ordered decision keys? Integer metrics
 * (printed-cards) compare exactly; continuous metrics use the key's `epsilon`
 * (fraction, default 0.02) so near-ties fall through to the next key. All keys
 * tied → false (the earlier-declared run is kept by the caller). */
function cfCandidateBeats(
  a: CfCandidateRun,
  b: CfCandidateRun,
  order: readonly LayoutMetric[]
): boolean {
  for (let i = 0; i < order.length; i++) {
    const key = order[i]!;
    const va = cfMetricValue(a, key);
    const vb = cfMetricValue(b, key);
    if (key.metric === "printed-cards") {
      if (va !== vb) return key.direction === "maximize" ? va > vb : va < vb;
      continue;
    }
    const eps = typeof key.epsilon === "number" && key.epsilon >= 0 ? key.epsilon : 0.02;
    const denom = Math.max(Math.abs(va), Math.abs(vb), 1e-9);
    if (Math.abs(va - vb) > eps * denom) {
      return key.direction === "maximize" ? va > vb : va < vb;
    }
    // within epsilon → tie on this key, continue to the next
  }
  return false;
}

/* Pick the winning candidate index from measured runs. Each run:
 *   { candidate, printedCards, sizes:{marker:{w,h,area}}, clipped, eligible }.
 * Eligible = passes its `eligibleIf` AND not clipped. If any eligible: sort by
 * the decision order (lexicographic + per-key epsilon), tie-break declaration
 * order (lowest index). If none eligible: the `fallback`-flagged candidate, else
 * the earliest declared. Pure — no DOM; unit-tested. */
export function compareLayoutCandidates(
  runs: readonly CfCandidateRun[],
  decision: LayoutDecision | undefined
): number {
  if (!runs.length) return -1;
  const eligible: number[] = [];
  for (let i = 0; i < runs.length; i++) {
    if (runs[i]!.eligible && !runs[i]!.clipped) eligible.push(i);
  }
  if (eligible.length === 0) {
    for (let j = 0; j < runs.length; j++) {
      if (runs[j]!.candidate.fallback) return j;
    }
    return 0;
  }
  const order = (decision && decision.order) || [];
  let best = eligible[0]!;
  for (let k = 1; k < eligible.length; k++) {
    if (cfCandidateBeats(runs[eligible[k]!]!, runs[best]!, order)) best = eligible[k]!;
  }
  return best;
}

/* Collect the markers a config needs measured: every element-size decision key
 * plus every candidate's eligibleIf element. */
function cfMarkersForConfig(cfg: LayoutConfig): Record<string, true> {
  const markers: Record<string, true> = {};
  const d = cfg.decision;
  if (d && d.order) {
    for (let i = 0; i < d.order.length; i++) {
      const key = d.order[i]!;
      if (key.metric === "element-size" && key.element) markers[key.element] = true;
    }
  }
  for (let j = 0; j < cfg.layouts.length; j++) {
    const eg = cfg.layouts[j]!.eligibleIf;
    if (eg && eg.element) markers[eg.element] = true;
  }
  return markers;
}

/* Measure every needed marker for a card-root at the current body scale. */
function cfMeasureAll(
  cardRoot: HTMLElement,
  markers: Record<string, true>,
  scale: number
): Record<string, CfMeasuredSize> {
  const sizes: Record<string, CfMeasuredSize> = {};
  for (const m in markers) {
    if (Object.prototype.hasOwnProperty.call(markers, m))
      sizes[m] = cfMeasureMarker(cardRoot, m, scale);
  }
  return sizes;
}

/* Evaluate a candidate's eligibleIf guard against measured sizes. No guard → true.
 * Exported for the overflow splitter's whole-group loop. */
export function cfEligible(
  candidate: LayoutCandidate,
  sizes: Record<string, CfMeasuredSize>
): boolean {
  const g = candidate.eligibleIf;
  if (!g) return true;
  const s = sizes[g.element];
  if (!s) return false;
  if (g.minWidth && s.width < parseCssLengthToPx(g.minWidth)) return false;
  if (g.minHeight && s.height < parseCssLengthToPx(g.minHeight)) return false;
  return true;
}

/* Single-card layout-candidate driver. For each candidate: stamp its
 * `.cf-layout-<name>`, re-fit the body, measure the referenced markers,
 * evaluate eligibility (printed-cards is 1 for every candidate — there is no
 * overflow split at this level). Picks the winner via
 * `compareLayoutCandidates`, re-commits its classes + a final body fit, and
 * returns whether the committed body still clips at the scale floor.
 *
 * Only called by `processBody` when `cfLayoutHasElementSize(cfg)` is true; a
 * single / parity-only candidate set takes the plain `scaleOneBody` path. */
export function pickLayoutCandidateInBody(
  body: HTMLElement,
  cardRoot: HTMLElement,
  cfg: LayoutConfig
): boolean {
  const cands = cfg.layouts;
  const markers = cfMarkersForConfig(cfg);
  const runs: CfCandidateRun[] = [];
  for (let i = 0; i < cands.length; i++) {
    const c = cands[i]!;
    cfApplyLayoutClasses([cardRoot], c);
    const clipped = scaleOneBody(body);
    const sizes = cfMeasureAll(cardRoot, markers, cfBodyScale(body));
    runs.push({
      candidate: c,
      printedCards: 1,
      sizes: sizes,
      clipped: clipped,
      eligible: cfEligible(c, sizes),
      whitespace: cfMeasureWhitespace([cardRoot]),
    });
  }
  let win = compareLayoutCandidates(runs, cfg.decision);
  if (win < 0) win = 0;
  cfApplyLayoutClasses([cardRoot], cands[win]!);
  return scaleOneBody(body);
}

/* Body-pipeline shared by both call sites: binary-search the scale, then pick
 * a layout candidate where the set needs a per-body pick. Returns true if the
 * body is still clipped at the scale floor. */
export function processBody(bodyEl: HTMLElement, cfg: LayoutConfig | undefined): boolean {
  let clipped = scaleOneBody(bodyEl);
  // Layout candidates: only run the per-card driver when candidates differ at
  // single-card scale (element-size / eligible-if). Parity-only configs (default
  // `any`, odd/even) and config-less cards take the plain scale above.
  const cardRoot = bodyEl.closest<HTMLElement>(".card-root");
  if (cardRoot && cfg && cfLayoutHasElementSize(cfg)) {
    if (pickLayoutCandidateInBody(bodyEl, cardRoot, cfg)) clipped = true;
  }
  return clipped;
}

/* Read the inline transform: scale(N) value from an element's style.
 * Returns NaN if no scale transform is set. Used by the overflow splitter
 * to capture the first card's scale after the body search converges so the
 * same scale can be locked onto every card in the overflow group. */
export function readScaleFromTransform(htmlEl: HTMLElement): number {
  const m = (htmlEl.style.transform || "").match(/scale\(([\d.]+)\)/);
  return m ? parseFloat(m[1]!) : NaN;
}

/* Run binary-search title scaling only — walks `.text-scalable` elements
 * under `root` and re-fits each title. Used by the overflow splitter for
 * the post-marker final pass, where the title's `.cf-overflow-counter`
 * placeholder has been populated and may have widened the title's
 * scrollWidth. Bodies are deliberately not touched here — the splitter
 * manages body scale separately via the forced-scale path. */
export function scaleTitlesInRoot(root: ShadowRoot | HTMLElement): void {
  const titles = root.querySelectorAll<HTMLElement>(".text-scalable");
  for (let i = 0; i < titles.length; i++) {
    scaleFontSize(titles[i]!);
  }
}

/* Run font scaling on a DOM root (shadow root or element) holding a single
 * card: every title, then every body under the card's candidate set.
 * Returns true if any body content is clipped at the scale floor. */
export function scaleRoot(root: ShadowRoot | HTMLElement, cfg?: LayoutConfig): boolean {
  let bodyClipped = false;

  const titles = root.querySelectorAll<HTMLElement>(".text-scalable");
  for (let i = 0; i < titles.length; i++) {
    scaleFontSize(titles[i]!);
  }

  const bodies = root.querySelectorAll<HTMLElement>(".card-body-scalable");
  for (let k = 0; k < bodies.length; k++) {
    if (processBody(bodies[k]!, cfg)) bodyClipped = true;
  }
  return bodyClipped;
}
