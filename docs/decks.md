# Decks

A deck is a folder of card notes and a note beside them that carries a
`cardsmith-deck` block. The block says which notes are in, how they are
ordered and how they go onto paper; the plugin lays the cards out, puts
them on pages and writes a PDF or an HTML file.

````yaml from=tests/fixtures/simple/_deck.md
```cardsmith-deck
system: simple
```
````

That is a complete deck: every card note of the `simple` system in the
deck note's own folder, on A4 in whichever orientation holds more cards.
Everything else has a default. *Insert deck block* in the command palette
writes a block with every key as a comment, each with its explanation.

## Which notes

| Key | Meaning |
|---|---|
| `system` | Required. Notes of another system are left out. |
| `card-type` | One id or a list. Only notes of these card types; the list is also the print order of the groups. Default: every card type. |
| `folder` | The folder whose card notes are the deck. Default: the deck note's own; `""` is the vault root. |
| `folder-recursive` | `true` includes the folder's subfolders. |
| `include-tags-all`, `include-tags-any`, `exclude-tags-any`, `exclude-tags-all` | Tag filters on the notes' tags, written as Obsidian shows them (`#Waffe` or `Waffe`, either). |
| `card-languages` | Only the cards that print in one of these languages. |

A note is in the deck when its block's `system` is the deck's, its card
type is listed (or none is), the tag filters agree and its language is
listed (or none is).

## Order, and copies

Cards print grouped by card type — in the order of the block's
`card-type:` list, else the system's order. Within a group, cards with a
roll range come first, ascending; then by name, numerically aware, so
`Wolf 2` precedes `Wolf 10`.

A card prints once unless its own `copies` says otherwise, and the deck can
override that by name:

```yaml
card-copies:
  - { name: Wolf, copies: 3 }
```

A card that spilled onto three faces printed twice is six physical cards,
consecutively.

## The paper

| Key | Meaning |
|---|---|
| `paper-size` | A preset (`A3`, `A4`, `A5`, `Letter`, `Legal`) or `210 x 297 mm`. A preset alone lets the deck pick the orientation that holds more cards; `A4 portrait` fixes it. |
| `page-margin` | Blank space around the card grid, in millimetres. |
| `cut-marks` | `{enabled: true, length: 3, margin: 0, color: '#aaaaaa', weight: 0.25}` — short lines in the margins, one pair per cut, never across a card face. The fields merge, so one can change alone. |
| `duplex-flip` | Which edge is the binding when printing duplex, `long-edge` or `short-edge`, so a back lands behind its front. |
| `paper-background` | `textured` prints the system's background pictures, `plain` leaves them out. Default: the plugin setting. |

The cards are packed without gaps on one grid and centred inside the
margin. A paper the size of the card prints one borderless card — for
digital play.

## The cards' settings

Every card setting a note may write, a deck block may write too:
`card-size`, `overflow-mode`, `side`, `language`, `copies` and the rest
(see [Cards](cards.md)). A deck's value beats the card type's; a note's
own value beats the deck's — with one exception. **A deck is one grid,
so it is one card size:** a deck block that names `card-size` prints
every card at it and reports each note it overrode. A deck of two sizes
without the key refuses to export, naming both.

`side: front` on the deck prints fronts only, and the deck has no back
pages then.

## Pages

Pages come in print order: a sheet's front, then its back — when any card
in the deck has one. On the back page every card sits where its front
lands after the flip, so a duplex print aligns from the first sheet to the
last. A deck without backs prints no blank sheets.

## The block in reading view

The deck block shows a summary — system, card types, folder, how many
notes it found and of which types, paper, card size — and three buttons:

- **Preview** builds the deck — the button counts the cards as they
  render and lay out — and opens it in a pane of its own, the pages
  scaled to the pane's width, with *Rebuild* in the toolbar.
- **Export PDF** builds the deck and prints it: fronts and backs on
  alternating pages, the paper the block says. The file lands beside the
  deck note under its name (or at `output-path`) and opens in a new pane.
  Desktop only.
- **Export HTML** writes the same pages as one self-contained file,
  fonts and pictures included, and hands it on: on the desktop it opens
  in whatever opens HTML — the browser, with its print dialog — and on a
  phone it goes to the share sheet where the app can offer one, from
  where a browser, a printer or the file manager can take it. Where it
  cannot, the notice says so, and the file waits beside the note for the
  file manager. Obsidian itself shows no HTML; its file explorer lists
  the file only with *Detect all file extensions* switched on under
  *Files and links*.

The same three are commands in the palette, for the deck note that is
open: *Preview deck*, *Export deck as PDF*, *Export deck as HTML*.

Whatever the build had to report — a note it overrode, a card cut at the
type floor, a picture it did not find — is counted in a notice and listed
in the developer console.
