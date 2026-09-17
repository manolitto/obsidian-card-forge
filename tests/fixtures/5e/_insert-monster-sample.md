```card-forge
card:
  system: 5e
  card-type: monster
data:
  # The creature's name. Falls back to the file name.
  name: Cinder Hound

  # The creature's picture — a wikilink to a picture in the vault — large on the back between the orange bars. Without one the back shows a d20 and the wordmark.
  image: '[[Cinder-Hound.png]]'

  # The size category — Tiny, Small, Medium, Large, Huge, Gargantuan — first in the italic line under the name.
  size: Medium

  # The creature type, with its tags in parentheses — `humanoid (goblinoid)`, `beast`, `undead`.
  type: beast

  # The alignment — `neutral evil`, `chaotic good`, `unaligned` — after the type, comma-separated.
  alignment: unaligned

  # Armor Class, usually a number with its source in parentheses — `15 (leather armor, shield)`.
  ac: 13 (natural armor)

  # Hit Points, usually the average with the hit-die formula in parentheses — `7 (2d6)`.
  hp: 22 (4d8 + 4)

  # The speeds, comma-separated where there are several — `40 ft., climb 40 ft., fly 80 ft.`.
  speed: 40 ft.

  # The habitat, as the 2024 rules print it under the speed — `Forest, Grassland`. The line prints when it is set.
  habitat: # no sample

  # The treasure category of the 2024 rules — `Individual`, `Hoard`, `None`. The line prints when it is set.
  treasure: # no sample

  # The gear carried, as the 2024 rules list it — comma-separated. The line prints when it is set.
  gear: # no sample

  # Strength — `score (modifier)`, e.g. `8 (-1)`.
  str: 15 (+2)

  # Dexterity — `score (modifier)`.
  dex: 14 (+2)

  # Constitution — `score (modifier)`.
  con: 13 (+1)

  # Intelligence — `score (modifier)`.
  int: 3 (-4)

  # Wisdom — `score (modifier)`.
  wis: 12 (+1)

  # Charisma — `score (modifier)`.
  cha: 6 (-2)

  # Saving-throw bonuses, comma-separated — `Dex +6, Con +13`. The line prints when it is set.
  saves: # no sample

  # Skill bonuses, comma-separated — `Perception +3, Stealth +4`. The line prints when it is set.
  skills: Perception +3, Stealth +4

  # Damage vulnerabilities, comma-separated. The line prints when it is set.
  vulnerabilities: # no sample

  # Damage resistances, comma-separated. The line prints when it is set.
  resistances: # no sample

  # Damage immunities, comma-separated. The line prints when it is set.
  immunities: fire

  # Condition immunities, comma-separated — `charmed, frightened`. The line prints when it is set.
  condition-immunities: # no sample

  # The senses — `darkvision 60 ft., passive Perception 13`.
  senses: darkvision 60 ft., passive Perception 13

  # The languages, or `—` for a creature that has none.
  languages: —

  # The challenge rating — a number, a fraction (`1/8`, `1/2`) — with the experience points from `xp` in parentheses after it.
  cr: '1'

  # The experience points for the creature, printed after the challenge rating — `1 (200 XP)`.
  xp: 200

  # The proficiency bonus, as the 2024 rules print it on the challenge line — `+2`. Prints when it is set.
  proficiency-bonus: # no sample

  # The traits above the actions — a list of `name` and `desc`; the description takes markdown and wikilinks.
  traits:
    - name: Keen Smell
      desc: The hound has advantage on Wisdom (Perception) checks that rely on smell.

  # The actions, under their head — a list of `name` and `desc`; `*Melee Weapon Attack:*` and the like as markdown.
  actions:
    - name: Bite
      desc: '*Melee Weapon Attack:* +4 to hit, reach 5 ft., one target. *Hit:* 7 (2d4 + 2) piercing damage plus 3 (1d6) fire damage.'

  # The bonus actions, under their own head — the same shape as `actions`.
  bonus-actions: # no sample

  # The reactions, under their own head — the same shape as `actions`; each states its trigger in the description.
  reactions: # no sample

  # The legendary actions — the same shape as `actions`; the preamble is a first entry with only a `desc`, a cost belongs in the name — `Wing Attack (Costs 2 Actions)`.
  legendary-actions: # no sample

  # The lair actions — the same shape as `legendary-actions`, the preamble first.
  lair-actions: # no sample

  # The regional effects — the same shape as `legendary-actions`, the preamble first.
  regional-effects: # no sample
```
