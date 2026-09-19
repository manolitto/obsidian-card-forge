# Bundled systems

A system is a family of cards that share a look and a vocabulary. Twelve
ship with the plugin; each is a folder under `resources/systems/` that you
can also [copy into your vault](settings.md#copying-a-bundled-system-into-the-vault)
and make your own. What every system bundles of its game is a card design
and a vocabulary, and nothing else — the terms each one comes under are in
[NOTICE.md](../NOTICE.md).

A card's size is the card type's, else the system's, else poker
(63 × 88 mm). *Languages* are the ones the system has captions for; a
note may pick one with `language:`.

## simple

A minimal, game-agnostic design: title, body, a source reference, and a
back that names the game and the kind of card — both written by the note,
so one design serves any game. Every word on the card is the author's.
Card type `simple`; poker; `en`, `de`. Original to this project — the
smallest complete system, and the one to copy when starting your own.

## dragonbane

Cards for *Dragonbane* in the look of the game's own card deck: a parchment
field, ornament strips and plaques, the stat box. German.

| Card type | |
|---|---|
| `gear` | everything a character carries — weapons, armour, items; a drawn back of its own |
| `creature` | monsters and NPCs, with a portrait; large (88.9 × 127 mm) |
| `rule` | skills, talents, spells — a rule with a heading and a text |
| `roll-table` | one entry of a dice table, with the roll as a badge |
| `generic` | a free card: a title and Markdown |

Poker unless said otherwise; `de`. Not a Supplement under the game's
third-party licence — the system bundles no Dragonbane text — and anyone
who publishes one made with it carries that licence's obligations.

## eiserne-zeit

Cards for *Eiserne Zeit*: a torn-edged band under a grotesque headline,
Garamond text, the publisher's logo on the back — bundled with the
publisher's permission. One card type, `generic`, for whatever the note
holds; poker; `de`, `en`.

## pf2e

Cards for *Pathfinder Second Edition*, German: the trait row, the stat
lines and the action glyphs of the rulebook.

| Card type | |
|---|---|
| `creature` | the monster card — the full stat block, a portrait when there is room; large |
| `item` | weapons, armour, shields, magic items, with the picture beside the stats or below the text |
| `feat` | a feat: name, action cost and level in the header |
| `action` | basic and skill actions, with the outcomes |
| `trap` | a hazard |

Poker unless said otherwise; `de`. The action glyphs and the "P" mark are
Paizo's, under the Community Use Policy.

## mini-d20

Cards for *MINI D20*: red-and-black typography, the rulebook's icons in
the header. Bundled with the creator's permission.

| Card type | |
|---|---|
| `archetype` | a character archetype: stats, skill bonuses, gear, abilities |
| `ability` | an ability, with its tags and rule text |
| `heritage` | a heritage: trait and a table of names |
| `bestiary` | a creature: the six-column stat block and its abilities |
| `equipment` | a piece of equipment, with a picture |
| `quirk` | a quirk, rolled for — the roll as a badge |
| `cover` | the deck's title card and its colophon |
| `generic` | a free face with the typed cards' chrome on demand |

Poker; `de`, `en`. The icons are from game-icons.net (CC BY 3.0).

## dcc

Cards for *Dungeon Crawl Classics*: an ink-blue ornament band over paper.
Card types `occupation` (a zero-level occupation with its trained weapon
and trade goods) and `equipment`. Poker; `de`, `en`. Open Game License —
`resources/systems/dcc/OGL.txt`.

## dino-island

Cards for *Flucht von Dino Island*: distressed poster capitals, a yellow banner behind the heading, orange accents on white.
Card types `location` (a place, with a picture), `taxonomy` (an animal
family's fields) and `roll-table` (one entry of a table). Poker; `de`.
Bundled with the authors' permission.

## tor2e

Cards for *The One Ring*, second edition: a dark red frame, Garamond, a
flourish on the back. Card types `gear` and `npc` (an adversary; large).
Poker unless said otherwise; `de`, `en`. The system bundles nothing of
Middle-earth — not a name, not a place — and the samples keep it so.

## sw

Cards for *Swords & Wizardry*: Garamond text under a Cinzel title. Card
types `item` (a magic item) and `monster`. Poker; `de`, `en`. Open Game
License — `resources/systems/sw/OGL.txt`.

## troubleshooters

Cards for *The Troubleshooters*: a comic-book title face and three frames —
`npc` in blue, `mechanic` in orange, `gear` borderless on white. Poker;
`de`, `en`. Fan content under the Helmgast Fan Content Policy.

## 5e

Cards for fifth-edition play, on the SRD 5.1 vocabulary: a stat block with
the classic bar and a d20 on the back. Card types `monster` (the block,
then the sections a legendary creature adds) and `npc`. Large; `en`.

## dftq

Cards for games *Descended from the Queen*: one card type, `prompt`, for a
question card — the text in the middle of a tarot-sized face, the game's
name on the back. Tarot (70 × 120 mm); `en`, `de`.
