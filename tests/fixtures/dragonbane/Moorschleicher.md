# Moorschleicher

A creature written in the block: the traits as one block, the attacks as a
table, the portrait on both faces through one property, and a GM note that
only the detailed display mode shows. Invented for this deck — not a
creature of any published bestiary.

```card-forge
card:
  system: dragonbane
  card-type: creature
data:
  name: Moorschleicher
  Kategorie: Monster
  Beschreibung: "Ein flacher, schlammfarbener Leib mit zu vielen Augen, der erst auffällt, wenn das Wasser sich bewegt."
  Bild: "[[Moorschleicher.png]]"
  TP: 28
  Grimmigkeit: 2
  Größe: normal
  Bewegung: 8 m, schwimmend 12 m
  Rüstung: Schlammpanzer (W4)
  Merkmale:
    - name: Sumpftarnung
      desc: "Im Wasser oder Schilf gelingt AUFMERKSAMKEIT nur mit **Nachteil**, um ihn zu bemerken."
    - name: Zäh
      desc: "Der erste Treffer je Runde richtet nur halben Schaden an."
  Monsterangriffe:
    - roll: "1–2"
      name: Zungenpeitsche
      desc: "Schaden W10. Das Ziel wird zum Wasser gezogen und ist [[Niedergeschlagen]]."
    - roll: "3–4"
      name: Biss
      desc: "Schaden 2W6."
    - roll: "5–6"
      name: Schlammwurf
      desc: "Ein Ziel in bis zu 10 m ist bis zum Ende der Runde geblendet."
  SL-Notiz: "Lockt Beute mit einem leisen Gurgeln ans Ufer. Zieht sich bei Feuer sofort zurück."
  Buch: "Kampagnenbuch S. 40"
```
