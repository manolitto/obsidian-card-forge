# Cards

A note is a card when it carries a `cardsmith` block. The block names the
system and the card type; the card's content comes from the whole note.

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

In reading view the block is replaced by the card — every face, front and
back, at the size it prints. Edit the note and the card follows.

## The block

The block has three top-level keys, and only these:

| Key | Holds |
|---|---|
| `card:` | `system`, `card-type`, and the card's own settings (below) |
| `data:` | property values, `name: value` |
| `table:` | in a table note, which column feeds which property |

`system` is required. `card-type` is required unless the system has exactly
one card type. A note holds one block; a second is reported and ignored.

## Where a property's value comes from

A property is looked up in four places, each winning over the one before:

1. **The note's text.** Everything before the first `##` heading is the
   property `body`; every `##` heading is a property named after it in
   kebab-case — `## Front Side` becomes `front-side`. Code blocks are
   dropped, so the `cardsmith` block itself never lands on a card.
2. **The frontmatter**, key by key.
3. **`data:`** in the block.
4. **A table row**, in a table note (below).

Keys are matched case-insensitively, and each property accepts the aliases
its system declares — `Beschreibung:` and `description:` are the same
property in a system that says so. A property nothing sets falls back to
its default; the card's title falls back to the note's file name.

A note written as prose:

````markdown from=tests/fixtures/dragonbane/Hausregel.md
## Vorderseite

Ein Charakter, der eine **Nacht** ohne Rast verbringt, erhält einen
Nachteil auf alle Proben, bis er wieder geschlafen hat.

%% keep-together %%
- Erste Nacht: Nachteil
- Zweite Nacht: zwei Nachteile
%% /keep-together %%

```cardsmith
card:
  system: dragonbane
  card-type: generic
data:
  name: Schlafentzug
```
````

Values are Markdown: bold, italic, lists, line breaks, wikilinks. Raw HTML
prints as text, except `<br>` and a small inline `<svg>`. Three Obsidian
comments steer how a long text breaks across cards:
`%% card-break %%` starts a new face, `%% keep-together %% … %% /keep-together %%`
holds a region on one face, and `%% keep-with-next %%` /
`%% keep-with-prev %%` bind a block to its neighbour.

## Tables: one card per row

A note with a Markdown table and a `table:` map prints one card per row.
The map names, for each property, the column header that feeds it; a list
of headers folds into a list property. Blank cells set nothing, so the
frontmatter and `data:` still answer for them.

````yaml from=tests/fixtures/dragonbane/Fischfang.md
```cardsmith
card:
  system: dragonbane
  card-type: roll-table
table:
  roll: Würfelwurf
  name: Name
  stats: [Voraussetzungen, Rationen]
  description: Beschreibung
data:
  note: "Der Fang dauert einen Tagesabschnitt."
```
````

A card type that says so can also print one card per value of a roll
range: a row `2–3` becomes two cards, `2` and `3`.

## Pictures

A picture is a wikilink to an image in the vault, in whichever property
the system shows one:

```yaml from=tests/fixtures/5e/Cinder-Hound.md
  image: "[[Cinder-Hound.png]]"
```

An `![[embed]]` in the note's text is a picture too. The picture travels
inside the exported file, so an HTML export is one self-contained page. A
link that resolves to no image is reported under the card.

## Card settings

Under `card:`, beside `system` and `card-type`, a note may set how it
prints. Each setting is answered by the first layer that has it — the
note, then the deck it is printed in, then the card type, then the system.

| Key | Meaning |
|---|---|
| `card-size` | A preset (`mini`, `bridge`, `poker`, `tarot`, `dixit`, `large`) or `63 x 88 mm`, either followed by `landscape`. A deck's own `card-size` wins over the note's. |
| `overflow-mode` | What happens when the text does not fit at the smallest type size: `none` clips, `extra-cards` continues on further cards, `back-then-cards` fills the back first. |
| `side` | Which faces the card has: `front`, `back` or `both`. |
| `copies` | How many times the card is printed in a deck. |
| `language` | The language the card prints in — which translation table its captions come from. |
| `display-height` | Height of the in-note preview, in pixels. |
| `expand-by-roll` | One card per value of the roll range between `roll-min` and `roll-max`. |
| `layouts`, `layout-decision` | The named ways a card may be laid out and how the winner is chosen — a design's concern, set by the system. |

Before it prints, every card is laid out: the type is scaled down towards
the system's floor until the text fits, and what still does not fit
follows `overflow-mode`. A card that spilled shows every physical card in
the preview, in print order.

## The preview

The block in reading view shows the card as it will print. A table note
shows one card at a time with buttons to step through the rows. What the
render had to report — an unknown key, a picture that was not found, text
that was cut at the floor — is listed under the card, once per note.

Two commands write blocks for you: *Insert empty card definition* puts a
block with every property of the chosen system and card type as a
comment, and *Insert sample card* fills them in with sample values. *Show
property reference* opens the same list as a table, with each property's
aliases and description.
