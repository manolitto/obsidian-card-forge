# Schattenklinge

A weapon with a picture and four stat lines: beside them the picture
would stand no taller than the lines, below the short description it has
the rest of the card, so `image-bottom` wins the height comparison. The
trait pills carry a rarity. Invented for this deck.

```cardsmith
card:
  system: pf2e
  card-type: item
data:
  name: Schattenklinge
  english: Shadow Blade
  level: Gegenstand 6
  traits:
    - Selten
    - Magisch
    - Schatten
  price: 240 GM
  damage: 1W6 H
  bulk: L
  usage: In 1 Hand gehalten
  description: "Die Klinge wirft keinen Schatten und macht beim Ziehen kein Geräusch. Im Dämmerlicht erhält ihr Träger einen Gegenstandsbonus von +1 auf Heimlichkeit."
  image: "[[Schattenklinge.png]]"
  source: "Kampagnenbuch S. 61"
```
