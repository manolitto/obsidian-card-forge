---
game-name: Für den Hof
---
# Anleitung

A table note: one prompt per row, the heading from the `card-title`
column, the deck's name once in the frontmatter for every row, an
instruction that fills the face, and lines broken with `<br>` as a
table cell must write them. Invented for this deck.

```cardsmith
card:
  system: dftq
  card-type: prompt
  language: de
table:
  name: name
  heading: card-title
  description: description
```

| name         | card-title   | description |
| ------------ | ------------ | ----------- |
| Anleitung 1  | Anleitung 1  | **Willkommen bei Hofe.** In diesem Spiel erzählen wir gemeinsam von einer Reise im Gefolge der Königin. Die Karten stellen Fragen; wer an der Reihe ist, zieht eine, liest sie laut vor und antwortet aus der Sicht der eigenen Figur. Was gesagt ist, ist wahr. Wer nicht antworten mag, legt die Karte ab und zieht eine neue — das gehört zum Spiel. Wenn die letzte Karte gezogen ist, fragt die Königin jede Figur, ob sie sie verteidigt, und die Geschichte endet mit den Antworten. |
| Anleitung 2  | Anleitung 2  | Bevor wir beginnen, einigen wir uns auf drei Dinge:<br>- die Zeit, in der die Reise stattfindet<br>- den Ort, zu dem die Königin reist<br>- die Stimmung, in der wir erzählen wollen |
| Anleitung 3  | Anleitung 3  | Wer möchte, darf die erste Karte ziehen. |
