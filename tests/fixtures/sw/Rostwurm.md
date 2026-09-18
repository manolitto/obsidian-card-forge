# Rostwurm

A monster with more abilities than a front holds: the body runs onto the
back and the counter appears in the title. No picture, no experience
points beside the challenge level. Invented for this deck.

```cardsmith
card:
  system: sw
  card-type: monster
data:
  name: Rostwurm
  description: Ein segmentierter Wurm von der Länge eines Speers, dessen Panzer rot vor Rost blüht.
  hit-dice: 12 (60 Trefferpunkte)
  armor-class: 2 [17]
  attacks: Biss (2W8) und Schwanzhieb (1W10)
  saving-throw: 3
  specials: Rostfraß, Säureblut, Grabend, Immun gegen Gift, Zäher Panzer, Ausdünstung
  movement: 6 (grabend 3)
  alignment: Chaotisch
  challenge-level: 14
  abilities:
    - name: Rostfraß
      desc: Jede Waffe aus Eisen oder Stahl, die den Wurm trifft, zerfällt bei einer 1 oder 2 auf 1W6 zu Rost. Magische Waffen dürfen einen Rettungswurf ablegen.
    - name: Säureblut
      desc: Wer den Wurm im Nahkampf verwundet, wird von seinem Blut bespritzt und erleidet 1W4 Schaden, wenn ein Rettungswurf misslingt.
    - name: Grabend
      desc: Der Wurm gräbt sich durch Erde und loses Gestein mit Bewegungsrate 3 und lässt einen Tunnel zurück, der nach 1W6 Phasen einstürzt.
    - name: Immun gegen Gift
      desc: Gifte jeder Art bleiben ohne Wirkung.
    - name: Zäher Panzer
      desc: Stumpfe Waffen richten nur den halben Schaden an; nur der weiche Bauch (RK 7 [12]) ist ungeschützt.
    - name: Ausdünstung
      desc: In geschlossenen Räumen füllt der Wurm binnen einer Phase die Luft mit einem metallischen Dunst; wer darin atmet, kämpft mit -1 auf alle Würfe, bis er frische Luft erreicht.
  reference: Gesamtregelwerk S. 178
```
