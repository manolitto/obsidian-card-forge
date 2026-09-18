```cardsmith
card:
  system: sw
  card-type: monster
data:
  # The card's name. Falls back to the file name.
  name: Bog Creeper

  # Flavour or a short description — an italic introductory line.
  description: A sinewy, man-sized newt whose skin takes the colour of the peat it lurks in.

  # The card's picture — a wikilink to a picture in the vault, a plate under the flavour.
  image: '[[Mondsichelklinge.png]]'

  # Source reference — rulebook page or wikilink, in italics beside the foot's curl.
  reference: Complete Rules p. 172

  # Hit dice — count and bonus, e.g. "4 + 1", or with the hit points in parentheses.
  hit-dice: 3 + 1

  # Armor class in both notations, descending [ascending], e.g. "7 [12]".
  armor-class: 6 [13]

  # The attacks with their damage, e.g. "2 claws (1d3) and bite (1d6)".
  attacks: Bite (1d6)

  # The creature's saving throw — a number.
  saving-throw: 14

  # The specials as a comma-separated line; the long form belongs in `abilities`.
  specials: Camouflage, paralysing slime

  # Movement — a number, or with the special mode, e.g. "6/15 (flying)".
  movement: 9 (schwimmend 12)

  # Alignment — Lawful, Neutral or Chaotic.
  alignment: Neutral

  # Challenge level — the rating; the experience points from `xp` follow after a slash.
  challenge-level: 5

  # Experience points for defeating the creature, after the challenge level.
  xp: 240

  # The abilities spelled out — a list of `name` and `desc`, each a paragraph with its name in bold under the "Abilities" banner.
  abilities:
    - name: Camouflage
      desc: In the bog the creeper is noticed only on a 1 on 1d6.
    - name: Paralysing slime
      desc: Anyone bitten must make a saving throw or be paralysed for 1d4 rounds.
```
