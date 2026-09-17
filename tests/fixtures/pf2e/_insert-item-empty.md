```card-forge
card:
  system: pf2e
  card-type: item
data:
  # The card's name — creature, item, feat, action or hazard. Falls back to the note's file name.
  name:

  # Item description as markdown — the main body of the card.
  description:

  # The card's picture as a wikilink (`[[Basilisk.png]]`), embed (`![[Basilisk.png]]`) or file name. Shown large on the card back; creatures and items also show it on the front when there is room.
  image:

  # Source reference — book title and page number, optionally a wikilink (`[[…]]`). Set small at the bottom right of the card.
  source:

  # English original name. Set small at the bottom left of the card, prefixed "engl."; hidden on English cards.
  original-name:

  # Hit points of a shield or item as a number (`20`).
  hit-points:

  # Hardness of a shield or item (`3`, `5`, …). Damage the item takes is reduced by it.
  hardness:

  # Level or category as free text: `Item N` for magic items, the word for mundane gear without a level (`Weapon`, `Armor`, `Shield`). Shown as the badge at the right of the header.
  level:

  # List of traits — school, tradition, category, damage type, rarity. Each entry becomes a pill; the rarities `ungewöhnlich`, `selten` and `einzigartig` take the rarity colour.
  traits:

  # Price as free text, conventionally in gold pieces (`160 gp`).
  price:

  # Weapon damage as a dice expression with its type: `1d8 P` (piercing), `1d6 B` (bludgeoning), `1d6 S` (slashing).
  damage:

  # Range of a ranged weapon as free text (e.g. `120 ft.`).
  range:

  # Reload value of a ranged weapon (`0`, `1`, `2`, `1+`, `—`).
  reload:

  # Armor's AC bonus as free text (`+0`, `+1`, `+2`, …).
  ac-bonus:

  # Armor's Dex cap as free text (`+5`, `+3`, `+0`, `—`).
  dex-cap:

  # Armor's check penalty as free text (`—`, `–1`, `–2`, `–3`).
  check-penalty:

  # Armor's speed penalty as free text (`—`, `–5 ft.`, `–10 ft.`).
  speed-penalty:

  # Armor's strength threshold (`10`, `12`, `14`, `16`, `18`, `—`). At or above it the check penalty no longer applies.
  strength:

  # Bulk as free text (`L` for light, `1`, `2`, `—`).
  bulk:

  # Broken threshold of a shield or item as a number (`10`). At this HP value it counts as broken.
  broken-threshold:

  # Usage (`Held in 1 hand`, `Held in 2 hands`, `Worn`, `Worn (belt)`).
  usage:

  # Explanations of the traits as a list of objects with `name` (set bold) and `desc` (markdown). Printed after the description as its own list, each entry led by `*`.
  # 
  trait-descriptions:

  # Activated abilities of the item as a list. Each entry is an object of optional fields; the card prints what is set:
  # 
  # | Field          | Meaning                                                                  |
  # | -------------- | ------------------------------------------------------------------------ |
  # | `name`         | Ability name or the word `Activate` (set bold)                           |
  # | `actions`      | Action cost — `1`, `2`, `3`, `r` (reaction), `f` (free) or the glyph     |
  # | `components`   | Activation components without parentheses, e.g. `concentrate`           |
  # | `frequency`    | Frequency, e.g. `1/day`                                                  |
  # | `trigger`      | Trigger of a reaction                                                    |
  # | `requirements` | Requirements of the activation                                           |
  # | `effect`       | Effect                                                                   |
  # | `desc`         | Trailing free text                                                       |
  # 
  activations:
```
