import { describe, expect, it } from "vitest";
import { collectDiagnostics } from "../src/definitions/diagnostics";
import {
  mergeTranslations,
  parseTranslations,
  parseTranslationTables,
  resolveTranslations,
} from "../src/definitions/translations";
import { yaml } from "./helpers/definitions";

const parse = (source: string) =>
  parseTranslations(yaml(source), "i18n/de.yaml", collectDiagnostics());

describe("parseTranslations", () => {
  it("reads a flat table of key and text", () => {
    expect(parse("front-stat-1a-label: Griff\nback-label: Rückseite")).toEqual({
      "front-stat-1a-label": "Griff",
      "back-label": "Rückseite",
    });
  });

  it("stringifies a label an author wrote without quotes", () => {
    expect(parse("front-die-label: 6")).toEqual({ "front-die-label": "6" });
  });

  it("keeps a label declared deliberately empty", () => {
    // An empty caption is a real declaration: the cell has a place but no name.
    expect(parse("front-stat-1a-label: ''")).toEqual({ "front-stat-1a-label": "" });
  });

  it("drops a key with no value", () => {
    expect(parse("front-stat-1a-label:")).toEqual({});
  });

  it("reports a document that is not a mapping", () => {
    const diagnostics = collectDiagnostics();
    expect(parseTranslations(["Griff"], "i18n/de.yaml", diagnostics)).toEqual({});
    expect(diagnostics.matching("i18n/de.yaml")).toHaveLength(1);
  });

  it("treats an empty document as an empty table", () => {
    const diagnostics = collectDiagnostics();
    expect(parseTranslations(undefined, "i18n/de.yaml", diagnostics)).toEqual({});
    expect(diagnostics.messages).toEqual([]);
  });
});

describe("parseTranslationTables", () => {
  it("reads one table per language, inline", () => {
    // Inline in the system entry, not a file per language: the tables are
    // small, every system has them, and a card type's captions then sit
    // beside the bindings they caption.
    const tables = parseTranslationTables(
      yaml("DE: { back-label: Rückseite }\nen: { back-label: Back }"),
      "i18n",
      collectDiagnostics()
    );
    expect(tables).toEqual({
      de: { "back-label": "Rückseite" },
      en: { "back-label": "Back" },
    });
  });

  it("reports a language whose table is not a mapping, and keeps the others", () => {
    const diagnostics = collectDiagnostics();
    const tables = parseTranslationTables(
      yaml("de: [nope]\nen: { back-label: Back }"),
      "i18n",
      diagnostics
    );
    expect(tables).toEqual({ de: {}, en: { "back-label": "Back" } });
    expect(diagnostics.matching("i18n.de")).toHaveLength(1);
  });

  it("reports a block that is not a mapping of languages", () => {
    const diagnostics = collectDiagnostics();
    expect(parseTranslationTables("i18n/de.yaml", "i18n", diagnostics)).toEqual({});
    expect(diagnostics.matching("<lang>")).toHaveLength(1);
  });
});

describe("mergeTranslations", () => {
  it("lets the layer win per key, per language", () => {
    const merged = mergeTranslations(
      { de: { a: "system", b: "system" }, en: { a: "system" } },
      { de: { b: "card type" } }
    );
    expect(merged).toEqual({ de: { a: "system", b: "card type" }, en: { a: "system" } });
  });

  it("keeps a language only one side declares", () => {
    expect(mergeTranslations({ de: { a: "x" } }, { en: { a: "y" } })).toEqual({
      de: { a: "x" },
      en: { a: "y" },
    });
  });

  it("does not let the result leak into either side", () => {
    const base = { de: { a: "x" } };
    const merged = mergeTranslations(base, { de: { b: "y" } });
    expect(merged["de"]).toEqual({ a: "x", b: "y" });
    expect(base["de"]).toEqual({ a: "x" });
  });
});

describe("resolveTranslations", () => {
  const BASELINE = { de: { "back-label": "Rückseite" }, en: { "back-label": "Back" } };
  const SYSTEM = { de: { "front-stat-1a-label": "Griff" }, en: {} };
  const CARD_TYPE = { de: { "front-stat-1a-label": "Griffart" } };

  it("collapses the chain into one flat table for the card's language", () => {
    expect(resolveTranslations([BASELINE, SYSTEM, CARD_TYPE], "de")).toEqual({
      "back-label": "Rückseite",
      "front-stat-1a-label": "Griffart",
    });
  });

  it("fills what the card's language does not answer from the system's own", () => {
    // A system that translates half its labels shows the other half in the
    // language it was written in, rather than showing nothing.
    expect(resolveTranslations([BASELINE, SYSTEM, CARD_TYPE], "en", "de")).toEqual({
      "back-label": "Back",
      "front-stat-1a-label": "Griffart",
    });
  });

  it("lets the card's language override the fallback key by key", () => {
    const layers = [{ de: { a: "Deutsch", b: "Deutsch" }, en: { a: "English" } }];
    expect(resolveTranslations(layers, "en", "de")).toEqual({
      a: "English",
      b: "Deutsch",
    });
  });

  it("leaves out a key no layer answers", () => {
    // What that renders as is the caller's decision, and the two callers differ.
    expect("missing" in resolveTranslations([BASELINE], "de")).toBe(false);
  });

  it("skips a layer that declared nothing", () => {
    expect(resolveTranslations([BASELINE, undefined], "de")).toEqual({
      "back-label": "Rückseite",
    });
  });

  it("yields an empty table for a language nothing declares", () => {
    expect(resolveTranslations([BASELINE, SYSTEM], "fr")).toEqual({});
  });
});
