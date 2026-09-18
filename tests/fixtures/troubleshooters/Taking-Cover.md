# Taking Cover

The same mechanic in English: the captions from the `en` table. The deck
prints `de` and leaves it out. Invented for this deck.

```cardsmith
card:
  system: troubleshooters
  card-type: mechanic
  language: en
data:
  name: Taking cover
  requires: Move action
  content: Whoever ducks behind something solid is harder to hit at **range** for as long as the cover holds. Cover does not protect in close combat.
  points:
    - name: "Light cover:"
      desc: Attacks against you are at −1 pip.
    - name: "Heavy cover:"
      desc: Attacks against you are at −2 pips; a fumble hits the cover instead.
  reference: Rulebook p. 98
```
