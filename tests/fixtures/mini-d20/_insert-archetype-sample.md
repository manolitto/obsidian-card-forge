```card-forge
card:
  system: mini-d20
  card-type: archetype
data:
  # The archetype's name — Rogue, Fighter, Cleric, Mage. Picks the right icon as well.
  name: Rogue

  # Flavour or a short description — an italic line at the foot of the card.
  description: A slender, one-handed blade of forged steel.

  # The card's picture as a wikilink (`[[image.png]]`), embed (`![[image.png]]`) or file name. Sits between the stats and the flavour and takes the room that is left.
  image: '[[Gegenstand.png]]'

  # Source reference — rulebook page or wikilink, small under the red line at the foot.
  reference: Rules p. 16

  # The card type's icon, top left and large on the back — a path under the system. Preset.
  icon: assets/icons/character.svg

  # A short characterisation — one sentence or a motto under the name.
  tagline: There is always a way

  # Hit Points (HP) at level 1.
  hit-points: 12

  # Armor Class (AC) at level 1, without armor.
  armor-class: 10

  # Saving Throw (ST) — the target at level 1.
  saving-throw: 11

  # Starting skill bonuses as a list of single-key pairs (`{ Skill: bonus }`), set in two columns.
  skill-bonuses:
    - Stealth: '+4'
    - Dexterity: '+4'
    - Acrobatics: '+3'
    - Perception: '+3'
    - Ranged Combat: '+2'
    - Melee: '+2'

  # Allowed armor (Light / Medium / Heavy / All), a list.
  allowed-armor:
    - Medium

  # Allowed weapons (Light / Medium / Heavy / All), a list.
  allowed-weapons:
    - Medium

  # The starting-abilities rule as a list of lines — how many at level 1, and what applies to this archetype.
  initial-abilities:
    - You start with two abilities.

  # The level-up rule as a list of lines — HP and ST per level, skill points and abilities.
  level-up-rules:
    - + 4 HP per level.
    - '- 1 ST per level.'
    - On each level-up through level 4 you gain 5 skill points and one more ability.
```
