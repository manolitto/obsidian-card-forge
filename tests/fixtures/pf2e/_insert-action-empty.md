```cardsmith
card:
  system: pf2e
  card-type: action
data:
  # The card's name — creature, item, feat, action or hazard. Falls back to the note's file name.
  name:

  # The action's effect as markdown — the main body of the card.
  description:

  # The card's picture as a wikilink (`[[Basilisk.png]]`), embed (`![[Basilisk.png]]`) or file name. Shown large on the card back; creatures and items also show it on the front when there is room.
  image:

  # Source reference — book title and page number, optionally a wikilink (`[[…]]`). Set small at the bottom right of the card.
  source:

  # English original name. Set small at the bottom left of the card, prefixed "engl."; hidden on English cards.
  original-name:

  # Action cost, printed as a glyph beside the name: `1`, `2`, `3`, `r` (reaction), `f` (free) or the glyph itself.
  actions:

  # Skill the action belongs to (e.g. `Akrobatik`, `Athletik`). Shown as the badge at the right of the header; a list for several skills, joined with "/". Basic actions omit it.
  skill:

  # Required proficiency rank in the skill (`ungeübt`, `geübt`, `Experte`, `Meister`, `Legende`), under the skill in the badge.
  training:

  # List of the action's traits (`Bewegung`, `Offensiv`, `Handhaben`, `Konzentration`, `Verdeckt`, `Erkundung`, …). Each entry becomes a dark-red pill under the title.
  categories:

  # Frequency (e.g. `1/day`, `once per hour`).
  frequency:

  # Trigger of the action, for reactions and free actions.
  trigger:

  # Requirements for performing the action.
  requirements:

  # Outcome on a critical success.
  critical-success:

  # Outcome on a success.
  success:

  # Outcome on a failure.
  failure:

  # Outcome on a critical failure.
  critical-failure:

  # Box at the end of the card — an example list or a named sub-rule. An object with `title` (optional) and `body` (markdown); without `title` the text stands alone in the tinted box.
  # 
  callout:
```
