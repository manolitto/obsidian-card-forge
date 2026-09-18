```cardsmith
card:
  system: tor2e
  card-type: npc
data:
  # The card's name. Falls back to the file name.
  name: Bog shambler

  # A description or flavour — in the block, or as a `## Beschreibung` section of the note.
  description: What sinks in the bog does not always come back up as what it was.

  # The card's picture as a wikilink (`[[Langschwert.png]]`), embed or file name — on the back, large.
  image: '[[Jagdspeer.png]]'

  # Distinctive features — a short list in the text, "Vengeful, Unruly" say.
  features: Tough, Patient

  # Endurance — the life force; at 0 the adversary is defeated.
  endurance: 20

  # Might — how readily hits become Heavy Blows.
  might: 2

  # Hate — the dark counterpart of Hope, fuelling Fell Abilities. An adversary without Hate has Resolve.
  hate: 4

  # Resolve — the pool for morale checks, on beasts and free peoples in place of Hate.
  resolve: # no sample

  # Parry — modifier to the target number in melee, e.g. "+1"; "–" for none.
  parry: '+1'

  # Armour — the protection dice against Piercing Blows.
  armor: 2

  # Attribute level — the one value for the adversary's rolls, in the large diamond.
  attribute-level: 3

  # Combat proficiencies as a list — each entry the weapon, its value in Success Dice and in brackets damage/injury, a special effect if any.
  combat-proficiencies:
    - Claws 2 (4/14)
    - Grasp 3 (2/12, Seize)

  # Fell abilities as a list — each entry its name in italics, then the effect (markdown; a line break stays one).
  fell-abilities:
    - _Tough._ A Heavy Blow costs the bog shambler only half.
```
