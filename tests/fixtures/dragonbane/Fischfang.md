---
Kategorie: Fischfang
Buch: "Kampagnenbuch S. 58"
---
# Fischfang

One card per row. `table:` maps the columns: the two list columns fold into
the stat box, the badge classifier steps a range down, and the row without
a name of its own is titled after the note. The table is invented for this
deck, not one of any rulebook.

| Würfelwurf | Name | Voraussetzungen | Rationen | Beschreibung |
|---|---|---|---|---|
| 1 | Nebelbarsch | Angel oder Netz | W6 | Ein fetter Barsch mit milchigen Augen, schmeckt nach Moos. |
| 2–3 | Schlickaal | Reuse | W4 | Glitschig, zäh und überraschend nahrhaft. |
| 9–10 | | Netz | 2W6 | Etwas Großes zerrt am Netz und will nicht ans Ufer. |

```card-forge
card:
  system: dragonbane
  card-type: roll-table
table:
  roll: Würfelwurf
  name: Name
  stats: [Voraussetzungen, Rationen]
  description: Beschreibung
data:
  note: "Der Fang dauert einen Tagesabschnitt."
```
