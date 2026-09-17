# Kante ergreifen

A skill action: the reaction glyph beside the name, the skill and the
required rank as the two-line badge, the trigger, the effect, the four
degrees of success, and a callout with a named sub-rule at the end.
Invented for this deck.

```card-forge
card:
  system: pf2e
  card-type: action
data:
  name: Kante ergreifen
  english: Grab an Edge
  actions: r
  skill: Athletik
  training: ungeübt
  categories:
    - Handhaben
  trigger: Du stürzt von einer Kante oder einem Haltegriff ab oder daran vorbei.
  requirements: Deine Hände sind nicht gefesselt.
  description: Wenn du von einer Kante abstürzt, kannst du versuchen, sie zu ergreifen und den Sturz aufzuhalten. Dazu muss dir ein Reflexwurf gelingen, üblicherweise gegen den Klettern-SG.
  critical-success: Du ergreifst den Halt, ob du eine Hand frei hast oder nicht, und behandelst den Sturz als 9 m kürzer.
  success: Mit mindestens einer freien Hand ergreifst du den Halt und behandelst den Sturz als 6 m kürzer.
  critical-failure: Du fällst weiter und nimmst zusätzlich 10 Wuchtschaden je 6 m, die du bereits gestürzt bist.
  callout:
    title: Sturzschaden
    body: |
      - **Bis 3 m** kein Schaden
      - **Je weitere 3 m** 1W6 Wuchtschaden
      - **Ins Wasser** die Hälfte
  source: "Kampagnenbuch S. 15"
```
