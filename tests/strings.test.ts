import { describe, expect, it } from "vitest";
import { CARD_SETTING_KEYS } from "../src/definitions/card-settings";
import {
  resolveUiLanguage,
  setUiLanguage,
  STRINGS,
  t,
  uiLanguage,
} from "../src/ui/strings";

/**
 * The plugin's strings: both tables complete, the placeholders agreeing,
 * and `auto` resolving to a language the plugin has words in.
 */

const placeholders = (text: string): string[] =>
  [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1] ?? "").sort();

describe("the strings table", () => {
  it("has every key in both languages", () => {
    expect(Object.keys(STRINGS.de).sort()).toEqual(Object.keys(STRINGS.en).sort());
  });

  it("names the same placeholders in both languages", () => {
    for (const key of Object.keys(STRINGS.en) as (keyof typeof STRINGS.en)[]) {
      expect(placeholders(STRINGS.de[key]), key).toEqual(placeholders(STRINGS.en[key]));
    }
  });

  it("documents every card setting for the reference", () => {
    for (const key of ["system", "card-type", ...CARD_SETTING_KEYS]) {
      expect(STRINGS.en, key).toHaveProperty(`card-key.${key}`);
    }
  });

  it("leaves no string empty", () => {
    for (const table of Object.values(STRINGS)) {
      for (const [key, text] of Object.entries(table)) {
        expect(text.trim(), key).not.toBe("");
      }
    }
  });
});

describe("resolveUiLanguage", () => {
  it("follows Obsidian under auto", () => {
    expect(resolveUiLanguage("auto", "de")).toBe("de");
    expect(resolveUiLanguage("auto", "de-CH")).toBe("de");
    expect(resolveUiLanguage("auto", "en")).toBe("en");
  });

  it("resolves a language the plugin has no words in to English", () => {
    expect(resolveUiLanguage("auto", "fr")).toBe("en");
    expect(resolveUiLanguage("auto", "")).toBe("en");
  });

  it("takes an explicit choice over Obsidian's", () => {
    expect(resolveUiLanguage("en", "de")).toBe("en");
    expect(resolveUiLanguage("de", "en")).toBe("de");
  });
});

describe("t", () => {
  it("reads the current table and fills the placeholders", () => {
    setUiLanguage("en");
    expect(uiLanguage()).toBe("en");
    expect(t("settings.system.folder", { path: "card-forge/mine" })).toBe(
      "Vault folder: card-forge/mine"
    );
    setUiLanguage("de");
    expect(t("settings.system.folder", { path: "card-forge/mine" })).toBe(
      "Vault-Ordner: card-forge/mine"
    );
    setUiLanguage("en");
  });

  it("leaves a placeholder it is not given", () => {
    expect(t("settings.system.folder")).toBe("Vault folder: {path}");
  });
});
