# Ashen Wyrm

A legendary monster without a picture: every line of the block, the
three legendary sections each opened by a preamble entry, the 2024
proficiency bonus on the challenge line. The block shrinks to fit.
Invented for this deck.

```card-forge
card:
  system: 5e
  card-type: monster
data:
  name: Ashen Wyrm
  size: Huge
  type: dragon
  alignment: neutral evil
  ac: 18 (natural armor)
  hp: 184 (16d12 + 80)
  speed: 40 ft., burrow 30 ft., fly 80 ft.
  str: 25 (+7)
  dex: 10 (+0)
  con: 21 (+5)
  int: 14 (+2)
  wis: 13 (+1)
  cha: 17 (+3)
  saves: Dex +5, Con +10, Wis +6, Cha +8
  skills: Perception +11, Stealth +5
  resistances: bludgeoning from non-magical attacks
  immunities: fire
  condition-immunities: exhaustion
  senses: blindsight 60 ft., darkvision 120 ft., passive Perception 21
  languages: Common, Draconic
  cr: "14"
  xp: 11500
  proficiency-bonus: "+5"
  traits:
    - name: Legendary Resistance (3/Day)
      desc: If the wyrm fails a saving throw, it can choose to succeed instead.
    - name: Ash Cloak
      desc: While in ash or smoke, the wyrm is heavily obscured to creatures that rely on sight.
  actions:
    - name: Multiattack
      desc: "The wyrm makes three attacks: one with its bite and two with its claws."
    - name: Bite
      desc: "*Melee Weapon Attack:* +12 to hit, reach 10 ft., one target. *Hit:* 18 (2d10 + 7) piercing damage plus 5 (1d10) fire damage."
    - name: Claw
      desc: "*Melee Weapon Attack:* +12 to hit, reach 5 ft., one target. *Hit:* 14 (2d6 + 7) slashing damage."
    - name: Ash Breath (Recharge 5–6)
      desc: The wyrm exhales burning ash in a 60-foot cone. Each creature in that area must make a DC 18 Dexterity saving throw, taking 49 (14d6) fire damage on a failed save, or half as much damage on a successful one, and is blinded until the end of its next turn on a failed save.
  legendary-actions:
    - desc: The wyrm can take 3 legendary actions, choosing from the options below. Only one legendary action can be used at a time and only at the end of another creature's turn. The wyrm regains spent legendary actions at the start of its turn.
    - name: Detect
      desc: The wyrm makes a Wisdom (Perception) check.
    - name: Tail Sweep
      desc: "*Melee Weapon Attack:* +12 to hit, reach 15 ft., one target. *Hit:* 16 (2d8 + 7) bludgeoning damage."
    - name: Smother (Costs 2 Actions)
      desc: Ash swirls in a 20-foot-radius sphere centred on a point the wyrm can see within 90 feet. Each creature in the sphere must succeed on a DC 18 Constitution saving throw or be unable to breathe until the end of its next turn.
  lair-actions:
    - desc: "On initiative count 20 (losing initiative ties), the wyrm takes a lair action to cause one of the following effects; the wyrm can't use the same effect two rounds in a row:"
    - name: Cinder Fall
      desc: Glowing cinders rain in a 20-foot-radius cylinder the wyrm can see within 120 feet. Each creature in it takes 7 (2d6) fire damage.
    - name: Collapse
      desc: Part of the ceiling gives way over a point the wyrm can see within 120 feet. Each creature within 10 feet of it must succeed on a DC 15 Dexterity saving throw or take 11 (2d10) bludgeoning damage and be knocked prone.
  regional-effects:
    - desc: "The region within 6 miles of an ashen wyrm's lair is warped by its presence, which creates one or more of the following effects:"
    - name: Grey Snow
      desc: Fine ash falls from a clear sky once a day, coating everything and hiding tracks.
    - name: Dead Wells
      desc: Water within 1 mile of the lair tastes of soot and puts out no fire.
```
