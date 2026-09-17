```card-forge
card:
  system: eiserne-zeit
  card-type: generic
data:
  # Card title — white inside the black header band. Falls back to the note's file name when unset.
  name:

  # Optional picture as a wikilink (`[[picture.png]]`), embed (`![[picture.png]]`) or file name. Sits below the header band across the full measure. The system is strictly black and white — a hard ink drawing fits, a greyscale photo does not.
  image:

  # Card body as markdown, inline in the card-forge block. Takes precedence over the note's text. Use the note's text for tables and embedded pictures.
  content:

  # Source reference. Runs rotated along the right edge, in caps. Convention: book title, comma, page — "The Dog Handler, p. 8".
  reference:

  # Label of the black foot band, in white caps on every face of the card (e.g. "GEAR", "COMPANION"). Falls back to the card type's own label when unset.
  card-type-label:
```
