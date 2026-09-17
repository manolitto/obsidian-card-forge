# Vial of Mist

The same potion in English: the captions from the `en` table. The deck
prints `de` and leaves it out. Invented for this deck.

```card-forge
card:
  system: sw
  card-type: item
  language: en
data:
  name: Vial of Mist
  item-type: Potion
  description: A vial of green glass in which a grey haze circles lazily.
  class-restriction: Any
  duration: 1d6 + 6 turns
  effect: |
    Whoever empties the vial becomes a cloud of mist 10 ft. across:

    - passes through any crack and under any door,
    - is immune to non-magical weapons,
    - can neither attack nor cast.
  reference: Complete Rules p. 200, table 85
```
