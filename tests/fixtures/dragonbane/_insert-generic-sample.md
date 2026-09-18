```cardsmith
card:
  system: dragonbane
  card-type: generic
data:
  # Title on the parchment plaque at the head of the card. Falls back to the note's file name.
  name: Licences & Credits

  # Card-back image as a wikilink. Without it the back shows what the card type provides (a creature's portrait), else the deck's emblem. `front-image` does not feed this — it is front-only.
  back-image: '[[Medaillon.png]]'

  # Card family — the large green title at the top of the back. Without it the card type's own label appears there ("Ausrüstung", "Waffe"). For roll tables put the table's name here ("Demon Roll in Melee", "Fear", "Hunting"); it then doubles as the title fallback when the table row has no name of its own. In a table note, set once in the frontmatter for all rows.
  category: Fishing

  # Finer grouping within the card family — rendered as the small parchment plaque under the back's illustration (e.g. "Clothing", "Tool", "Trade good"). Without it the plaque is omitted; if the value equals `category` it is suppressed as well.
  subcategory: Tool

  # Source reference — book title with page number, or a wikilink into the vault. Set upright along the card's right edge; falls back to "DRAGONBANE".
  book-reference: Rules p. 73

  # Card body as markdown, inline in the cardsmith block. Takes precedence over the note's text. Use the note's text for tables and embedded pictures.
  content: Compiled and designed by **your name here**.

  # The section under a `## Vorderseite` heading in the note fills the card when the block sets no `content`. Fully rendered — tables, headings, lists and embedded pictures included.
  vorderseite: # no sample
```
