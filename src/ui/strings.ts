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
  "card-key.side":
    "Which faces the card has, in the preview and in a deck: `front`, `back` or `both`.",
  "card-key.display-height": "Height of the in-note preview, in pixels.",
  "card-key.copies": "How many times the card is printed in a deck.",
  "card-key.expand-by-roll":
    "Print one card per value of the roll range between `roll-min` and `roll-max`.",
  "card-key.language":
    "The language the card is printed in — which translation table its captions come from.",

  // ── The deck block and the exports ──────────────────────────────
  "deck.system": "System",
  "deck.card-types": "Card types",
  "deck.all-card-types": "all",
  "deck.folder": "Folder",
  "deck.root-folder": "the vault root",
  "deck.notes": "Notes",
  "deck.notes.count": "{count} notes",
  "deck.notes.none": "no card note matches",
  "deck.paper": "Paper",
  "deck.card-size": "Card size",
  "deck.sides": "Sides",
  "deck.sides.front": "fronts only",
  "deck.sides.back": "backs only",
  "deck.preview": "Preview",
  "deck.export-pdf": "Export PDF",
  "deck.export-html": "Export HTML",
  "view.title": "Deck preview",
  "view.rebuild": "Rebuild",
  "view.summary": "{cards} cards on {pages} pages",
  "view.no-file": "The deck note is gone.",
  "view.waiting": "Press Rebuild to build the deck.",
  "progress.starting": "Building the deck…",
  "progress.reading": "Reading the deck…",
  "progress.rendering": "Rendering {done} / {total}…",
  "progress.layout": "Laying out {done} / {total}…",
  "progress.writing": "Writing {path}…",
  "notice.exported": "{cards} cards on {pages} pages — {path}",
  "notice.html-written":
    "Obsidian shows no HTML: open {path} from the file manager, or share it from there.",
  "notice.clipped": "Cut at the smallest type size: {names}",
  "notice.warnings": "{count} warnings — see the developer console",

  // ── The keys of the deck block, for the template it writes ──────
  "deck-key.folder":
    'The vault folder whose card notes are the deck. Default: the deck note\'s own folder; "" is the vault root.',
  "deck-key.include-tags-all": "A note must carry every one of these tags.",
  "deck-key.include-tags-any": "A note must carry at least one of these tags.",
  "deck-key.exclude-tags-any": "A note carrying any one of these tags is left out.",
  "deck-key.exclude-tags-all": "A note carrying every one of these tags is left out.",
  "deck-key.card-languages":
    "Only the cards that print in one of these languages. Default: every card.",
  "deck-key.output-path":
    "Where the exports go, with either extension. Default: beside the deck note, under its name.",
  "deck-key.paper-size":
    "A preset (A3, A4, A5, Letter, Legal) or `210 x 297 mm`; a preset alone lets the deck pick the orientation that holds more cards.",
  "deck-key.page-margin": "Blank space around the card grid, in millimetres.",
  "deck-key.duplex-flip":
    "Which paper edge is the binding when printing duplex, so fronts and backs align: `long-edge` or `short-edge`.",
  "deck-key.cut-marks":
    "The alignment marks in the margins; the fields merge, so one can change alone.",
  "deck-key.paper-background":
    "`textured` prints the system's background pictures, `plain` leaves them out. Default: the plugin setting.",
  "deck-key.folder-recursive": "Include the folder's subfolders.",
  "deck-key.card-copies":
    "Copies per card by note name, winning over a card's own `copies`: `[{ name: Wolf, copies: 3 }]`.",

  // ── Copying a bundled system into the vault ─────────────────────
  "copy.title": "Copy {name} into the vault",
  "copy.intro":
    "Every file of the system is written into the folder, so the copy is yours to edit. It stops receiving the plugin's updates.",
  "copy.name": "Name",
  "copy.name.desc": "What the pickers and the settings call the copy.",
  "copy.name.default": "Copy of {name}",
  "copy.folder": "Folder",
  "copy.id": "System id",
  "copy.id.desc":
    "Keep the id, and the bundled original is switched off; no note changes. Choose a new one, and the notes naming the old id can be rewritten.",
  "copy.confirm": "Copy",
  "copy.cancel": "Cancel",
  "copy.no-folder": "Name a folder for the copy",
  "copy.invalid-id": "An id is lowercase letters, digits and hyphens",
  "copy.exists": "{path} already exists",
  "copy.done": "Copied into {path} and switched on",
  "copy.rewrite.title": "Rewrite the notes?",
  "copy.rewrite.body":
    "{count} notes name system: {from} in their cardsmith or cardsmith-deck block. Rewrite them to {to}?",
  "copy.rewrite.confirm": "Rewrite {count} notes",
  "copy.rewrite.skip": "Leave them",
  "copy.rewrite.done": "{count} notes rewritten",

  // ── Settings ────────────────────────────────────────────────────
  "settings.systems.heading": "Systems",
  "settings.systems.desc":
    "The systems your cards can be rendered with. Bundled systems ship with the plugin; a vault system is a folder in your vault with a YAML document at its top naming the system. At most one system per id may be switched on. Obsidian's file explorer lists a system's files (.yaml, .hbs, .css) only with \"Detect all file extensions\" switched on under Files and links.",
  "settings.system.bundled": "Bundled with the plugin",
  "settings.system.file": "Vault file: {path}",
  "settings.system.copy": "Copy into vault",
  "settings.system.remove": "Remove",
  "settings.add.name": "Add a vault system",
  "settings.add.desc":
    "The system's YAML document in the vault. It is read and checked when you add it.",
  "settings.add.placeholder": "YAML file in the vault",
  "settings.add.button": "Add",
  "settings.add.registered": 'Registered system "{id}" from {path}',
  "settings.add.replaced":
    'Switched off {count} other systems with the id "{id}" — a note names its system by id, and the one just added is the one meant.',
  "settings.add.already": "{path} is already registered",
  "settings.add.no-file": "Pick a file first",
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
    "Welche Seiten die Karte hat, in der Vorschau und im Deck: `front`, `back` oder `both`.",
  "card-key.display-height": "Höhe der Vorschau in der Notiz, in Pixeln.",
  "card-key.copies": "Wie oft die Karte in einem Deck gedruckt wird.",
  "card-key.expand-by-roll":
    "Eine Karte je Wert des Würfelbereichs zwischen `roll-min` und `roll-max` drucken.",
  "card-key.language":
    "Die Sprache, in der die Karte gedruckt wird — aus welcher Übersetzungstabelle ihre Beschriftungen kommen.",

  // ── The deck block and the exports ──────────────────────────────
  "deck.system": "System",
  "deck.card-types": "Kartentypen",
  "deck.all-card-types": "alle",
  "deck.folder": "Ordner",
  "deck.root-folder": "die Vault-Wurzel",
  "deck.notes": "Notizen",
  "deck.notes.count": "{count} Notizen",
  "deck.notes.none": "keine Kartennotiz passt",
  "deck.paper": "Papier",
  "deck.card-size": "Kartengröße",
  "deck.sides": "Seiten",
  "deck.sides.front": "nur Vorderseiten",
  "deck.sides.back": "nur Rückseiten",
  "deck.preview": "Vorschau",
  "deck.export-pdf": "PDF exportieren",
  "deck.export-html": "HTML exportieren",
  "view.title": "Deck-Vorschau",
  "view.rebuild": "Neu aufbauen",
  "view.summary": "{cards} Karten auf {pages} Seiten",
  "view.no-file": "Die Deck-Notiz ist verschwunden.",
  "view.waiting": "Neu aufbauen drücken, um das Deck zu bauen.",
  "progress.starting": "Deck wird gebaut …",
  "progress.reading": "Deck wird gelesen…",
  "progress.rendering": "Rendern {done} / {total}…",
  "progress.layout": "Setzen {done} / {total}…",
  "progress.writing": "Schreibe {path}…",
  "notice.exported": "{cards} Karten auf {pages} Seiten — {path}",
  "notice.html-written":
    "Obsidian zeigt kein HTML an: {path} im Dateimanager öffnen oder von dort teilen.",
  "notice.clipped": "Bei der kleinsten Schriftgröße abgeschnitten: {names}",
  "notice.warnings": "{count} Warnungen — siehe Entwicklerkonsole",

  // ── The keys of the deck block, for the template it writes ──────
  "deck-key.folder":
    'Der Vault-Ordner, dessen Kartennotizen das Deck sind. Standard: der Ordner der Deck-Notiz; "" ist die Vault-Wurzel.',
  "deck-key.include-tags-all": "Eine Notiz muss jedes dieser Tags tragen.",
  "deck-key.include-tags-any": "Eine Notiz muss mindestens eines dieser Tags tragen.",
  "deck-key.exclude-tags-any": "Eine Notiz mit einem dieser Tags bleibt draußen.",
  "deck-key.exclude-tags-all": "Eine Notiz mit allen diesen Tags bleibt draußen.",
  "deck-key.card-languages":
    "Nur die Karten, die in einer dieser Sprachen gedruckt werden. Standard: jede Karte.",
  "deck-key.output-path":
    "Wohin die Exporte gehen, mit einer der beiden Endungen. Standard: neben der Deck-Notiz, unter ihrem Namen.",
  "deck-key.paper-size":
    "Ein Preset (A3, A4, A5, Letter, Legal) oder `210 x 297 mm`; ein Preset allein lässt das Deck die Ausrichtung wählen, die mehr Karten fasst.",
  "deck-key.page-margin": "Rand um das Kartenraster, in Millimetern.",
  "deck-key.duplex-flip":
    "Welche Papierkante beim Duplexdruck die Bindung ist, damit Vorder- und Rückseiten übereinanderliegen: `long-edge` oder `short-edge`.",
  "deck-key.cut-marks":
    "Die Schnittmarken in den Rändern; die Felder verschmelzen, eines lässt sich allein ändern.",
  "deck-key.paper-background":
    "`textured` druckt die Hintergrundbilder des Systems, `plain` lässt sie weg. Standard: die Plugin-Einstellung.",
  "deck-key.folder-recursive": "Die Unterordner des Ordners einschließen.",
  "deck-key.card-copies":
    "Kopien je Karte nach Notizname, vor dem eigenen `copies` der Karte: `[{ name: Wolf, copies: 3 }]`.",

  // ── Copying a bundled system into the vault ─────────────────────
  "copy.title": "{name} in den Vault kopieren",
  "copy.intro":
    "Jede Datei des Systems wird in den Ordner geschrieben; die Kopie gehört dir. Sie bekommt keine Aktualisierungen des Plugins mehr.",
  "copy.name": "Name",
  "copy.name.desc": "So heißt die Kopie in den Auswahllisten und den Einstellungen.",
  "copy.name.default": "Kopie von {name}",
  "copy.folder": "Ordner",
  "copy.id": "System-Id",
  "copy.id.desc":
    "Bleibt die Id, wird das mitgelieferte Original ausgeschaltet; keine Notiz ändert sich. Bei einer neuen Id können die Notizen mit der alten umgeschrieben werden.",
  "copy.confirm": "Kopieren",
  "copy.cancel": "Abbrechen",
  "copy.no-folder": "Einen Ordner für die Kopie angeben",
  "copy.invalid-id": "Eine Id besteht aus Kleinbuchstaben, Ziffern und Bindestrichen",
  "copy.exists": "{path} existiert bereits",
  "copy.done": "Nach {path} kopiert und eingeschaltet",
  "copy.rewrite.title": "Notizen umschreiben?",
  "copy.rewrite.body":
    "{count} Notizen nennen system: {from} in ihrem cardsmith- oder cardsmith-deck-Block. Auf {to} umschreiben?",
  "copy.rewrite.confirm": "{count} Notizen umschreiben",
  "copy.rewrite.skip": "So lassen",
  "copy.rewrite.done": "{count} Notizen umgeschrieben",

  // ── Settings ────────────────────────────────────────────────────
  "settings.systems.heading": "Systeme",
  "settings.systems.desc":
    "Die Systeme, mit denen deine Karten gerendert werden. Mitgelieferte Systeme kommen mit dem Plugin; ein Vault-System ist ein Ordner in deinem Vault mit einem YAML-Dokument darin, das das System benennt. Pro Id darf höchstens ein System eingeschaltet sein. Obsidians Dateiexplorer zeigt die Dateien eines Systems (.yaml, .hbs, .css) nur, wenn unter „Dateien und Links“ „Alle Dateierweiterungen erkennen“ eingeschaltet ist.",
  "settings.system.bundled": "Mit dem Plugin mitgeliefert",
  "settings.system.file": "Vault-Datei: {path}",
  "settings.system.copy": "In den Vault kopieren",
  "settings.system.remove": "Entfernen",
  "settings.add.name": "Vault-System hinzufügen",
  "settings.add.desc":
    "Das YAML-Dokument des Systems im Vault. Es wird beim Hinzufügen gelesen und geprüft.",
  "settings.add.placeholder": "YAML-Datei im Vault",
  "settings.add.button": "Hinzufügen",
  "settings.add.registered": "System „{id}“ aus {path} registriert",
  "settings.add.replaced":
    "{count} andere Systeme mit der Id „{id}“ ausgeschaltet — eine Notiz nennt ihr System über die Id, und gemeint ist das gerade hinzugefügte.",
  "settings.add.already": "{path} ist bereits registriert",
  "settings.add.no-file": "Zuerst eine Datei auswählen",
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
  return translate(current, key, params);
}

/** The same in a named language — for a pure builder that takes the language as an argument. */
export function translate(
  language: ResolvedLanguage,
  key: StringKey,
  params?: Record<string, string | number>
): string {
  return fill(STRINGS[language][key], params);
}

function fill(text: string, params?: Record<string, string | number>): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match
  );
}
