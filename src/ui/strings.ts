import type { UiLanguage } from "../settings/types";

/*
 * The plugin's own words, in English and German: buttons, labels, headings,
 * the settings' names and descriptions, the frames around a notice, the
 * comments the insert commands write. What the engine says — the errors a
 * deck build throws, every diagnostic naming a key, a path or a card type —
 * stays English on purpose: those quote YAML and are what an author
 * searches for.
 *
 * One table per language, the keys a union type, so a typo is a type error
 * and a key missing from one language is a failing test. A placeholder is
 * `{name}`; both languages name the same ones.
 */

const en = {
  // ── Commands ────────────────────────────────────────────────────
  "command.export-pdf": "Export deck as PDF",
  "command.export-html": "Export deck as HTML",
  "command.preview-deck": "Preview deck",
  "command.insert-empty": "Insert empty card definition",
  "command.insert-sample": "Insert sample card",
  "command.insert-deck": "Insert deck block",
  "command.property-reference": "Show property reference",

  // ── Settings ────────────────────────────────────────────────────
  "settings.systems.heading": "Systems",
  "settings.systems.desc":
    "The systems your cards can be rendered with. Bundled systems ship with the plugin; a vault system is a folder in your vault holding a game-system.yaml. At most one system per id may be switched on.",
  "settings.system.bundled": "Bundled with the plugin",
  "settings.system.folder": "Vault folder: {path}",
  "settings.system.copy": "Copy into vault",
  "settings.system.remove": "Remove",
  "settings.add.name": "Add a vault system",
  "settings.add.desc":
    "The folder holding the system's game-system.yaml. It is read and checked when you add it.",
  "settings.add.placeholder": "Folder in the vault",
  "settings.add.button": "Add",
  "settings.add.registered": 'Registered system "{id}" from {path}',
  "settings.add.already": "{path} is already registered",
  "settings.add.no-folder": "Name a folder first",
  "settings.preferences.heading": "Preferences",
  "settings.preview-height.name": "Preview height",
  "settings.preview-height.desc":
    "Height of a card in the in-note preview, in pixels. A note may override it with display-height.",
  "settings.paper-background.name": "Paper background",
  "settings.paper-background.desc":
    "Whether a deck prints the system's background textures. A deck may override it with paper-background.",
  "settings.paper-background.textured": "Textured",
  "settings.paper-background.plain": "Plain",
  "settings.language.name": "Language",
  "settings.language.desc": "Language of the plugin's own interface.",
  "settings.language.auto": "Follow Obsidian",
  "settings.language.en": "English",
  "settings.language.de": "Deutsch",
} as const;

const de: Strings = {
  // ── Commands ────────────────────────────────────────────────────
  "command.export-pdf": "Deck als PDF exportieren",
  "command.export-html": "Deck als HTML exportieren",
  "command.preview-deck": "Deck-Vorschau",
  "command.insert-empty": "Leere Kartendefinition einfügen",
  "command.insert-sample": "Beispielkarte einfügen",
  "command.insert-deck": "Deck-Block einfügen",
  "command.property-reference": "Eigenschaften-Referenz anzeigen",

  // ── Settings ────────────────────────────────────────────────────
  "settings.systems.heading": "Systeme",
  "settings.systems.desc":
    "Die Systeme, mit denen deine Karten gerendert werden. Mitgelieferte Systeme kommen mit dem Plugin; ein Vault-System ist ein Ordner in deinem Vault mit einer game-system.yaml. Pro Id darf höchstens ein System eingeschaltet sein.",
  "settings.system.bundled": "Mit dem Plugin mitgeliefert",
  "settings.system.folder": "Vault-Ordner: {path}",
  "settings.system.copy": "In den Vault kopieren",
  "settings.system.remove": "Entfernen",
  "settings.add.name": "Vault-System hinzufügen",
  "settings.add.desc":
    "Der Ordner mit der game-system.yaml des Systems. Er wird beim Hinzufügen gelesen und geprüft.",
  "settings.add.placeholder": "Ordner im Vault",
  "settings.add.button": "Hinzufügen",
  "settings.add.registered": "System „{id}“ aus {path} registriert",
  "settings.add.already": "{path} ist bereits registriert",
  "settings.add.no-folder": "Zuerst einen Ordner angeben",
  "settings.preferences.heading": "Einstellungen",
  "settings.preview-height.name": "Vorschauhöhe",
  "settings.preview-height.desc":
    "Höhe einer Karte in der Vorschau in der Notiz, in Pixeln. Eine Notiz kann sie mit display-height überschreiben.",
  "settings.paper-background.name": "Papierhintergrund",
  "settings.paper-background.desc":
    "Ob ein Deck die Hintergrundtexturen des Systems druckt. Ein Deck kann es mit paper-background überschreiben.",
  "settings.paper-background.textured": "Texturiert",
  "settings.paper-background.plain": "Schlicht",
  "settings.language.name": "Sprache",
  "settings.language.desc": "Sprache der Oberfläche des Plugins.",
  "settings.language.auto": "Wie Obsidian",
  "settings.language.en": "English",
  "settings.language.de": "Deutsch",
};

export type StringKey = keyof typeof en;
type Strings = Record<StringKey, string>;

/** The two tables, for the test that holds them to each other. */
export const STRINGS: Record<ResolvedLanguage, Strings> = { en, de };

/** A language the plugin has words in. */
export type ResolvedLanguage = "en" | "de";

let current: ResolvedLanguage = "en";

/**
 * Which table `auto` means: Obsidian's own language when the plugin has it,
 * English otherwise. `obsidianLanguage` is what `getLanguage()` returns.
 */
export function resolveUiLanguage(
  setting: UiLanguage,
  obsidianLanguage: string
): ResolvedLanguage {
  const wanted = setting === "auto" ? obsidianLanguage : setting;
  return wanted.toLowerCase().startsWith("de") ? "de" : "en";
}

/** Switch the table every later `t` reads. */
export function setUiLanguage(language: ResolvedLanguage): void {
  current = language;
}

export function uiLanguage(): ResolvedLanguage {
  return current;
}

/** The string for `key` in the current language, its `{placeholders}` filled from `params`. */
export function t(key: StringKey, params?: Record<string, string | number>): string {
  return fill(STRINGS[current][key], params);
}

function fill(text: string, params?: Record<string, string | number>): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match
  );
}
