# Third-party notices

Cardsmith's own code, templates and stylesheets are licensed under the
[MIT License](LICENSE). This file documents the **bundled third-party
material** that carries terms of its own: the fonts, the icons, the
decorative art, and the games whose cards the bundled systems are drawn
for.

> **Cardsmith is an unofficial, fan-made tool.** It is not published,
> endorsed, sponsored by or affiliated with any of the publishers named
> below. All trademarks and copyrights are the property of their respective
> owners. A bundled system is a card *design* — layouts, field names, a
> vocabulary — and no system bundles a rulebook's text, artwork or logo
> unless its row below says so and names the permission. What a printed
> card shows comes from the note it is printed from; whoever prints and
> shares cards decides what those notes carry.

## Fonts

Every bundled font is redistributable under an open licence, and the
licence text travels beside the font files in its system's `fonts/`
folder. The files are WOFF2 — the plugin embeds every font in `main.js` —
and most are the `latin` / `latin-ext` subsets as Google Fonts serves them.
No glyph, metric or name-table data was altered.

| Font | Systems | Licence | Licence file |
|---|---|---|---|
| Bookinsanity, Mr Eaves Small Caps, Nodesto Caps Condensed, Scaly Sans — the *Solbera* fonts, packaged by jonathonf | 5e | CC BY-SA 4.0 | `5e/fonts/solbera-LICENSE.txt` — with the attribution and the stated modification (OpenType → WOFF2, renamed). Share-alike binds the font files; the templates and stylesheets only reference them |
| Alegreya Sans | dragonbane | SIL OFL 1.1 | `dragonbane/fonts/alegreya-sans-OFL.txt` |
| Archivo Black | eiserne-zeit | SIL OFL 1.1 | `eiserne-zeit/fonts/archivo-black-OFL.txt` |
| Bangers | troubleshooters | SIL OFL 1.1 | `troubleshooters/fonts/bangers-OFL.txt` |
| Barlow Condensed | pf2e | SIL OFL 1.1 | `pf2e/fonts/barlow-OFL.txt` |
| Cinzel | dcc, pf2e, sw | SIL OFL 1.1 | `*/fonts/cinzel-OFL.txt` |
| Colus | dragonbane | SIL OFL 1.1 | `dragonbane/fonts/colus-OFL.txt` |
| Cormorant Garamond | dftq | SIL OFL 1.1 | `dftq/fonts/cormorant-garamond-OFL.txt` |
| EB Garamond | eiserne-zeit, sw, tor2e | SIL OFL 1.1 | `*/fonts/eb-garamond-OFL.txt` |
| Lora | troubleshooters | SIL OFL 1.1 | `troubleshooters/fonts/lora-OFL.txt` |
| Merriweather | mini-d20 | SIL OFL 1.1 | `mini-d20/fonts/merriweather-OFL.txt` |
| Nunito Sans | dino-island | SIL OFL 1.1 | `dino-island/fonts/nunito-sans-OFL.txt` |
| Pathfinder 2e action glyphs (five symbols) | pf2e | Paizo Community Use Policy | `pf2e/fonts/pathfinder-2e-actions-LICENSE.txt` — see the Paizo notice below |
| Rubik Distressed | dino-island | SIL OFL 1.1 | `dino-island/fonts/rubik-distressed-OFL.txt` |
| Source Sans 3 | pf2e, simple, tor2e | SIL OFL 1.1 | `*/fonts/source-sans-3-OFL.txt` |
| TeX Gyre Pagella | dcc | GUST Font License | `dcc/fonts/pagella-LICENSE.txt` |
| Wellfleet | mini-d20 | SIL OFL 1.1 | `mini-d20/fonts/wellfleet-OFL.txt` |

Paths are under `resources/systems/`.

## Icons

The MINI D20 system bundles 25 icons from [game-icons.net](https://game-icons.net/),
licensed **CC BY 3.0**. `resources/systems/mini-d20/assets/icons/NOTICE.md`
names every file and its artist. CC BY 3.0 requires that attribution to
travel with the icons: anyone who publishes or shares cards rendered with
them must keep it.

## Images and decorative art

| File | System | What it is |
|---|---|---|
| `5e/assets/d20-mark.svg` | 5e | A twenty-sided die as a flat silhouette, drawn for this project (MIT). It resembles no publisher's mark. |
| `eiserne-zeit/assets/eiserne-zeit-logo.png`, and the torn paper edge and the cross fleury drawn as inline SVG in the system's stylesheet | eiserne-zeit | The publisher's logo and two elements of the publisher's own graphic design. **Bundled with the explicit permission of Markus Schauta (Gazer Press, Vienna).** The permission covers their use in this plugin; it does not transfer to anyone extracting them for other use. |
| `pf2e/assets/p-mark.webp` | pf2e | Paizo's Pathfinder "P" mark, from Paizo's Community Use Package, re-encoded to WebP without any change to colour, typography, design or proportions. Paizo property, used under the Community Use Policy — see the notice below. |
| The gear back of `dragonbane` and the emblem on its picture-less backs; the flourish on `tor2e`'s picture-less backs | dragonbane, tor2e | Inline SVG drawn for this project (MIT), in each system's stylesheet. |
| `docs/images/*.png` | — | Renders of the plugin's own test fixtures — invented cards of the `mini-d20` and `simple` systems — made for the README. The icons on the MINI D20 cards are game-icons.net's (above). |

The parchment texture and the two ornament bitmaps of the Dragonbane
system are under clarification with the author of the template they come
from; their rows follow once the terms are recorded.

## Bundled systems

Each bundled system is a card design and a vocabulary for a game. The
game's mechanics are used under the terms noted; product names, logos,
trade dress, artwork and proper nouns remain the property of their owners.

| System | Game and rights holder | Terms | Notes |
|---|---|---|---|
| **5e** | *System Reference Document 5.1*, Wizards of the Coast LLC | CC BY 4.0 (the SRD 5.1) | Field names and terminology follow the SRD; no SRD text is bundled. The system is named "5E" and carries no publisher's wordmark or logo; the d20 on its back is original. See the SRD attribution below. |
| **dcc** | *Dungeon Crawl Classics*, Goodman Games | Open Game License v1.0a | `dcc/OGL.txt` carries the notice and the licence: no game text bundled, field names follow the game, samples invented. "Dungeon Crawl Classics" and Goodman Games' Product Identity are not reproduced. |
| **dftq** | *Descended from the Queen* — the framework *For the Queen* (Alex Roberts) offers for games built on it | The framework's terms | The system is a card design for such games; nothing of *For the Queen* is bundled, and the samples are invented. |
| **dino-island** | *Escape from Dino Island* (Sam Tung & Sam Roberts, Mythworks); German edition *Flucht von Dino Island* (System Matters) | **Bundled with the explicit permission of the authors, Sam Tung & Sam Roberts** | Layouts and terminology only — no prose, images or logos of the game. |
| **dragonbane** | *Dragonbane*, Free League Publishing (Fria Ligan AB) | Not a Supplement under the Dragonbane Third-Party Tabletop Module License, which defines one as a publication of adventures, setting material or rules additions; the system bundles none, and no Free League text, artwork or logo | A card design in the spirit of the game's own card deck: colours and proportions follow the printed cards, no illustration of the publisher's is reproduced, and the textures are not Free League's. Anyone who publishes a Supplement made with it carries that licence's obligations — the logo, the notice — themselves. This system is not affiliated with, sponsored or endorsed by Fria Ligan AB. |
| **eiserne-zeit** | *Eiserne Zeit*, Gazer Press, Vienna (Markus Schauta; illustrations Marianne Musek) | **Bundled with the explicit permission of Markus Schauta** | The only system that ships a publisher's logo and graphic design — see the row above. Layouts, terminology and samples are original to this project. |
| **mini-d20** | *MINI D20*, Seba (kritischerfehlschlag.de) | **Bundled with the explicit permission of MINI D20's creator, Seba** | Layouts, terminology and samples are original to this project; the icons are game-icons.net's (above). |
| **pf2e** | *Pathfinder Second Edition*, Paizo Inc. | Paizo Community Use Policy | The "P" mark and the five action glyphs are Paizo's, under the policy; see the notice below. No rules text is bundled; samples are invented. |
| **simple** | — | MIT | Original to this project; system-agnostic. |
| **sw** | *Swords & Wizardry*, Matthew J. Finch / Frog God Games | Open Game License v1.0a | `sw/OGL.txt` carries the notice and the licence, on the same terms as dcc's. |
| **tor2e** | *The One Ring*, second edition, Free League Publishing / Sophisticated Games; Middle-earth is the property of Middle-earth Enterprises and the Tolkien Estate | Proprietary — nothing of it is bundled | Layout and field names only. The samples name no Middle-earth place, person or thing, and none may be added to the bundled content. |
| **troubleshooters** | *The Troubleshooters*, Helmgast AB | Helmgast Fan Content Policy | Compliant Fan Content: the policy permits the game's names, trademarks and mechanics and forbids its text, illustrations and graphic design; the system bundles none of the latter — the game's name on the back is set in Bangers as text — and the plugin is free. See the notice below. |

### SRD 5.1 attribution (5e)

> This work includes material taken from the System Reference Document 5.1
> ("SRD 5.1") by Wizards of the Coast LLC and available at
> https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1
> is licensed under the Creative Commons Attribution 4.0 International
> License available at https://creativecommons.org/licenses/by/4.0/legalcode.

### Paizo Community Use notice (pf2e)

> Cardsmith uses trademarks and/or copyrights owned by Paizo Inc., used
> under Paizo's Community Use Policy (paizo.com/licenses/communityuse). We
> are expressly prohibited from charging you to use or access this content.
> Cardsmith is not published, endorsed, or specifically approved by Paizo.
> For more information about Paizo Inc. and Paizo products, visit
> paizo.com.

### Helmgast Fan Content notice (troubleshooters)

> This product is unofficial Fan Content for The Troubleshooters permitted
> under the Helmgast Fan Content Policy:
> https://helmgast.se/meta/fan-content-policy

## Runtime dependencies

Bundled into `main.js`:

| Package | Licence |
|---|---|
| handlebars | MIT |
| js-yaml | MIT |
| marked | MIT |

Build and test tooling (esbuild, TypeScript, Vitest, Playwright, the
Obsidian API typings) is not distributed with the plugin.
