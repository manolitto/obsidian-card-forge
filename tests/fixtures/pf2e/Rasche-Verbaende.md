# Rasche Verbände

A feat with an action cost beside its name and every labelled line the
card type has, then the rules text and the trailing "Speziell" note.
Invented for this deck.

```cardsmith
card:
  system: pf2e
  card-type: feat
data:
  name: Rasche Verbände
  english: Quick Bandages
  level: Talent 2
  action-cost: 1
  traits:
    - Allgemein
    - Fertigkeit
    - Heilung
    - Handhaben
  prerequisites: Geübt in Heilkunde
  frequency: einmal pro Stunde
  requirements: Du hast Heilerwerkzeuge in Händen oder griffbereit.
  description: |
    Du versorgst eine Wunde, ohne dich um die Feinheiten zu kümmern. Lege einen Heilkundewurf gegen SG 15 ab.

    **Kritischer Erfolg** Das Ziel erhält 2W8 Trefferpunkte zurück. **Erfolg** Das Ziel erhält 1W8 Trefferpunkte zurück. **Kritischer Fehlschlag** Das Ziel erleidet 1W4 Punkte Schaden.
  special: Du kannst dieses Talent mehrfach wählen. Wähle jedes Mal einen anderen Kompetenzgrad, ab dem der Wurf gelingt.
  source: "Kampagnenbuch S. 22"
```
