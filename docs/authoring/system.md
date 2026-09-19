# Writing a system

A system is a folder with one YAML document at its top — the *root
document*. It names the system, its faces, stylesheets and fonts, and
describes the properties a card of that system has. Everything a card
type needs is declared there or in a card-type document the root names.

The shortest way to a system of your own is a copy: *Copy into vault* on
a bundled system's row in the settings writes the whole folder into your
vault, registered and switched on. The `simple` system is the smallest
complete one — a hundred lines of YAML, two templates, one stylesheet.

## The root document

```yaml from=resources/systems/simple/simple.yaml
id: simple
name: Simple
```

| Key | Holds |
|---|---|
| `id` | The id notes name in `system:`. Lowercase letters, digits and hyphens. |
| `name` | What the settings and the pickers call the system. |
| `languages` | The languages the system has captions for, first one the default a card prints in. |
| `stylesheet` | The system's stylesheet, one path. |
| `partial-templates` | Named partials the faces call: `stat-cell: templates/stat-cell.hbs`. |
| `markdown-image-partial` | The partial an `![[embed]]` in a note's body renders through, by name. |
| `properties` | The properties every card type has — see [Properties](properties.md). |
| `translations` | Captions per language, `de: { back-label: "…" }`. |
| `glyphs`, `classifiers` | How a place spells a value out, and how it classes one — see [Properties](properties.md). |
| `card-types` | One entry per card type, inline or as a document of its own. |
| card settings | `card-size`, `overflow-mode`, `layouts`, … — defaults for every card of the system, the same keys a note may write under `card:`. |

Anything else at the top is reported as not a card setting.

## Card types

A card type is a mapping under `card-types:` with the same keys as the
root where they make sense — `front-template`, `back-template`,
`stylesheet`, `properties`, `translations`, `glyphs`, `classifiers`, card
settings — each layered over the system's. A card type with one template
prints one face.

```yaml from=resources/systems/simple/simple.yaml
card-types:
  # The one, universal card type. As the system's only one, a note need not
  # even name it.
  simple:
    front-template: templates/front.hbs
    back-template: templates/back.hbs
```

A card type with many properties can be a document of its own, named by
its entry; the file holds the card type's mapping and nothing else:

```yaml from=resources/systems/dragonbane/dragonbane.yaml
card-types:
  gear:       card-types/gear.yaml
  creature:   card-types/creature.yaml
  rule:       card-types/rule.yaml
  roll-table: card-types/roll-table.yaml
  generic:    card-types/generic.yaml
```

Card-type ids are singular English (`gear`, `npc`, `creature`) whatever
the content language; the language shows in the captions, not the ids.

## Files, and how they are found

**Every path is relative to the system folder**, wherever the referring
file sits: `styles/gear.css` writes `url(assets/frame.png)`, a template
writes `{{asset "assets/logo.png"}}`, and the root writes
`stylesheet: styles/simple.css`.

**Roots are declared, leaves are derived.** The root document names the
templates, stylesheets and partials. Images and fonts are not listed
anywhere: a `url()` in a stylesheet, an `{{asset}}` in a template or a
property `default:` ending in an image extension *is* the declaration.
Nothing is found by naming convention, and there is no fallback — a
declared or referenced file that is missing is reported.

The bundled folders sort their files by kind, and a system of yours may
do the same or not; the loader knows none of these names:

```
simple/
  simple.yaml            the root document
  card-types/            one document per card type, when they are files
  templates/             faces and partials
  styles/                the system's stylesheet, a card type's
  fonts/                 .woff2 with the licence text beside each
  assets/                pictures
```

A file the system never names — a sample note, a scratch stylesheet — is
simply not part of it.

## The checks

A system is checked when it loads: when you add it in the settings, and
again whenever a file under its folder changes.

- **Declared files exist** — every template, stylesheet, partial and
  card-type document; every image and font a stylesheet, template or
  default refers to.
- **The bindings match the templates.** A property's `slot:` must name a
  place some template of that card type reads; a binding to a place no
  template mentions is reported with the system and card type. This is the
  typo check on both sides — a slot misspelt in the template shows up as
  the binding that nothing reads.
- **The document says the id it was registered under.**

A problem in one card type does not take the others down: the system loads
with what is sound, and the settings row and the cards show what is not.

## Vault systems

The root document must be a `.yaml` or `.yml` file in the vault, not at the
vault root and not in a hidden folder — Obsidian raises no change events
under `.obsidian/` and the system would never reload. Obsidian's file
explorer shows the system's files only with *Detect all file extensions*
switched on under *Files and links*; the plugin reads them regardless.
