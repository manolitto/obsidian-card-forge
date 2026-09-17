# Hausregel

## Vorderseite

Ein Charakter, der auf 0 TP fällt, ist nicht tot, sondern **am Boden**:
er würfelt zu Beginn jedes seiner Züge einen Rettungswurf.

- Gelingt er, bleibt er bei 0 TP und handelt nicht.
- Misslingt er dreimal, stirbt er.

### Heilung

Jede Heilung hebt ihn auf die geheilten TP.

## Rückseite

Die Hausregel gilt nur für Spielercharaktere; Monster sterben bei 0 TP.

## Hinweise

The generic card: a title and a subtitle, an icon and a label in the
left corner, the body from the note's `## Vorderseite` section, a
footer; the back a second text face from `## Rückseite`.

```card-forge
card:
  system: mini-d20
  card-type: generic
  language: de
data:
  front-title: Am Boden
  front-subtitle: Hausregel
  front-icon-left: assets/icons/skills.svg
  front-icon-left-label: Regel
  front-footer: Kampagne am Fluss
  back-title: Anmerkung
```
