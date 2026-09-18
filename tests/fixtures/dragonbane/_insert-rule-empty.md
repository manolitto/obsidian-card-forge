```cardsmith
card:
  system: dragonbane
  card-type: rule
data:
  # Name of the skill, ability or spell.
  name:

  # Description or rule text of the card — the paragraph below the stat block.
  description:

  # Card-back image as a wikilink. Without it the back shows what the card type provides (a creature's portrait), else the Dragonbane logo. `front-image` does not feed this — it is front-only.
  back-image:

  # Card family — the large green title at the top of the back. Without it the card type's own label appears there ("Ausrüstung", "Waffe"). For roll tables put the table's name here ("Demon Roll in Melee", "Fear", "Hunting"); it then doubles as the title fallback when the table row has no name of its own. In a table note, set once in the frontmatter for all rows.
  category:

  # Finer grouping within the card family — rendered as the small parchment plaque under the back's illustration (e.g. "Clothing", "Tool", "Trade good"). Without it the plaque is omitted; if the value equals `category` it is suppressed as well.
  subcategory:

  # Source reference — book title with page number, or a wikilink into the vault. Set upright along the card's right edge; falls back to "DRAGONBANE".
  book-reference:

  # English original name, set small and upright along the card's left edge — the counterpart to the source reference on the right. Omitted when unset.
  english-original:

  # Picture as a wikilink. Rendered on the card front.
  front-image:

  # Attribute a skill is rolled against: STR, CON, AGL, INT, WIL or CHA.
  attribute:

  # Rank of the spell (1–5) or "Magic trick". Quote it so "Magic trick" can stand alongside the numbers.
  rank:

  # What the character must already have: for abilities a skill at 12 ("Evade 12") or a profession, for spells the school of magic or the prerequisite spell. "–" for none.
  prerequisite:

  # Willpower Points to use it. Abilities: a fixed number, "–" for permanent ones, "variable" when the cost depends on the use. Spells: "1" for magic tricks, "2 per power level" for scaling ones, "2" for spells without power levels (Rules p. 58).
  wp-cost:

  # Requirement — what casting demands: word, gesture, focus (…) or ingredient (…).
  casting-requirement:

  # Casting time — action, reaction, stretch or shift.
  casting-time:

  # Range of the spell in metres, or "Touch" / "Self".
  range:

  # Duration — instant, stretch, shift or permanent.
  duration:

  # Mechanical effect — what the card does when it triggers.
  effect:

  # Free-form note rendered unobtrusively on the card.
  note:
```
