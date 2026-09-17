# Sumpfschleicher

A creature with the full stat block and a portrait: the alignment and size
pills in their own colours, the skills and attributes as labelled pairs,
the saves behind the armour class, the attacks with their glyphs in the
name, and a short description. The block leaves the portrait room, so the
`image-bottom` candidate commits. Invented for this deck — no creature of
any published bestiary.

```card-forge
card:
  system: pf2e
  card-type: creature
data:
  name: Sumpfschleicher
  english: Marsh Lurker
  level: Kreatur 3
  alignment: N
  size: mittelgroß
  traits:
    - Bestie
    - Sumpf
  perception: 9
  senses: Dunkelsicht, Erschütterungssinn 9 m
  skills:
    - { Athletik: 10 }
    - { Heimlichkeit: 11 }
  attributes:
    - { ST: 4 }
    - { GE: 2 }
    - { KO: 3 }
    - { IN: -4 }
    - { WE: 1 }
    - { CH: -2 }
  armor-class: 18
  saves:
    - { ZÄH: 11 }
    - { REF: 9 }
    - { WIL: 6 }
  hit-points: 48
  immunities: Gift
  resistances: Wucht 3
  stride: 6 m, Schwimmen 9 m
  attacks:
    - name: __Nahkampfangriff__ ⬻ Biss
      bonus: 12
      damage: 1W8+6 Stich plus Festhalten
    - name: __Nahkampfangriff__ ⬻ Schwanz
      bonus: 10
      damage: 1W6+6 Wucht plus Niederwerfen
    - name: __Sumpftarnung__
      desc: Im Schilf oder unter Wasser erhält der Sumpfschleicher +2 auf Heimlichkeit.
  description: "Ein flacher, schlammfarbener Leib mit zu vielen Augen, der erst auffällt, wenn das Wasser sich bewegt."
  image: "[[Sumpfschleicher.png]]"
  source: "[[Kampagnenbuch S. 40]]"
```
