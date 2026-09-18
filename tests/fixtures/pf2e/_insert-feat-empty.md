```cardsmith
card:
  system: pf2e
  card-type: feat
data:
  # The card's name — creature, item, feat, action or hazard. Falls back to the note's file name.
  name:

  # The feat's rule as markdown — the main body of the card. Degrees of success may stand bold inside the text (`**Success** You notice …`).
  description:

  # The card's picture as a wikilink (`[[Basilisk.png]]`), embed (`![[Basilisk.png]]`) or file name. Shown large on the card back; creatures and items also show it on the front when there is room.
  image:

  # Source reference — book title and page number, optionally a wikilink (`[[…]]`). Set small at the bottom right of the card.
  source:

  # English original name. Set small at the bottom left of the card, prefixed "engl."; hidden on English cards.
  original-name:

  # Feat level as free text, conventionally `Feat N` (e.g. `Feat 1`). Shown as the badge at the right of the header.
  level:

  # The feat's action cost, printed as a glyph beside the name: `1`, `2`, `3`, `r` (reaction), `f` (free) or the glyph itself. Passive feats omit it.
  action-cost:

  # List of traits — rarity, feat category (`Allgemein`, `Fertigkeit`, class, ancestry) and mechanical traits (`Konzentration`, `Manipulation`, `Heilung`). Each entry becomes a pill; the rarities take the rarity colour.
  traits:

  # Prerequisites for taking the feat — proficiency ranks, ability scores, other feats.
  prerequisites:

  # How often the feat may be used (e.g. `once per round`, `once per day`).
  frequency:

  # Trigger of reactions and some free actions.
  trigger:

  # Requirements at the time of use — the state or item that must apply then (as opposed to the prerequisites for taking the feat).
  requirements:

  # Trailing note, usually the multiple-selection clause (`You can select this feat more than once.`).
  special:
```
