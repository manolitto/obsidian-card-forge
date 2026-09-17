```card-forge-deck
system: dragonbane
card-type: [gear, creature]

# Der Vault-Ordner, dessen Kartennotizen das Deck sind. Standard: der Ordner der Deck-Notiz; "" ist die Vault-Wurzel.
# folder:

# Eine Notiz muss jedes dieser Tags tragen.
# include-tags-all:

# Eine Notiz muss mindestens eines dieser Tags tragen.
# include-tags-any:

# Eine Notiz mit einem dieser Tags bleibt draußen.
# exclude-tags-any:

# Eine Notiz mit allen diesen Tags bleibt draußen.
# exclude-tags-all:

# Nur die Karten, die in einer dieser Sprachen gedruckt werden. Standard: jede Karte.
# card-languages:

# Wohin die Exporte gehen, mit einer der beiden Endungen. Standard: neben der Deck-Notiz, unter ihrem Namen.
# output-path:

# Ein Preset (A3, A4, A5, Letter, Legal) oder `210 x 297 mm`; ein Preset allein lässt das Deck die Ausrichtung wählen, die mehr Karten fasst.
# paper-size: A4

# Rand um das Kartenraster, in Millimetern.
# page-margin: 10

# Welche Papierkante beim Duplexdruck die Bindung ist, damit Vorder- und Rückseiten übereinanderliegen: `long-edge` oder `short-edge`.
# duplex-flip: long-edge

# Die Schnittmarken in den Rändern; die Felder verschmelzen, eines lässt sich allein ändern.
# cut-marks: {enabled: true, length: 3, margin: 0, color: '#aaaaaa', weight: 0.25}

# `textured` druckt die Hintergrundbilder des Systems, `plain` lässt sie weg. Standard: die Plugin-Einstellung.
# paper-background:

# Die Unterordner des Ordners einschließen.
# folder-recursive: true

# Kopien je Karte nach Notizname, vor dem eigenen `copies` der Karte: `[{ name: Wolf, copies: 3 }]`.
# card-copies:

# Ein Preset (mini, bridge, poker, tarot, dixit, large) oder `63 x 88 mm`, jeweils optional gefolgt von `landscape`.
# card-size: poker

# Was eine Karte tut, wenn ihr Text bei der kleinsten Schriftgröße nicht passt: `none` schneidet ab, `extra-cards` setzt auf weiteren Karten fort, `back-then-cards` füllt zuerst die Rückseite.
# overflow-mode: none

# Die benannten Arten, die Karte zu setzen; Sache des Designs.
# layouts: [{name: default, front-face-count: any, fallback: true}]

# Wie das gewinnende Layout gewählt wird; Sache des Designs.
# layout-decision: {order: [{metric: printed-cards, direction: minimize}], tie-break: declaration-order}

# Welche Seite die Vorschau in der Notiz zeigt: `front`, `back` oder `both`.
# side: both

# Höhe der Vorschau in der Notiz, in Pixeln.
# display-height:

# Wie oft die Karte in einem Deck gedruckt wird.
# copies:

# Eine Karte je Wert des Würfelbereichs zwischen `roll-min` und `roll-max` drucken.
# expand-by-roll: false

# Die Sprache, in der die Karte gedruckt wird — aus welcher Übersetzungstabelle ihre Beschriftungen kommen.
# language:
```
