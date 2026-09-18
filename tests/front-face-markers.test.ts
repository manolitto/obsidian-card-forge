import { describe, expect, it } from "vitest";
import {
  computeFrontFaceMarkers,
  FRONT_CONTINUED_CLASS,
  FRONT_FIRST_CLASS,
  FRONT_HAS_NEXT_CLASS,
} from "../src/layout/overflow-splitter";

// The DOM application (applyFrontFaceMarkers) depends on real `.card-front`
// classes on live roots and is the browser suite's. This file pins the pure
// class/index decision that drives it, against the canonical committed face
// sequences the splitter produces (faces pair 2-by-2 onto duplex cards).

const FIRST = FRONT_FIRST_CLASS;
const CONT = FRONT_CONTINUED_CLASS;
const NEXT = FRONT_HAS_NEXT_CLASS;

describe("computeFrontFaceMarkers", () => {
  it("marks a non-overflow single card as page 1/1 (no has-next)", () => {
    // [front, back] — only one front face, so it is the last → no cs-front-has-next
    const out = computeFrontFaceMarkers([true, false]);
    expect(out[0]).toEqual({ index: 1, total: 1, classes: [FIRST] });
    expect(out[1]).toBeNull();
  });

  it("extra-cards: a new card's front is page 2, and page 1 has a next", () => {
    // [F1, B1, F2, B2] — page 1 is followed by page 2 → has-next; page 2 is last → none
    const out = computeFrontFaceMarkers([true, false, true, false]);
    expect(out[0]).toEqual({ index: 1, total: 2, classes: [FIRST, NEXT] });
    expect(out[1]).toBeNull();
    expect(out[2]).toEqual({ index: 2, total: 2, classes: [CONT] });
    expect(out[3]).toBeNull();
  });

  it("back-then-cards (any): the continuation cloned onto the back is page 2", () => {
    // [F1, clonedFrontOnBack, spawnedF2, spawnedB2] — pages 1 & 2 have a next; page 3 is last
    const out = computeFrontFaceMarkers([true, true, true, false]);
    expect(out[0]).toEqual({ index: 1, total: 3, classes: [FIRST, NEXT] });
    expect(out[1]).toEqual({ index: 2, total: 3, classes: [CONT, NEXT] });
    expect(out[2]).toEqual({ index: 3, total: 3, classes: [CONT] });
    expect(out[3]).toBeNull();
  });

  it("back-then-cards (odd parity): real back gets no front markers", () => {
    // [F1, F2, F3, realBack] — 3 odd fronts + 1 real back
    const out = computeFrontFaceMarkers([true, true, true, false]);
    expect(out[2]).toEqual({ index: 3, total: 3, classes: [CONT] });
    expect(out[3]).toBeNull();
  });

  it("back-then-cards (even parity): page 2 is the last, no real back", () => {
    // [F1, F2] — page 1 has a next; page 2 is last
    const out = computeFrontFaceMarkers([true, true]);
    expect(out[0]).toEqual({ index: 1, total: 2, classes: [FIRST, NEXT] });
    expect(out[1]).toEqual({ index: 2, total: 2, classes: [CONT] });
  });

  it("returns an empty array for empty input", () => {
    expect(computeFrontFaceMarkers([])).toEqual([]);
  });
});
