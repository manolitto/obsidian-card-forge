```cardsmith
card:
  system: troubleshooters
  card-type: npc
data:
  # The card's name. Falls back to the file name.
  name: Customs officer

  # Who the character is and what they do — a short paragraph under the numbers.
  description: Checks passports and suitcases at the border, knows every smuggler's trick and is impressed by no smile.

  # The card's picture — a wikilink to a picture in the vault.
  image: '[[Zollbeamtin.png]]'

  # Source reference — rulebook page or wikilink, small at the foot.
  reference: Rulebook p. 130

  # Initiative in combat — underlings and lieutenants usually 7, mooks 5.
  initiative: 5

  # Vitality points — underlings around 5, bosses 7 and up.
  vitality: 4

  # Defence in percent — only lieutenants and bosses have one.
  defense: # no sample

  # The character's traits on one line — "Underling", "Mook", wikilinks welcome.
  traits: '[[Underling]]'

  # The attacks — a list of `name` and `desc`: the weapon, then the skill in percent, the damage and the traits.
  attacks:
    - name: 'Service pistol:'
      desc: 45%, 5dX, Loud, Short range

  # The skills — a list of `name` and `desc` with the percentage; basic and special usually first.
  skills:
    - name: 'Basic:'
      desc: 35%
    - name: 'Special:'
      desc: 55%
    - name: 'Searching luggage:'
      desc: 65%

  # Spoken languages, the fluency in parentheses.
  languages: German (native), French (fluent)
```
