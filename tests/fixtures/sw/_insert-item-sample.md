```card-forge
card:
  system: sw
  card-type: item
data:
  # The card's name. Falls back to the file name.
  name: Crescent Blade

  # Flavour or a short description — an italic introductory line.
  description: A slender blade whose steel gleams cool and bluish in torchlight.

  # The card's picture — a wikilink to a picture in the vault, a plate under the flavour.
  image: '[[Mondsichelklinge.png]]'

  # Source reference — rulebook page or wikilink, in italics beside the foot's curl.
  reference: Complete Rules p. 206, table 93

  # The kind of item — potion, scroll, ring, wand, staff, weapon, armour, miscellaneous — in small capitals under the title.
  item-type: Magic melee weapon

  # Roll on the matching treasure table, e.g. "76–00 on table 85". Only when the card is an entry of a roll table.
  table-roll: 4 on table 89, then 21–25 on table 93

  # Which classes may use the item — the rulebook's codes (A = any, F = fighter-like, C = clerical, M = magic-user, T = thief-like) or spelled out.
  class-restriction: F M (sword wielders)

  # The enchantment bonus of a magic weapon or armour, e.g. "+1".
  bonus: '+1'

  # How long the effect lasts, e.g. "1d6 + 6 turns" or "permanent".
  duration: # no sample

  # Charges — the uses a wand or staff holds.
  charges: # no sample

  # The mechanical effect — markdown, paragraphs or a list — under the "Effect" banner.
  effect: '**+1 to hit and damage.** Under moonlight the blade glows like a torch.'

  # Further notes or special qualities, after the bold "Notes" caption.
  notes: # no sample
```
