```card-forge
card:
  system: mini-d20
  card-type: heritage
data:
  # The people's name — Dwarf, Elf, Halfling, Gnome, Orc, Human. Picks the right icon as well.
  name: Dwarf

  # Flavour or a short description — an italic line at the foot of the card.
  description: A slender, one-handed blade of forged steel.

  # The card's picture as a wikilink (`[[image.png]]`), embed (`![[image.png]]`) or file name. Sits between the stats and the flavour and takes the room that is left.
  image: '[[Gegenstand.png]]'

  # Tags as pills — usually "Passive".
  tags:
    - Passive

  # Source reference — rulebook page or wikilink, small under the red line at the foot.
  reference: Rules p. 16

  # The card type's icon, top left and large on the back — a path under the system. Preset.
  icon: assets/icons/family-tree.svg

  # The trait this people brings (markdown).
  effect: + 1 base damage in melee.

  # Example names as a list of rows with `male`, `female` and `lastname`.
  names:
    - male: Artex
      female: Branca
      lastname: Thunderhammer
    - male: Grimthor
      female: Opal
      lastname: Coppereye
```
