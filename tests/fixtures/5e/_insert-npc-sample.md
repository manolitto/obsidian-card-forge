```card-forge
card:
  system: 5e
  card-type: npc
data:
  # The creature's name. Falls back to the file name.
  name: Toll Warden

  # The creature's picture — a wikilink to a picture in the vault — large on the back between the orange bars. Without one the back shows a d20 and the wordmark.
  image: '[[Toll-Warden.png]]'

  # The size category — Tiny, Small, Medium, Large, Huge, Gargantuan — first in the italic line under the name.
  size: Medium

  # The creature type, with its tags in parentheses — `humanoid (goblinoid)`, `beast`, `undead`.
  type: humanoid (any race)

  # The alignment — `neutral evil`, `chaotic good`, `unaligned` — after the type, comma-separated.
  alignment: lawful neutral

  # Armor Class, usually a number with its source in parentheses — `15 (leather armor, shield)`.
  ac: 16 (chain shirt, shield)

  # Hit Points, usually the average with the hit-die formula in parentheses — `7 (2d6)`.
  hp: 11 (2d8 + 2)

  # The speeds, comma-separated where there are several — `40 ft., climb 40 ft., fly 80 ft.`.
  speed: 30 ft.

  # The habitat, as the 2024 rules print it under the speed — `Forest, Grassland`. The line prints when it is set.
  habitat: # no sample

  # The treasure category of the 2024 rules — `Individual`, `Hoard`, `None`. The line prints when it is set.
  treasure: # no sample

  # The gear carried, as the 2024 rules list it — comma-separated. The line prints when it is set.
  gear: # no sample

  # Strength — `score (modifier)`, e.g. `8 (-1)`.
  str: 13 (+1)

  # Dexterity — `score (modifier)`.
  dex: 12 (+1)

  # Constitution — `score (modifier)`.
  con: 12 (+1)

  # Intelligence — `score (modifier)`.
  int: 10 (+0)

  # Wisdom — `score (modifier)`.
  wis: 11 (+0)

  # Charisma — `score (modifier)`.
  cha: 10 (+0)

  # Saving-throw bonuses, comma-separated — `Dex +6, Con +13`. The line prints when it is set.
  saves: # no sample

  # Skill bonuses, comma-separated — `Perception +3, Stealth +4`. The line prints when it is set.
  skills: Insight +2, Perception +2

  # Damage vulnerabilities, comma-separated. The line prints when it is set.
  vulnerabilities: # no sample

  # Damage resistances, comma-separated. The line prints when it is set.
  resistances: # no sample

  # Damage immunities, comma-separated. The line prints when it is set.
  immunities: # no sample

  # Condition immunities, comma-separated — `charmed, frightened`. The line prints when it is set.
  condition-immunities: # no sample

  # The senses — `darkvision 60 ft., passive Perception 13`.
  senses: passive Perception 12

  # The languages, or `—` for a creature that has none.
  languages: Common

  # The challenge rating — a number, a fraction (`1/8`, `1/2`) — with the experience points from `xp` in parentheses after it.
  cr: 1/8

  # The experience points for the creature, printed after the challenge rating — `1 (200 XP)`.
  xp: 25

  # The proficiency bonus, as the 2024 rules print it on the challenge line — `+2`. Prints when it is set.
  proficiency-bonus: # no sample

  # The traits above the actions — a list of `name` and `desc`; the description takes markdown and wikilinks.
  traits: # no sample

  # The actions, under their head — a list of `name` and `desc`; `*Melee Weapon Attack:*` and the like as markdown.
  actions:
    - name: Spear
      desc: '*Melee or Ranged Weapon Attack:* +3 to hit, reach 5 ft. or range 20/60 ft., one target. *Hit:* 4 (1d6 + 1) piercing damage.'

  # The bonus actions, under their own head — the same shape as `actions`.
  bonus-actions: # no sample

  # The reactions, under their own head — the same shape as `actions`; each states its trigger in the description.
  reactions: # no sample
```
