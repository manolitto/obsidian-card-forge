```card-forge
card:
  system: troubleshooters
  card-type: mechanic
data:
  # The card's name. Falls back to the file name.
  name: Taking cover

  # Source reference — rulebook page or wikilink, small at the foot.
  reference: Rulebook p. 130

  # What the mechanic requires or what triggers it — an action type, a minimum initiative, a successful check.
  requires: Move action

  # The rule's text — markdown, paragraphs welcome.
  content: Whoever ducks behind something solid is harder to hit at range for as long as the cover holds.

  # The mechanic's bullet points — a list of `name` and `desc`, orange bullets before them.
  points:
    - name: 'Light cover:'
      desc: Attacks against you are at −1 pip.
    - name: 'Heavy cover:'
      desc: Attacks against you are at −2 pips; a fumble hits the cover instead.
```
