```cardsmith
card:
  system: eiserne-zeit
  card-type: generic
data:
  # Card title — white inside the black header band. Falls back to the note's file name when unset.
  name: Wolf Trap

  # Optional picture as a wikilink (`[[picture.png]]`), embed (`![[picture.png]]`) or file name. Sits below the header band across the full measure. The system is strictly black and white — a hard ink drawing fits, a greyscale photo does not.
  image: '[[wolfsfalle.png]]'

  # Card body as markdown, inline in the cardsmith block. Takes precedence over the note's text. Use the note's text for tables and embedded pictures.
  content: |-
    A set iron trap, heavy as a millstone.
    - Trigger: DEX check
    - Damage: 1d8

  # Source reference. Runs rotated along the right edge, in caps. Convention: book title, comma, page — "The Dog Handler, p. 8".
  reference: The Dog Handler, p. 8

  # Label of the black foot band, in white caps on every face of the card (e.g. "GEAR", "COMPANION"). Falls back to the card type's own label when unset.
  card-type-label: Gear
```
