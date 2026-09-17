# Schurk:in

An archetype: its own name picks the hood, the motto under the header,
the level-1 stats in three columns, the skill bonuses in two, the
allowed gear, the abilities rule and the level-up rule. Invented for
this deck.

```card-forge
card:
  system: mini-d20
  card-type: archetype
  language: de
data:
  name: Schurk:in
  tagline: Es gibt immer einen Weg
  hit-points: 12
  armor-class: 10
  saving-throw: 11
  skill-bonuses:
    - { Heimlichkeit: "+4" }
    - { Fingerfertigkeit: "+4" }
    - { Akrobatik: "+3" }
    - { Wahrnehmung: "+3" }
    - { Fernkampf: "+2" }
    - { Nahkampf: "+2" }
  allowed-armor: [Leicht]
  allowed-weapons: [Leicht, Mittel]
  initial-abilities:
    - Du startest mit zwei Fähigkeiten.
  level-up-rules:
    - "+ 4 TP pro Stufe."
    - "- 1 RW pro Stufe."
    - "Bei jedem Stufenaufstieg bis Stufe 4 erhältst du 5 Fertigkeitspunkte und eine weitere Fähigkeit."
  reference: Regelwerk S. 10
```
