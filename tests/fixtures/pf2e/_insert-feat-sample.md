```cardsmith
card:
  system: pf2e
  card-type: feat
data:
  # The card's name — creature, item, feat, action or hazard. Falls back to the note's file name.
  name: Marsh Lurker

  # The feat's rule as markdown — the main body of the card. Degrees of success may stand bold inside the text (`**Success** You notice …`).
  description: You can use the Craft activity to create alchemical items. When you select this feat, you immediately add four common 1st-level formulas to your formula book.

  # The card's picture as a wikilink (`[[Basilisk.png]]`), embed (`![[Basilisk.png]]`) or file name. Shown large on the card back; creatures and items also show it on the front when there is room.
  image: '[[Sumpfschleicher.png]]'

  # Source reference — book title and page number, optionally a wikilink (`[[…]]`). Set small at the bottom right of the card.
  source: Bestiary p. 38

  # English original name. Set small at the bottom left of the card, prefixed "engl."; hidden on English cards.
  original-name: Marsh Lurker

  # Feat level as free text, conventionally `Feat N` (e.g. `Feat 1`). Shown as the badge at the right of the header.
  level: Feat 1

  # The feat's action cost, printed as a glyph beside the name: `1`, `2`, `3`, `r` (reaction), `f` (free) or the glyph itself. Passive feats omit it.
  action-cost: '1'

  # List of traits — rarity, feat category (`Allgemein`, `Fertigkeit`, class, ancestry) and mechanical traits (`Konzentration`, `Manipulation`, `Heilung`). Each entry becomes a pill; the rarities take the rarity colour.
  traits:
    - General
    - Skill

  # Prerequisites for taking the feat — proficiency ranks, ability scores, other feats.
  prerequisites: trained in Medicine

  # How often the feat may be used (e.g. `once per round`, `once per day`).
  frequency: once per hour

  # Trigger of reactions and some free actions.
  trigger: While you have your shield raised, you would take damage from a physical attack.

  # Requirements at the time of use — the state or item that must apply then (as opposed to the prerequisites for taking the feat).
  requirements: You're holding or wearing healer's tools.

  # Trailing note, usually the multiple-selection clause (`You can select this feat more than once.`).
  special: You can select this feat more than once. Each time, choose a different skill.
```
