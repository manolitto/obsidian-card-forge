# Card Forge

An Obsidian plugin that turns your notes into print-ready, double-sided card
decks: board game components, RPG reference cards, flash cards — anything you
print on a card.

A *system* is a family of cards that share a look and a vocabulary. Card Forge
ships several and lets you build your own in your vault.

> **Status: early.** This is a ground-up reimplementation of an older plugin of
> the same lineage. It is not yet usable; the engine is being rebuilt module by
> module.

## Development

```bash
npm install
npx playwright install chromium   # once per machine, for the browser tests
npm run dev      # esbuild watch
npm run build    # production build → main.js
npm run check    # typecheck + lint + format + tests
```

The tests are two vitest projects: `node` for everything that never touches
a layout, and `browser` (`tests/browser/`) for what reads one — those run in
a real Chromium, where a `scrollHeight` means something.

To try it in Obsidian, link the checkout into a vault's plugin folder and
enable the `hot-reload` community plugin there:

```bash
ln -s "$(pwd)" /path/to/vault/.obsidian/plugins/card-forge
```

## Licence

MIT for the code. Bundled fonts, images and game content carry their own
licences — see `NOTICE.md` once resources land.
