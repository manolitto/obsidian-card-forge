```cardsmith
card:
  system: pf2e
  card-type: creature
data:
  # The card's name — creature, item, feat, action or hazard. Falls back to the note's file name.
  name: Marsh Lurker

  # Description or lore as markdown, in italics below the attacks.
  description: A flat, mud-coloured body with too many eyes, noticed only when the water moves.

  # The card's picture as a wikilink (`[[Basilisk.png]]`), embed (`![[Basilisk.png]]`) or file name. Shown large on the card back; creatures and items also show it on the front when there is room.
  image: '[[Sumpfschleicher.png]]'

  # Source reference — book title and page number, optionally a wikilink (`[[…]]`). Set small at the bottom right of the card.
  source: Bestiary p. 38

  # English original name. Set small at the bottom left of the card, prefixed "engl."; hidden on English cards.
  original-name: Marsh Lurker

  # Hit Points (HP). The short forms `hp`, `tp` and `lp` are accepted as aliases.
  hit-points: 75

  # Armor Class (AC). The short forms `ac` and `rk` are accepted as aliases.
  armor-class: 22

  # Saves as a list of single-key pairs, in the Monsterhandbuch's order: `ZÄH` (Fortitude), `REF` (Reflex), `WIL` (Will). The sign is added when printed.
  saves:
    - ZÄH: 14
    - REF: 8
    - WIL: 11

  # Immunities as free text — comma-separated damage types and conditions, e.g. `unconscious, poison, mental`.
  immunities: unconscious, poison, mental

  # Creature level, conventionally `Creature N` (e.g. `Creature 5`). Shown as the badge at the right of the header.
  level: Creature 5

  # Alignment code (`N`, `NB`, `CB`, `RG`, …). The first pill of the trait row, in slate blue.
  alignment: 'N'

  # Creature size (`winzig`, `klein`, `mittelgroß`, `groß`, `riesig`, `gigantisch`). The second pill of the trait row, in green.
  size: medium

  # List of traits — creature type, themes, rarity. Each entry becomes a pill; the rarities `ungewöhnlich`, `selten` and `einzigartig` take the rarity colour.
  traits:
    - Beast
    - Swamp

  # Perception modifier as a plain integer; the sign is added when printed.
  perception: 11

  # Special senses as free text (e.g. `darkvision`, `low-light vision`, `lifesense 60 ft.`), after the perception modifier.
  senses: darkvision

  # Skills as a list of single-key pairs (`{ Skill: modifier }`); the sign is added when printed.
  skills:
    - Athletics: 13
    - Stealth: 8

  # Attribute modifiers as a list of single-key pairs (`{ Abbr: modifier }`), in the order ST, GE, KO, IN, WE, CH. The sign is added when printed.
  attributes:
    - Str: 4
    - Dex: -1
    - Con: 5
    - Int: -3
    - Wis: 2
    - Cha: 1

  # Carried equipment as free text, comma-separated. Beasts and mindless creatures usually have none — omit the field then.
  items: spear, leather armor

  # Resistances as free text in the form `damage-type value`, comma-separated (e.g. `fire 5, cold 5`).
  resistances: fire 5, cold 5

  # Weaknesses as free text in the form `damage-type value`, comma-separated (e.g. `holy 5`).
  weaknesses: holy 5

  # Simple movement as free text (e.g. `20 feet`, `25 ft.`). The card puts the ⬻ action glyph in front — do not write it into the value. For several movement modes use `speed` instead.
  stride: 25 feet

  # Full movement line as free text when the creature has several movement modes (e.g. `30 ft., climb 20 ft., fly 40 ft.`). No action glyph; use only when `stride` is not set.
  speed: 30 ft., climb 20 ft.

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
    - name: __Melee__ ⬻ jaws
      bonus: 7
      damage: 1d6+1 piercing plus Knockdown
    - name: __Marsh Camouflage__
      desc: In reeds or under water the marsh lurker gains +2 to Stealth.
    - name: __Ferocity__ ⬲
      desc: When reduced to 0 HP the marsh lurker stays at 1 HP; its wounded value increases by 1.
```
