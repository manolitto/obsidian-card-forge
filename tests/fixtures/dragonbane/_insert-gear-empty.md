```card-forge
card:
  system: dragonbane
  card-type: gear
data:
  # Item's name.
  name:

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

  # Grip — "1H" for one-handed or "2H" for two-handed.
  grip:

  # Range in metres for ranged weapons, or a short value like "2" / "STR" for melee weapons.
  range:

  # Damage as dice notation (lower-case "d" in English, e.g. "2d8").
  damage:

  # Durability — how much damage the weapon can parry before it gets damaged.
  durability:

  # Armor Rating — how many damage points the armor subtracts from an attack. Helmets use "+1" / "+2" because they're worn in addition.
  armor-rating:

  # Typical cost of the item in gold, silver or copper coins.
  price:

  # Supply rating of the item: Common, Uncommon, Rare or Unique.
  availability:

  # Encumbrance as a multiple of the standard unit (1 = one normal item). Use "1/4" for tiny items, "–" for negligible weight, and "Bundle" for loosely bundled items.
  weight:

  # Number of uses before the item is consumed (e.g. 10 bandages, 10 doses of perfume).
  uses:

  # Weapon features as a comma-separated list (Slashing, Piercing, Bludgeoning, Long, Toppling, Subtle).
  traits:

  # Skill used to wield the weapon (e.g. Swords, Axes, Bows). Free text is allowed for special cases. Rendered as the wide closing "Requirement" line, with the minimum STR beside it.
  skill:

  # Minimum STR required to wield the weapon effectively without a bane. Rendered as a value of its own after the skill, in the rulebook weapon table's column order (Rules p. 74).
  min-strength:

  # Mechanical effect — what the card does when it triggers.
  effect:
```
