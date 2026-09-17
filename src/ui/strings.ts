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

  // ── The in-note preview ─────────────────────────────────────────
  "preview.laying-out": "Laying out…",
  "preview.no-card": "This note yields no card.",
  "preview.clipped":
    "Content was cut at the smallest type size; the card prints as shown.",
  "preview.step": "{index} / {count}",
  "preview.previous": "Previous card",
  "preview.next": "Next card",

  // ── Pickers, the insert commands, the reference ─────────────────
  "picker.system": "Choose a system",
  "picker.card-type": "Choose a card type",
  "picker.no-systems": "No system is switched on in the settings",
  "insert.no-properties": "This card type puts no property on the card",
  "insert.no-sample": "no sample",
  "reference.title": "{system} — {cardType}",
  "reference.key": "Key",
  "reference.description": "Description",
  "reference.aliases": "Also written as",
  "reference.sample": "Example",
  "reference.slot": "Place on the card",
  "reference.card-keys": "Keys of card:",
  "reference.insert-empty": "Insert empty",
  "reference.insert-sample": "Insert sample",
  "reference.copy": "Copy sample",
  "reference.copied": "The sample block is on the clipboard",
  "reference.no-editor": "Open a note in the editor first",

  // ── The keys of `card:` — a note's, a deck's layer alike ────────
  "card-key.system": "The system the card is rendered with. Required.",
  "card-key.card-type": "The card type. Required unless the system has exactly one.",
  "card-key.card-size":
    "A preset (mini, bridge, poker, tarot, dixit, large) or `63 x 88 mm`, either followed by `landscape`.",
  "card-key.overflow-mode":
    "What a card does when its text does not fit at the smallest type size: `none` clips, `extra-cards` continues on further cards, `back-then-cards` fills the back first.",
  "card-key.layouts": "The named ways the card may be laid out; a design's concern.",
  "card-key.layout-decision": "How the winning layout is chosen; a design's concern.",
  "card-key.side": "Which face the in-note preview shows: `front`, `back` or `both`.",
  "card-key.display-height": "Height of the in-note preview, in pixels.",
  "card-key.copies": "How many times the card is printed in a deck.",
  "card-key.expand-by-roll":
    "Print one card per value of the roll range between `roll-min` and `roll-max`.",
  "card-key.language":
    "The language the card is printed in — which translation table its captions come from.",

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

  // ── The in-note preview ─────────────────────────────────────────
  "preview.laying-out": "Wird gesetzt…",
  "preview.no-card": "Diese Notiz ergibt keine Karte.",
  "preview.clipped":
    "Der Inhalt wurde bei der kleinsten Schriftgröße abgeschnitten; die Karte wird so gedruckt.",
  "preview.step": "{index} / {count}",
  "preview.previous": "Vorige Karte",
  "preview.next": "Nächste Karte",

  // ── Pickers, the insert commands, the reference ─────────────────
  "picker.system": "System wählen",
  "picker.card-type": "Kartentyp wählen",
  "picker.no-systems": "In den Einstellungen ist kein System eingeschaltet",
  "insert.no-properties": "Dieser Kartentyp bringt keine Eigenschaft auf die Karte",
  "insert.no-sample": "kein Beispiel",
  "reference.title": "{system} — {cardType}",
  "reference.key": "Schlüssel",
  "reference.description": "Beschreibung",
  "reference.aliases": "Auch schreibbar als",
  "reference.sample": "Beispiel",
  "reference.slot": "Platz auf der Karte",
  "reference.card-keys": "Schlüssel von card:",
  "reference.insert-empty": "Leer einfügen",
  "reference.insert-sample": "Beispiel einfügen",
  "reference.copy": "Beispiel kopieren",
  "reference.copied": "Der Beispielblock liegt in der Zwischenablage",
  "reference.no-editor": "Zuerst eine Notiz im Editor öffnen",

  // ── The keys of `card:` — a note's, a deck's layer alike ────────
  "card-key.system": "Das System, mit dem die Karte gerendert wird. Pflicht.",
  "card-key.card-type": "Der Kartentyp. Pflicht, außer das System hat genau einen.",
  "card-key.card-size":
    "Ein Preset (mini, bridge, poker, tarot, dixit, large) oder `63 x 88 mm`, jeweils optional gefolgt von `landscape`.",
  "card-key.overflow-mode":
    "Was eine Karte tut, wenn ihr Text bei der kleinsten Schriftgröße nicht passt: `none` schneidet ab, `extra-cards` setzt auf weiteren Karten fort, `back-then-cards` füllt zuerst die Rückseite.",
  "card-key.layouts": "Die benannten Arten, die Karte zu setzen; Sache des Designs.",
  "card-key.layout-decision":
    "Wie das gewinnende Layout gewählt wird; Sache des Designs.",
  "card-key.side":
    "Welche Seite die Vorschau in der Notiz zeigt: `front`, `back` oder `both`.",
  "card-key.display-height": "Höhe der Vorschau in der Notiz, in Pixeln.",
  "card-key.copies": "Wie oft die Karte in einem Deck gedruckt wird.",
  "card-key.expand-by-roll":
    "Eine Karte je Wert des Würfelbereichs zwischen `roll-min` und `roll-max` drucken.",
  "card-key.language":
    "Die Sprache, in der die Karte gedruckt wird — aus welcher Übersetzungstabelle ihre Beschriftungen kommen.",

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
