# Contributing

Thank you for looking under the hood. This page is what you need to build
the plugin, run its tests, and get a change merged — including a new
bundled system.

## Build

```bash
npm install
npx playwright install chromium   # once per machine; the browser tests need it
npm run dev        # esbuild watch → main.js
npm run build      # production build; fails when main.js is over budget
npm test           # vitest, both projects
npm run check      # typecheck + lint + format:check + test — what CI runs
```

To see a build in Obsidian, link the checkout into a vault's plugin folder
and enable the *Hot Reload* community plugin there; every build reloads the
plugin.

```bash
ln -s "$(pwd)" /path/to/vault/.obsidian/plugins/cardsmith
```

## Tests

`npm test` runs two Vitest projects. `node` holds everything under
`tests/` that never asks a browser for a size; `browser` holds
`tests/browser/**` and runs in Playwright's headless Chromium. The rule
for where a test goes: if it reads a layout — a `scrollHeight`, a settled
font size, a face that spilled onto a second card — it belongs in the
browser project. `npx vitest run --project browser` runs that project
alone.

**Goldens.** Much of the suite compares against committed files under
`tests/fixtures/<system>/`: a card note (`<name>.md`) beside its rendered
faces (`<name>.front.html`, `<name>.back.html`), its settled layout as
text (`<name>.layout.txt`), the deck note (`_deck.md`) beside the
composition of its pages (`_deck.compose.txt`), and the blocks the insert
commands write (`_insert-*.md`). A change to a template, a stylesheet or
the layout engine shows up as a diff in these files, which is how such a
change is reviewed. Regenerate them with

```bash
UPDATE_GOLDENS=1 npm test
```

and read the diff before committing it: only what you meant to change may
have moved. A layout golden's committed type scale is compared with a
small tolerance, because font rasterisers differ by a hundredth between
platforms; everything else is byte-exact. Fixtures are invented content —
never a rulebook's text.

**The bundle budget.** Every bundled font and image travels inside
`main.js`, so `npm run build` fails when the file grows past the ceiling
in `scripts/check-bundle-size.mjs`. The ceiling is a ratchet: lower it
when the bundle shrinks, and raise it only with a commit message that says
what the new bytes are for.

**The documentation's examples** are excerpts of the tree. A fenced block
in `README.md` or `docs/**` whose info string says `from=<path>` must
occur verbatim in that file — `tests/docs-examples.test.ts` checks every
one, so an example that drifts fails the build.

## Adding a bundled system

A system is a folder under `resources/systems/<id>/` with one YAML root
document at its top, listed in `resources/systems.yaml`. The folder sorts
its files by kind — `card-types/`, `templates/`, `styles/`, `fonts/`,
`assets/` — and nothing sits beside the root document. [Writing a
system](docs/authoring/system.md) describes the root document; the
bundled `simple` system is the smallest complete example.

What the bundled-systems test holds every system to:

- it **loads with nothing to report** — every declared face, stylesheet,
  partial, card type and referenced image or font exists;
- it **uses every file it ships** — a file nothing declares or references
  is a build error, because every byte of the folder goes into `main.js`;
- its **stylesheets assemble** with every `url()` inlined.

Beyond the test:

- **Fonts** ship as WOFF2 with their licence text beside them, named so
  the licence's stem prefixes the font files (`cinzel-OFL.txt` covers
  `cinzel-black-latin.woff2`). Only fonts under an open licence.
- **Images** need a row in `NOTICE.md` saying what they are and under
  what terms they ship; a drawing made for the project goes in as inline
  SVG in the stylesheet where it can.
- **The game** gets a row in `NOTICE.md` too: publisher, the terms the
  mechanics come under, what the system bundles of the game — which should
  be nothing but a design and a vocabulary.
- **Fixtures**: at least one card note per card type under
  `tests/fixtures/<id>/`, plus a `_deck.md`, all with invented content;
  then `UPDATE_GOLDENS=1 npm test` writes the goldens.
- **Card-type ids are singular English** (`npc`, `gear`, `creature`)
  whatever the content language.
- **Sizes are relative.** Card CSS uses `%` of the parent for box geometry
  and `em` for strokes and type, never `mm`, `px` or `pt` for structural
  values, because cards ship in several size presets.
- **PDF-safe CSS.** Cards print through Chromium and are read in other
  viewers too: no gradient-filled text (`-webkit-background-clip: text`),
  no blurred `box-shadow` or `drop-shadow` on a face. Both render as stray
  rectangles in some PDF readers.

## Style

Prettier formats, ESLint lints (`npm run lint`, `npm run format`). Comments
and identifiers are English; German appears only in content — a system's
German captions, aliases and samples. A comment says why the code is
shaped as it is, not what it does line by line.

## Commits and pull requests

A commit message describes the change and its reason. Pull requests go
against `main`; CI runs `npm run check` on Linux, so a layout that only
holds on one platform shows up there.
