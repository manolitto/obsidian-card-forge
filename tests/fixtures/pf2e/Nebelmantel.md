# Nebelmantel

An item that spills: a long description, the trait notes and two
activations do not fit one poker card even at the type floor, so the
stat block continues on a second card under `extra-cards`, the footer's
arrow marking the first. The bottom seat has no room on either face, so
the picture takes the side seat beside the three stat lines —
`image-side`. Invented for this deck.

```card-forge
card:
  system: pf2e
  card-type: item
data:
  name: Nebelmantel
  english: Cloak of Mists
  level: Gegenstand 7
  traits:
    - Ungewöhnlich
    - Illusion
    - Magisch
  price: 360 GM
  bulk: L
  usage: Getragen (Umhang)
  description: |
    Der graue Stoff dieses Mantels fühlt sich feucht an und riecht nach Moor, ganz gleich, wo sein Träger sich aufhält. Wer ihn trägt, erhält einen Gegenstandsbonus von +1 auf Heimlichkeit.

    Der Mantel gilt als Rüstung des Nebels, wenn der Träger eine Reaktion nutzt, um einem Angriff auszuweichen; in diesem Fall zählt der Bonus auch auf die RK gegen den auslösenden Angriff. Solange der Mantel getragen wird, hat der Träger außerdem keinen Nachteil durch Nebel, Rauch oder feinen Regen.

    Wird der Mantel abgelegt, verliert er seine Feuchtigkeit binnen einer Stunde und wird zu gewöhnlichem grauem Tuch, bis er wieder eine Nacht lang getragen wurde.
  trait-descriptions:
    - name: Illusion
      desc: Ein Effekt, der die Sinne täuscht. Eine Kreatur, die den Nebel als Illusion erkennt, kann hindurchsehen, als wäre er nicht da.
    - name: Schatten
      desc: Der Mantel bezieht seine Kraft aus der Schattenebene und funktioniert in hellem Sonnenlicht nicht.
  activations:
    - name: Nebel rufen
      actions: "2"
      components: Konzentration, Handhaben
      frequency: einmal pro Tag
      effect: Aus dem Saum des Mantels quillt Nebel, der eine Emanation von 6 m eine Minute lang füllt. Kreaturen darin sind verborgen, solange sie sich nicht bewegen.
    - name: Im Nebel verschwinden
      actions: r
      components: Konzentration
      trigger: Du wirst zum Ziel eines Angriffs, den du sehen kannst.
      requirements: Du stehst im Nebel, im Rauch oder im Regen.
      effect: Du wirst bis zum Ende des Zuges des Angreifers unsichtbar; der auslösende Angriff wird gegen dich mit dem Zustand Verborgen abgehandelt.
  image: "[[Schattenklinge.png]]"
  source: "Kampagnenbuch S. 63"
```
