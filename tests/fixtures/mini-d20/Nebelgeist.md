# Nebelgeist

A creature of a category the classifier has no icon for — `Geist` — so
the right corner and the back's lower half stay empty; the label still
prints. Enough abilities that the card fills its back before it spawns
another: the system's `back-then-cards`. Invented for this deck.

```cardsmith
card:
  system: mini-d20
  card-type: bestiary
  language: de
data:
  name: Nebelgeist
  category: Geist
  hit-dice: 4
  hit-points: 18
  armor-class: 15
  saving-throw: 14
  movement: 2
  actions: 1 Berührung (4 Schaden)
  abilities:
    - "**Körperlos.** Nur magische Waffen und Zauber verletzen den Nebelgeist; er schwebt durch Wände, Türen und Gitter."
    - "**Nebelgestalt.** Im Freien löst er sich bei Wind für 1 Runde auf und erscheint bis zu 3 Felder entfernt wieder."
    - "**Frostberührung.** Wer getroffen wird, verliert seine nächste Bewegung; ein Rettungswurf verhindert das."
    - "**Klagelaut.** Einmal je Kampf: alle in 2 Feldern legen einen Rettungswurf ab oder verlieren ihre nächste Aktion."
    - "**Lichtscheu.** Im Sonnenlicht oder im Schein von mehr als zwei Fackeln Angriffswurf minus 2 und keine Nebelgestalt."
    - "**Gebunden.** Der Nebelgeist kann den Ort seines Todes nicht weiter als 12 Felder verlassen; wer den Ort findet und die Gebeine bestattet, erlöst ihn."
    - "**Unruhe.** Tiere in 6 Feldern werden unruhig und verweigern den Dienst, bis der Nebelgeist vertrieben ist."
  description: "Ein bleicher Schemen, der sich mit dem Nebel über das Moor legt und die Wege verwischt."
  reference: Kampagnenbuch S. 40
```
