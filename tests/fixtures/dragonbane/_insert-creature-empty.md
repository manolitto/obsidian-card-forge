```cardsmith
card:
  system: dragonbane
  card-type: creature
data:
  # Name of the creature — monster or NPC.
  name:

  # Short flavour description, above the stat block.
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

  # Picture of the creature as a wikilink. Rendered on the back, and at the foot of the front when there is room for it.
  artwork:

  # Hit Points (HP) — the creature is taken out at 0.
  hit-points:

  # Willpower Points (WP) — spent on heroic abilities and magic.
  willpower-points:

  # Damage Bonus from STR — added as a die to melee damage (e.g. "+d4") or "–" if none.
  damage-bonus:

  # Ferocity — number of attacks per round.
  ferocity:

  # Size (tiny, small, normal, large, huge, swarm).
  size:

  # Movement rate in metres (e.g. "10 m" or "6 m, swim 12 m").
  movement:

  # Armor — a monster's natural armor as dice notation or a description, an NPC's worn armor with its rating.
  armor:

  # Skills and ratings as a comma-separated list (uppercase skill names followed by their level).
  skills:

  # NPC's armament as a short list of names with key stats in parentheses (damage, features).
  weapons:

  # List of special traits, each with a name and a description.
  traits:

  # List of heroic abilities, each with a name and a short description.
  talents:

  # Monster attack table (d6: roll, name, desc per entry).
  monster-attacks:

  # Secret GM notes (tactics, weaknesses, lore). Only shown in detailed display mode.
  gm-notes:
```
