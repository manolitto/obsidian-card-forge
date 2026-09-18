# Cinder Hound

A monster with a picture on the back: the block with a trait and two
actions. Invented for this deck.

```cardsmith
card:
  system: 5e
  card-type: monster
data:
  name: Cinder Hound
  size: Medium
  type: beast
  alignment: unaligned
  ac: 13 (natural armor)
  hp: 22 (4d8 + 4)
  speed: 40 ft.
  str: 15 (+2)
  dex: 14 (+2)
  con: 13 (+1)
  int: 3 (-4)
  wis: 12 (+1)
  cha: 6 (-2)
  skills: Perception +3, Stealth +4
  immunities: fire
  senses: darkvision 60 ft., passive Perception 13
  languages: —
  cr: "1"
  xp: 200
  image: "[[Cinder-Hound.png]]"
  traits:
    - name: Keen Smell
      desc: The hound has advantage on Wisdom (Perception) checks that rely on smell.
  actions:
    - name: Bite
      desc: "*Melee Weapon Attack:* +4 to hit, reach 5 ft., one target. *Hit:* 7 (2d4 + 2) piercing damage plus 3 (1d6) fire damage."
    - name: Ember Breath (Recharge 5–6)
      desc: The hound exhales embers in a 15-foot cone. Each creature in that area must make a DC 11 Dexterity saving throw, taking 10 (3d6) fire damage on a failed save, or half as much damage on a successful one.
```
