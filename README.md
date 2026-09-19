# Cardsmith

An [Obsidian](https://obsidian.md) plugin that turns your notes into
print-ready, double-sided card decks — board game components, reference
cards, flash cards, any deck you print.

A note is a card. A folder of notes is a deck. A *system* gives the cards
their look and vocabulary: Cardsmith bundles twelve and lets you write your
own in the vault.

![A printed sheet: nine cards on A4 with cut marks](docs/images/sheet-front.png)

The back of the same sheet, mirrored for duplex printing — the last card
spilled onto a second one, and the sheet knows:

![The sheet's back page](docs/images/sheet-back.png)

## Install

- **From Obsidian**: *Settings → Community plugins → Browse*, search for
  *Cardsmith*, install, enable. (Until the plugin is in the list, install
  it through [BRAT](https://github.com/TfTHacker/obsidian42-brat): add the
  repository `manolitto/obsidian-cardsmith` there.)
- **From a checkout**, for development: link the repository into a vault's
  plugin folder and enable the *Hot Reload* community plugin there.

  ```bash
  ln -s "$(pwd)" /path/to/vault/.obsidian/plugins/cardsmith
  ```

Cardsmith needs Obsidian 1.8.7 or newer. The PDF export needs the desktop
app; everything else works on a phone too.

## Sixty seconds

Put a `cardsmith` block in a note. This one uses the bundled `simple`
system:

````yaml from=tests/fixtures/simple/Rope of Climbing.md
```cardsmith
card:
  system: simple
  card-type: simple
data:
  content: "Sixty feet of silk rope that climbs on command."
  game-name: "Chronicles of the Ember Coast"
  card-type-label: "Wondrous Item"
```
````

In reading view the block shows the card, front and back, as it will
print:

![A card note in reading view, the card's two faces under the text](docs/images/preview.png)

The title is the note's name; everything else is a property the
system knows — `content`, `game-name`, `reference` — written under
`data:`, in the note's frontmatter, or as the note's own text and `##`
sections. *Insert sample card* in the command palette writes a block with
every property filled in, and *Show property reference* lists them.

To print a folder of such notes, add a deck note beside them:

````yaml from=tests/fixtures/simple/_deck.md
```cardsmith-deck
system: simple
```
````

The block shows how many cards it found and three buttons: *Preview*,
*Export PDF*, *Export HTML*. The PDF lands beside the note — fronts and
backs on alternating pages, so a duplex print comes out aligned — and
opens in a new pane.

## What is in the box

| | |
|---|---|
| [Cards](docs/cards.md) | The `cardsmith` block: card settings, where a card's properties come from, tables that make one card per row, pictures, the preview |
| [Decks](docs/decks.md) | The `cardsmith-deck` block: selecting notes, sort order, copies, card and paper sizes, cut marks, duplex, the two exports and the preview pane |
| [Settings](docs/settings.md) | The systems list, adding your own, copying a bundled one into the vault, the three preferences |
| [Bundled systems](docs/systems.md) | The twelve card designs that ship with the plugin, their card types, sizes and languages |
| [Writing a system](docs/authoring/system.md) | A folder with a YAML root document, templates, stylesheets and fonts — starting from a copy of `simple` |

## Licence

MIT for the code. The bundled fonts, icons, images and the games the
systems are drawn for carry their own terms — [NOTICE.md](NOTICE.md)
lists them. Cardsmith is an unofficial, fan-made tool, affiliated with
none of the publishers named there.
