```cardsmith
card:
  system: mini-d20
  card-type: bestiary
data:
  # The card's name. Falls back to the file name.
  name: # no sample

  # Flavour or a short description — an italic line at the foot of the card.
  description: A slender, one-handed blade of forged steel.

  # The card's picture as a wikilink (`[[image.png]]`), embed (`![[image.png]]`) or file name. Sits between the stats and the flavour and takes the room that is left.
  image: '[[Gegenstand.png]]'

  # Source reference — rulebook page or wikilink, small under the red line at the foot.
  reference: Rules p. 16

  # The card type's icon, top left and large on the back — a path under the system. Preset.
  icon: assets/icons/claw-slashes.svg

  # Bestiary category — Humanoid, Animal, Monster or Undead. Stands under the right icon and picks it.
  category: Humanoid

  # Hit Dice (HD) — the attack bonus as well.
  hit-dice: 1

  # Hit Points (HP), a fixed value — MINI D20 does not roll them.
  hit-points: 5

  # Armor Class (AC) as one number.
  armor-class: 13

  # Saving Throw (ST) — the target on the d20.
  saving-throw: 18

  # Movement (MV) — zones per turn; usually 1.
  movement: 1

  # Actions (A) — the attacks with their damage, e.g. "1 Weapon (4 Damage)" or "2 Claws (3 Damage)".
  actions: 1 Weapon (4 Damage)

  # Special abilities as a list, one line per entry (markdown).
  abilities:
    - In sunlight the attack roll is reduced by 1.
```
