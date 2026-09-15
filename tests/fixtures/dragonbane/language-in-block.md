# Sprache im Block

The block's `language: en` is the note's layer of the card-settings chain
and wins over the system's German. The root carries `lang="en"`; the
captions still come from the German table, the only one the system has.

```card-forge
card:
  system: dragonbane
  card-type: rule
  language: en
data:
  name: Seilkunst
  Attribut: GEW
  Kategorie: Fertigkeit
  Art: Grundfertigkeit
  Beschreibung: "Knoten, Takelage und alles, was an einem Seil hängt."
```
