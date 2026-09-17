# Grabwühler

A creature whose stat block fills the card: more abilities than attacks,
each with a paragraph of its own, weaknesses and immunities on the hit
point line, and the full movement line in place of the simple one. The
portrait it carries finds no 10 mm below the block, so the `image-none`
fallback commits and the picture stays on the back. Invented for this
deck.

```card-forge
card:
  system: pf2e
  card-type: creature
data:
  name: Grabwühler
  english: Grave Burrower
  level: Kreatur 5
  alignment: NB
  size: groß
  traits:
    - Ungewöhnlich
    - Untot
    - Geistlos
  perception: 12
  senses: Dunkelsicht, Lebensspüren 18 m
  skills:
    - { Athletik: 14 }
    - { Heimlichkeit: 9 }
  attributes:
    - { ST: 5 }
    - { GE: 0 }
    - { KO: 4 }
    - { IN: -5 }
    - { WE: 2 }
    - { CH: 0 }
  items: rostige Grabbeigaben
  armor-class: 20
  saves:
    - { ZÄH: 14 }
    - { REF: 8 }
    - { WIL: 11 }
  hit-points: 70
  immunities: Bewusstlos, Gift, Mental, Tod, Verängstigt
  resistances: Hieb 5, Stich 5
  weaknesses: Heilig 5, Feuer 5
  speed: Laufen 6 m, Graben 9 m
  attacks:
    - name: __Nahkampfangriff__ ⬻ Klaue
      bonus: 15
      damage: 2W6+7 Hieb plus Grabesgriff
    - name: __Nahkampfangriff__ ⬻ Biss
      bonus: 13
      damage: 2W8+5 Stich
    - name: __Grabesgriff__
      desc: Eine Kreatur, die von der Klaue getroffen wird, muss einen Zähigkeitswurf gegen SG 21 bestehen oder erhält den Zustand Festgehalten, bis sie entkommt.
    - name: __Aus der Erde__ ⬺
      desc: "**Voraussetzung** Der Grabwühler ist eingegraben. **Effekt** Er bricht aus dem Boden und greift jede angrenzende Kreatur mit seiner Klaue an; jede erhält bei einem Treffer zusätzlich den Zustand Liegend."
    - name: __Leichenstaub__ ⬲
      desc: "**Auslöser** Eine angrenzende Kreatur trifft den Grabwühler. **Effekt** Der Angreifer atmet den Staub ein und muss einen Zähigkeitswurf gegen SG 21 bestehen oder erhält den Zustand Krank 1."
    - name: __Wildheit__ ⬲
      desc: Wird der Grabwühler auf 0 TP reduziert, bleibt er bei 1 TP; er erhält Verwundet 1.
  description: "Was die Totengräber liegen ließen, hat sich unter dem Friedhof zu einem Leib zusammengefunden. Er gräbt sich unter frischen Gräbern hindurch und zieht die Trauernden hinab."
  image: "[[Sumpfschleicher.png]]"
  source: "Kampagnenbuch S. 44"
```
