```cardsmith
card:
  system: pf2e
  card-type: trap
data:
  # The card's name — creature, item, feat, action or hazard. Falls back to the note's file name.
  name: Marsh Lurker

  # Introductory text — trigger, surroundings, how it works — in italics before the stats.
  description: A pressure plate in the floor triggers a volley of spears from the west wall.

  # The card's picture as a wikilink (`[[Basilisk.png]]`), embed (`![[Basilisk.png]]`) or file name. Shown large on the card back; creatures and items also show it on the front when there is room.
  image: '[[Sumpfschleicher.png]]'

  # Source reference — book title and page number, optionally a wikilink (`[[…]]`). Set small at the bottom right of the card.
  source: Bestiary p. 38

  # English original name. Set small at the bottom left of the card, prefixed "engl."; hidden on English cards.
  original-name: Marsh Lurker

  # Hit points as free text (e.g. `15` or `15 (per corner mechanism)`).
  hit-points: '15'

  # Armor Class (AC). The short forms `ac` and `rk` are accepted as aliases.
  armor-class: 18

  # Saves as a list of single-key pairs, in the Monsterhandbuch's order: `ZÄH` (Fortitude), `REF` (Reflex), `WIL` (Will). The sign is added when printed.
  saves:
    - ZÄH: 7
    - REF: 5

  # Immunities as free text — comma-separated damage types and conditions, e.g. `unconscious, poison, mental`.
  immunities: critical hits, mental

  # Hardness as free text, e.g. `8` or `8 (per corner mechanism)`. Damage taken is reduced by it.
  hardness: '8'

  # Hazard level (e.g. `Hazard 1`, `Complex Hazard 3`). Shown as the badge at the right of the header.
  level: Hazard 1

  # List of traits (`Mechanisch`, `Magisch`, `Komplex`, rarity). Each entry becomes a pill; the rarities take the rarity colour.
  traits:
    - Mechanical

  # Condition for noticing the hazard (e.g. `Perception DC 20`).
  notice: Perception DC 20

  # Initiative of complex hazards that act in combat (e.g. `Stealth +10`). Omit for simple traps.
  initiative: Stealth +10

  # Condition for disabling (e.g. `Thievery DC 20`).
  disarm: Thievery DC 20

  # The hazard's actions, attacks and effects as a list — the same shape as a creature's `attacks`: `name` (with markdown bold and the action glyph), `bonus`, `damage`, `desc`, `effect`.
  # 
  effects:
    - name: __Spear Volley__ ⬲
      desc: When a creature enters one of the marked squares, three spears shoot from the west wall.
    - name: __Ranged__ spear
      bonus: 10
      damage: 1d8+4 piercing

  # Reset condition as free text (e.g. `Resets after 1 minute.`), as the last line.
  reset: Resets after 1 minute.
```
