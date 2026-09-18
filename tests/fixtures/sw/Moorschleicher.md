# Moorschleicher

A monster that fits its front: the flavour, a picture, the full stat
block, two abilities. Invented for this deck.

```cardsmith
card:
  system: sw
  card-type: monster
data:
  name: Moorschleicher
  description: Ein sehniger Lurch in der Farbe des Torfs, in dem er lauert.
  image: "[[Moorschleicher.png]]"
  hit-dice: 3 + 1
  armor-class: 6 [13]
  attacks: Biss (1W6)
  saving-throw: 14
  specials: Tarnung, Lähmender Schleim
  movement: 9 (schwimmend 12)
  alignment: Neutral
  challenge-level: 5
  xp: 240
  abilities:
    - name: Tarnung
      desc: Im Moor wird der Schleicher nur bei einer 1 auf 1W6 bemerkt.
    - name: Lähmender Schleim
      desc: Wer gebissen wird und den Rettungswurf verfehlt, ist 1W4 Runden gelähmt.
  reference: Gesamtregelwerk S. 172
```
