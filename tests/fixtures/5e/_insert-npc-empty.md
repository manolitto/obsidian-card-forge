```card-forge
card:
  system: 5e
  card-type: npc
data:
  # The creature's name. Falls back to the file name.
  name:

  # The creature's picture — a wikilink to a picture in the vault — large on the back between the orange bars. Without one the back shows a d20 and the wordmark.
  image:

  # The size category — Tiny, Small, Medium, Large, Huge, Gargantuan — first in the italic line under the name.
  size:

  # The creature type, with its tags in parentheses — `humanoid (goblinoid)`, `beast`, `undead`.
  type:

  # The alignment — `neutral evil`, `chaotic good`, `unaligned` — after the type, comma-separated.
  alignment:

  # Armor Class, usually a number with its source in parentheses — `15 (leather armor, shield)`.
  ac:

  # Hit Points, usually the average with the hit-die formula in parentheses — `7 (2d6)`.
  hp:

  # The speeds, comma-separated where there are several — `40 ft., climb 40 ft., fly 80 ft.`.
  speed:

  # The habitat, as the 2024 rules print it under the speed — `Forest, Grassland`. The line prints when it is set.
  habitat:

  # The treasure category of the 2024 rules — `Individual`, `Hoard`, `None`. The line prints when it is set.
  treasure:

  # The gear carried, as the 2024 rules list it — comma-separated. The line prints when it is set.
  gear:

  # Strength — `score (modifier)`, e.g. `8 (-1)`.
  str:

  # Dexterity — `score (modifier)`.
  dex:

  # Constitution — `score (modifier)`.
  con:

  # Intelligence — `score (modifier)`.
  int:

  # Wisdom — `score (modifier)`.
  wis:

  # Charisma — `score (modifier)`.
  cha:

  # Saving-throw bonuses, comma-separated — `Dex +6, Con +13`. The line prints when it is set.
  saves:

  # Skill bonuses, comma-separated — `Perception +3, Stealth +4`. The line prints when it is set.
  skills:

  # Damage vulnerabilities, comma-separated. The line prints when it is set.
  vulnerabilities:

  # Damage resistances, comma-separated. The line prints when it is set.
  resistances:

  # Damage immunities, comma-separated. The line prints when it is set.
  immunities:

  # Condition immunities, comma-separated — `charmed, frightened`. The line prints when it is set.
  condition-immunities:

  # The senses — `darkvision 60 ft., passive Perception 13`.
  senses:

  # The languages, or `—` for a creature that has none.
  languages:

  # The challenge rating — a number, a fraction (`1/8`, `1/2`) — with the experience points from `xp` in parentheses after it.
  cr:

  # The experience points for the creature, printed after the challenge rating — `1 (200 XP)`.
  xp:

  # The proficiency bonus, as the 2024 rules print it on the challenge line — `+2`. Prints when it is set.
  proficiency-bonus:

  # The traits above the actions — a list of `name` and `desc`; the description takes markdown and wikilinks.
  traits:

  # The actions, under their head — a list of `name` and `desc`; `*Melee Weapon Attack:*` and the like as markdown.
  actions:

  # The bonus actions, under their own head — the same shape as `actions`.
  bonus-actions:

  # The reactions, under their own head — the same shape as `actions`; each states its trigger in the description.
  reactions:
```
