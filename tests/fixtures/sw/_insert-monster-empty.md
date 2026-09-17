```card-forge
card:
  system: sw
  card-type: monster
data:
  # The card's name. Falls back to the file name.
  name:

  # Flavour or a short description — an italic introductory line.
  description:

  # The card's picture — a wikilink to a picture in the vault, a plate under the flavour.
  image:

  # Source reference — rulebook page or wikilink, in italics beside the foot's curl.
  reference:

  # Hit dice — count and bonus, e.g. "4 + 1", or with the hit points in parentheses.
  hit-dice:

  # Armor class in both notations, descending [ascending], e.g. "7 [12]".
  armor-class:

  # The attacks with their damage, e.g. "2 claws (1d3) and bite (1d6)".
  attacks:

  # The creature's saving throw — a number.
  saving-throw:

  # The specials as a comma-separated line; the long form belongs in `abilities`.
  specials:

  # Movement — a number, or with the special mode, e.g. "6/15 (flying)".
  movement:

  # Alignment — Lawful, Neutral or Chaotic.
  alignment:

  # Challenge level — the rating; the experience points from `xp` follow after a slash.
  challenge-level:

  # Experience points for defeating the creature, after the challenge level.
  xp:

  # The abilities spelled out — a list of `name` and `desc`, each a paragraph with its name in bold under the "Abilities" banner.
  abilities:
```
