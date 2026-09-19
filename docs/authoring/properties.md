# Properties

A property is a named value a card has — `name`, `price`, `description`.
The system declares them under `properties:`, the note sets them, and a
template reads them by the *slot* each is bound to. The declaration is
also the documentation: *Show property reference* and *Insert sample card*
are built from it.

## A property

```yaml from=resources/systems/simple/simple.yaml
  reference:
    aliases: [ref, source, quelle, referenz, page, seite]
    slot: front-reference
    description:
      en: "A small source reference shown in the front footer — a rulebook page or a wikilink."
      de: "Kleine Quellenangabe im Fuß der Vorderseite — eine Regelbuchseite oder ein Wikilink."
    sample:
      en: "Core Rules, p. 152"
      de: "Grundregeln, S. 152"
```

| Key | |
|---|---|
| `aliases` | Other names a note may write the property under — the German word, a short form, a synonym. A note may write the canonical name, an alias, or both. |
| `slot` | The place on the card the value fills; one name or a list. A template reads the slot, never the property. |
| `default` | The value when no note sets one. One value, not one per language. |
| `description` | What the property is, per language — shown in the property reference and as the comment *Insert empty card definition* writes. |
| `sample` | A value per language, for *Insert sample card*. |

A property with no `slot` is data a template can still read through a
helper, or a constant another property's default refers to; a property
with a `default:` and a slot is how a design puts a fixed line on every
card (a wordmark, a logo path) that a note may still override.

## Layers

Properties fold **baseline → system → card type**. The baseline gives every
system eight properties and their aliases:

| Property | Aliases | |
|---|---|---|
| `name` | `display-name`, `title`, `label` | falls back to the note's file name |
| `description` | `desc`, `summary` | |
| `image` | `picture`, `portrait`, `img`, `photo` | |
| `tags` | `tag` | |
| `body` | — | the note's text before its first `##` heading |
| `roll` | `dice-roll`, `würfelwurf`, `wurf`, … | the roll as printed — `"01"`, `"23–24"` |
| `roll-min`, `roll-max` | `roll-from`, `roll-to`, `wurf-von`, `wurf-bis`, … | the range as integers, for sorting and for one card per value |

A card type's entry for a property layers over the system's: **`aliases`
append, `slot` replaces.** A card type that re-binds an inherited property
gives it exactly the slots it names and none of the system's; `slot: ~`
unbinds it.

## Slots

A slot is a name for a place on a card. It exists because a template reads
it — `{{slot "front-title"}}` — and it is filled because a property binds
to it. There is no list of slots to keep: the loader checks every binding
against the templates, and a `slot:` naming a place no template of the
card type reads is reported.

Several properties may bind to one slot; the first that the note sets is
what the place shows, in declaration order with the inherited properties
first. That is how a design offers a place to `subtitle` and falls back to
`category`.

`body`, being a baseline property, comes before a card type's own. A card
type that wants *block over section over the note's text* for a place
lists `body` as the **last alias** of its own property instead of binding
`body` itself:

```yaml from=resources/systems/simple/simple.yaml
  content:
    aliases: [text, description, beschreibung, body]
    slot: front-body
```

## Translations

Captions and labels — what the design prints beside a value — are not
properties but translations, one table per language, on the system and
on the card type:

```yaml from=resources/systems/dragonbane/card-types/gear.yaml
translations:
  de:
    back-label: "Ausrüstung"
    front-stat-1a-label: "Griff"
    front-stat-1b-label: "Reichweite"
```

A template reads them with `{{t "back-label"}}`, or as a slot's caption
with `{{slot-label "front-stat-1a"}}`, which looks up `<slot>-label`. The
card that prints in `de` takes the `de` table; a key the card type lacks
falls through to the system's.

## Glyphs and classifiers

Both are keyed by **slot** — the place decides how a value is spelt out
or how much room it gets — and a card type's table for a place replaces
the system's for that place alone.

**Glyphs** map a stored value to its printed form, read with
`{{slot "front-stat-1a" glyph=true}}`; a value not in the table prints as
written:

```yaml from=resources/systems/dragonbane/card-types/gear.yaml
glyphs:
  front-stat-1a:
    1h: "einhändig"
    2h: "zweihändig"
```

**Classifiers** turn a value into a class token by pattern, read with
`{{slot-class "front-header-die"}}` — so a stylesheet can step a long
value down or widen a box:

```yaml from=resources/systems/dragonbane/dragonbane.yaml
classifiers:
  front-header-die:
    match:
      - { pattern: "^.{1,2}$", token: narrow }       # "7", "20"
      - { pattern: "^\\d[–—-]\\d$", token: narrow }  # "1–2", "5-6"
    default: wide                                    # "9–10", "11–12", "100"
```

The first rule whose pattern matches gives the token, else `default`.
