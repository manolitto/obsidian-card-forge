# Knochensammler

A creature too long for one face. The card type offers two ways to lay it
out: `with-back` keeps the designed back and spills onto further cards,
`front-image` gives the back up, shows the portrait at the foot of the last
front and pairs the fronts two by two. The text here runs past one face but
not past one and a half, which is where the second way prints fewer cards —
the decision is meant to come out for `front-image`. Invented for this deck,
not a creature of any published bestiary.

```cardsmith
card:
  system: dragonbane
  card-type: creature
data:
  name: Knochensammler
  Kategorie: Monster
  Beschreibung: "Ein gebeugter Riese aus verwachsenen Gebeinen, der über die Schlachtfelder alter Kriege streift und aufliest, was die Raben übrig ließen. Was er findet, fügt er seinem Leib hinzu; was er nicht brauchen kann, hängt er klappernd an Sehnen um die Schultern."
  Bild: "[[Knochensammler.png]]"
  TP: 46
  Grimmigkeit: 2
  Größe: groß
  Bewegung: 10 m
  Rüstung: Knochenpanzer (W8)
  Merkmale:
    - name: Aus Gebein gefügt
      desc: "Stich- und Schusswaffen richten nur halben Schaden an. Hiebwaffen und Wuchtschaden treffen normal; ein kritischer Treffer mit einer Wuchtwaffe zerschlägt zusätzlich eine Panzerplatte und senkt die Rüstung dauerhaft um 2."
    - name: Zusammenfügen
      desc: "Steht der Knochensammler zu Beginn seiner Runde auf Knochenboden – einem Schlachtfeld, einer Gruft, einem Beinhaus –, heilt er W6 TP, statt zu handeln. Auf gewöhnlichem Boden bleibt die Fähigkeit ohne Wirkung."
    - name: Klappernde Last
      desc: "Sein Näherkommen ist auf 30 m zu hören; SCHLEICHEN gelingt ihm nur mit **Nachteil**. Wer ihn hört, ohne ihn zu sehen, muss mit WIL bestehen oder bekommt [[Furcht]] (W6 auf der Furchttabelle)."
    - name: Kein Herz
      desc: "Immun gegen Gift, Krankheit und Ersticken. Feuer richtet doppelten Schaden an, denn die Sehnen, die ihn zusammenhalten, brennen wie Zunder."
    - name: Sammelwut
      desc: "Ein Gegner, der unter 0 TP fällt, wird sofort aufgehoben und mitgeschleppt, wenn der Knochensammler nicht selbst im Nahkampf gebunden ist. Ihn zurückzuholen erfordert eine gelungene STÄ-Probe gegen seine 20."
  Monsterangriffe:
    - roll: "1"
      name: Knochenhagel
      desc: "Er reißt eine Handvoll Rippen von seiner Schulter und schleudert sie in einen Kegel von 10 m. Jeder darin muss AUSWEICHEN oder erleidet W10 Stichschaden."
    - roll: "2"
      name: Zermalmender Griff
      desc: "Er packt ein Ziel mit beiden Händen. Schaden 2W8 und das Ziel ist [[Gepackt]]; jede weitere Runde im Griff kostet W8 TP ohne Angriffswurf."
    - roll: "3"
      name: Fegender Arm
      desc: "Ein weiter Schlag trifft alle Gegner im Nahkampfbereich. Schaden W12, und wer getroffen wurde, ist [[Niedergeschlagen]]."
    - roll: "4"
      name: Schädelwurf
      desc: "Er wirft einen Schädel auf ein Ziel in bis zu 20 m. Schaden W8; der Schädel zerbirst mit einem Schrei, und alle in 5 m um den Aufschlag müssen mit WIL bestehen oder verlieren W4 WP."
    - roll: "5"
      name: Knochensplitter
      desc: "Ein Stück seines Panzers löst sich und fährt wie ein Speer aus seinem Leib. Schaden 2W6, Stich, Reichweite 4 m. Seine Rüstung sinkt bis zum Ende des Kampfes um 1."
    - roll: "6"
      name: Anwachsen
      desc: "Er greift nach einem Gegner unter 5 TP und beginnt, ihn seinem Leib hinzuzufügen. Das Ziel ist [[Gepackt]] und erleidet je Runde W6 Schaden; stirbt es, erhält der Knochensammler dessen verbliebene TP-Maximum als Bonus-TP."
  SL-Notiz: "Nicht böse, nur unersättlich. Ein Knochensammler, dem man ein ganzes Skelett schenkt, lässt die Gruppe ziehen – einmal. Sein Hort liegt im Beinhaus der Kapelle."
  Buch: "Kampagnenbuch S. 44"
```
