```cardsmith
card:
  system: dragonbane
  card-type: creature
data:
  # Name of the creature — monster or NPC.
  name: Mist Crow

  # Short flavour description, above the stat block.
  description: A bird of mist and feathers that steals waymarks from travellers on the lake shore.

  # Card-back image as a wikilink. Without it the back shows what the card type provides (a creature's portrait), else the deck's emblem. `front-image` does not feed this — it is front-only.
  back-image: '[[Medaillon.png]]'

  # Card family — the large green title at the top of the back. Without it the card type's own label appears there ("Ausrüstung", "Waffe"). For roll tables put the table's name here ("Demon Roll in Melee", "Fear", "Hunting"); it then doubles as the title fallback when the table row has no name of its own. In a table note, set once in the frontmatter for all rows.
  category: Fishing

  # Finer grouping within the card family — rendered as the small parchment plaque under the back's illustration (e.g. "Clothing", "Tool", "Trade good"). Without it the plaque is omitted; if the value equals `category` it is suppressed as well.
  subcategory: Tool

  # Source reference — book title with page number, or a wikilink into the vault. Set upright along the card's right edge; falls back to "DRAGONBANE".
  book-reference: Rules p. 73

  # English original name, set small and upright along the card's left edge — the counterpart to the source reference on the right. Omitted when unset.
  english-original: Boat hook

  # Picture of the creature as a wikilink. Rendered on the back, and at the foot of the front when there is room for it.
  artwork: '[[Nebelkrähe.png]]'

  # Hit Points (HP) — the creature is taken out at 0.
  hit-points: 9

  # Willpower Points (WP) — spent on heroic abilities and magic.
  willpower-points: 6

  # Damage Bonus from STR — added as a die to melee damage (e.g. "+d4") or "–" if none.
  damage-bonus: –

  # Ferocity — number of attacks per round.
  ferocity: 1

  # Size (tiny, small, normal, large, huge, swarm).
  size: small

  # Movement rate in metres (e.g. "10 m" or "6 m, swim 12 m").
  movement: 4 m, fliegend 16 m

  # Armor — a monster's natural armor as dice notation or a description, an NPC's worn armor with its rating.
  armor: Mist plumage (d4)

  # Skills and ratings as a comma-separated list (uppercase skill names followed by their level).
  skills: AWARENESS 12, SPEARS 10, SWIMMING 14

  # NPC's armament as a short list of names with key stats in parentheses (damage, features).
  weapons: Boat hook (d8, piercing/long), Fish knife (d6, piercing)

  # List of special traits, each with a name and a description.
  traits:
    - name: Mist flight
      desc: Invisible in mist until it attacks.
    - name: Flock call
      desc: Summons one more crow per round while it shrieks.

  # List of heroic abilities, each with a name and a short description.
  talents:
    - name: Slippery
      desc: Boon on EVADE when the ground is wet.
    - name: Sea legs
      desc: No bane on rolls made on a rocking deck.

  # Monster attack table (d6: roll, name, desc per entry).
  monster-attacks:
    - roll: 1-2
      name: Pecking beak
      desc: Damage d6. The target drops what it holds.
    - roll: 3-4
      name: Talons
      desc: Two attacks dealing d4 slashing damage each.
    - roll: 5-6
      name: Shriek
      desc: Everyone within 10 m must pass a WIL roll or is dazed until the end of the round.

  # Secret GM notes (tactics, weaknesses, lore). Only shown in detailed display mode.
  gm-notes: Attacks whoever carries the lantern. Flees into the mist below 3 HP.
```
