# Marsh Guide

A non-player character without a picture: the d20 back with the name.
A missing score prints as a dash. Invented for this deck.

```cardsmith
card:
  system: 5e
  card-type: npc
data:
  name: Marsh Guide
  size: Medium
  type: humanoid (human)
  alignment: neutral
  ac: 12 (leather armor)
  hp: 9 (2d8)
  speed: 30 ft.
  str: 11 (+0)
  dex: 13 (+1)
  con: 10 (+0)
  wis: 14 (+2)
  cha: 9 (-1)
  skills: Nature +4, Survival +4
  senses: passive Perception 12
  languages: Common
  cr: "1/8"
  xp: 25
  traits:
    - name: Sure-Footed
      desc: The guide ignores difficult terrain in swamps and marshes.
  actions:
    - name: Quarterstaff
      desc: "*Melee Weapon Attack:* +2 to hit, reach 5 ft., one target. *Hit:* 3 (1d6) bludgeoning damage."
  reactions:
    - name: Warning Shout
      desc: When a creature the guide can see within 30 feet is targeted by an attack, the guide shouts; the target has advantage on the next saving throw it makes before the end of its turn.
```
