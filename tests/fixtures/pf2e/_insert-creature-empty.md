```card-forge
card:
  system: pf2e
  card-type: creature
data:
  # The card's name — creature, item, feat, action or hazard. Falls back to the note's file name.
  name:

  # Description or lore as markdown, in italics below the attacks.
  description:

  # The card's picture as a wikilink (`[[Basilisk.png]]`), embed (`![[Basilisk.png]]`) or file name. Shown large on the card back; creatures and items also show it on the front when there is room.
  image:

  # Source reference — book title and page number, optionally a wikilink (`[[…]]`). Set small at the bottom right of the card.
  source:

  # English original name. Set small at the bottom left of the card, prefixed "engl."; hidden on English cards.
  original-name:

  # Hit Points (HP). The short forms `hp`, `tp` and `lp` are accepted as aliases.
  hit-points:

  # Armor Class (AC). The short forms `ac` and `rk` are accepted as aliases.
  armor-class:

  # Saves as a list of single-key pairs, in the Monsterhandbuch's order: `ZÄH` (Fortitude), `REF` (Reflex), `WIL` (Will). The sign is added when printed.
  saves:

  # Immunities as free text — comma-separated damage types and conditions, e.g. `unconscious, poison, mental`.
  immunities:

  # Creature level, conventionally `Creature N` (e.g. `Creature 5`). Shown as the badge at the right of the header.
  level:

  # Alignment code (`N`, `NB`, `CB`, `RG`, …). The first pill of the trait row, in slate blue.
  alignment:

  # Creature size (`winzig`, `klein`, `mittelgroß`, `groß`, `riesig`, `gigantisch`). The second pill of the trait row, in green.
  size:

  # List of traits — creature type, themes, rarity. Each entry becomes a pill; the rarities `ungewöhnlich`, `selten` and `einzigartig` take the rarity colour.
  traits:

  # Perception modifier as a plain integer; the sign is added when printed.
  perception:

  # Special senses as free text (e.g. `darkvision`, `low-light vision`, `lifesense 60 ft.`), after the perception modifier.
  senses:

  # Skills as a list of single-key pairs (`{ Skill: modifier }`); the sign is added when printed.
  skills:

  # Attribute modifiers as a list of single-key pairs (`{ Abbr: modifier }`), in the order ST, GE, KO, IN, WE, CH. The sign is added when printed.
  attributes:

  # Carried equipment as free text, comma-separated. Beasts and mindless creatures usually have none — omit the field then.
  items:

  # Resistances as free text in the form `damage-type value`, comma-separated (e.g. `fire 5, cold 5`).
  resistances:

  # Weaknesses as free text in the form `damage-type value`, comma-separated (e.g. `holy 5`).
  weaknesses:

  # Simple movement as free text (e.g. `20 feet`, `25 ft.`). The card puts the ⬻ action glyph in front — do not write it into the value. For several movement modes use `speed` instead.
  stride:

  # Full movement line as free text when the creature has several movement modes (e.g. `30 ft., climb 20 ft., fly 40 ft.`). No action glyph; use only when `stride` is not set.
  speed:

  # The creature's attacks, actions and abilities as a list. Each entry is an object of optional fields; the card prints what is set:
  # 
  # | Field    | Meaning                                                                                       |
  # | -------- | --------------------------------------------------------------------------------------------- |
  # | `name`   | Kind and name, with markdown bold for the kind and the action glyph: `__Melee__ ⬻ jaws`      |
  # | `bonus`  | Attack modifier (`+7` or `7`; the sign is added)                                              |
  # | `damage` | Damage expression with its type, e.g. `1d6+1 piercing plus Knockdown`                         |
  # | `desc`   | Free text for abilities, triggers and spell lists                                             |
  # | `effect` | Additional effect, e.g. persistent damage                                                     |
  # 
  # Action glyphs: ⬻ (one action), ⬺ (two actions), ⬽ (three actions), ⬲ (reaction), ⭓ (free action).
  # 
  attacks:
```
