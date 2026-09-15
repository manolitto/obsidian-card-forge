import { describe, expect, it } from "vitest";
import {
  classify,
  mergeClassifiers,
  parseClassifiers,
} from "../src/definitions/classifiers";
import { collectDiagnostics } from "../src/definitions/diagnostics";
import { yaml } from "./helpers/definitions";

const parse = (source: string, diagnostics = collectDiagnostics()) =>
  parseClassifiers(yaml(source), "x.classifiers", diagnostics);

const ROLL = `
front-header-die:
  match:
    - { pattern: "^.{1,2}$", token: narrow }
    - { pattern: "^\\\\d[–—-]\\\\d$", token: narrow }
  default: wide
`;

describe("classifiers:", () => {
  it("yields the first matching rule's token, else the default", () => {
    const classifiers = parse(ROLL);
    expect(classify(classifiers, "front-header-die", "7")).toBe("narrow");
    expect(classify(classifiers, "front-header-die", "1–2")).toBe("narrow");
    expect(classify(classifiers, "front-header-die", "9–10")).toBe("wide");
    expect(classify(classifiers, "front-header-die", "")).toBe("wide");
  });

  it("yields nothing for a slot with no classifier, or a miss with no default", () => {
    expect(classify(parse(ROLL), "front-header-subtitle", "x")).toBe("");
    const bare = parse("a: { match: [{ pattern: '^x$', token: hit }] }");
    expect(classify(bare, "a", "y")).toBe("");
  });

  it("matches on the trimmed, lowercased text", () => {
    const classifiers = parse("a: { match: [{ pattern: '^selten$', token: rare }] }");
    expect(classify(classifiers, "a", " Selten ")).toBe("rare");
  });

  it("merges per slot, the card type's replacing the system's", () => {
    const merged = mergeClassifiers(
      parse("a: { default: sys }\nb: { default: sys }"),
      parse("a: { default: type }")
    );
    expect(classify(merged, "a", "")).toBe("type");
    expect(classify(merged, "b", "")).toBe("sys");
  });

  it("reports what it cannot use, and keeps the rest", () => {
    const diagnostics = collectDiagnostics();
    const classifiers = parse(
      [
        "empty: {}",
        "bad-pattern: { match: [{ pattern: '(', token: t }], default: d }",
        "no-token: { match: [{ pattern: 'x' }], default: d }",
        "list: [a]",
        "fine: { default: ok }",
      ].join("\n"),
      diagnostics
    );
    expect(Object.keys(classifiers)).toEqual(["bad-pattern", "no-token", "fine"]);
    expect(diagnostics.matching("empty")).toHaveLength(1);
    expect(diagnostics.matching("not a regular expression")).toHaveLength(1);
    expect(diagnostics.matching("needs both")).toHaveLength(1);
    expect(diagnostics.matching("classifiers.list")).toHaveLength(1);
  });
});
