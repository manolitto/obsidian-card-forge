# Speerhagel

A hazard: the level badge, an italic lead, the notice and disable lines,
the defences behind a rule, the effects in the same list shape as a
creature's attacks, and the reset clause last. Invented for this deck.

```cardsmith
card:
  system: pf2e
  card-type: trap
data:
  name: Speerhagel
  english: Spear Volley
  level: Gefahr 2
  traits:
    - Mechanisch
    - Falle
  description: Eine Druckplatte im Boden löst einen Speerhagel aus der Westwand aus.
  notice: Wahrnehmungswurf, SG 18 (geübt)
  disarm: Diebeskunst, SG 16 (geübt), um die Druckplatte zu blockieren
  armor-class: 16
  saves:
    - { ZÄH: 9 }
    - { REF: 5 }
  hardness: 8
  hit-points: 30 (BW 15)
  immunities: Kritische Treffer, Mentale Effekte, Präzisionsschaden
  effects:
    - name: __Speerhagel__ ⬲
      desc: "**Auslöser** Eine Kreatur betritt eines der markierten Felder. **Effekt** Drei Speere schießen aus der Westwand; die Falle führt einen Fernkampfangriff gegen jede Kreatur im Gang aus."
    - name: __Fernkampfangriff__ Speer
      bonus: 11
      damage: 1W8+4 Stich
  reset: Die Speere werden von Hand nachgeladen; die Falle ist nach 10 Minuten wieder scharf.
  source: "Kampagnenbuch S. 88"
```
