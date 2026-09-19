# Settings

*Settings → Cardsmith* has two parts: the systems your cards can be
rendered with, and three preferences.

## Systems

Every system is a row with a switch. The twelve bundled systems are there
from the start; a system of your own appears once you add it. A row says
where the system comes from — *Bundled with the plugin*, or the vault file
it was registered from — and offers *Copy into vault* for a bundled one
and *Remove* for a vault one.

A note names its system by id (`system: dragonbane`), so **at most one
system per id may be switched on**. Adding a vault system, or copying a
bundled one under its own id, switches every other system of that id
off — the one just added is the one meant. Two rows with the same id
both switched on by hand are marked, and the plugin refuses to render
that system until one is off.

### Adding a system of your own

A vault system is a folder in your vault with a YAML document at its top
that names the system — see [Writing a system](authoring/system.md). Pick
that document in *Add a vault system*; the field suggests every `.yaml`
and `.yml` file in the vault. The document is read and checked when you
add it: a missing face, stylesheet or picture is reported there and then,
and the system is not registered until it loads clean. A system of the
same id that was on — a bundled one, an older copy — is switched off for
it, and a notice says so.

Obsidian's file explorer shows a system's files (`.yaml`, `.hbs`, `.css`)
only with *Detect all file extensions* switched on under *Files and
links*. The plugin reads them either way.

### Copying a bundled system into the vault

*Copy into vault* on a bundled system's row writes every file of the
system into a folder of the vault — `cardsmith/<id>` by default — so the
copy is yours to edit: change a colour, add a card type, swap a font. The
dialog asks for three things:

- **Name** — what the pickers and the settings call the copy. *Copy of
  Dragonbane*, or the original's name when cleared.
- **Folder** — where the files go; an existing folder is refused.
- **System id** — keep the original's, and the bundled row is switched
  off in favour of the copy: your notes keep saying `system: dragonbane`
  and render from the copy from now on. Choose a new id, and both stay
  on; the plugin then offers to rewrite the notes that name the old id in
  their `cardsmith` or `cardsmith-deck` block, and only that line.

A copy stops receiving the plugin's updates: what a later release changes
in the bundled system does not reach a folder you own. That is the point
of the copy, and the price of it.

## Preferences

| Preference | Meaning |
|---|---|
| **Preview height** | Height of a card in the in-note preview, in pixels. A note may override it with `display-height` under `card:`. |
| **Paper background** | Whether a deck prints the system's background textures — *Textured* or *Plain*. Plain saves ink on a draft; a deck block may override it with `paper-background`. |
| **Language** | The language of the plugin's own interface — the buttons, the summaries, the messages: *Follow Obsidian*, *English* or *Deutsch*. The language a card prints in is the card's own setting, not this one. |
