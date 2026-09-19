# Styles

A system's look is CSS: one stylesheet for the system, optionally one per
card type, layered over a base stylesheet every card shares. The base
knows no colour and no typeface — it fixes the skeleton a face is built
on and the hooks the layout engine measures.

## The skeleton

A face is a column: header, content, footer, each a direct child of
`.card-root`. The classes the base stylesheet provides, and what they do:

| Class | |
|---|---|
| `.card-root` | the card: `--card-width` × `--card-height`, a flex column, `overflow: hidden` |
| `.card-header`, `.card-footer` | fixed height, repeated on every continuation face |
| `.card-content-container` | the flexible middle |
| `.card-body-scalable` | the text the engine scales and splits — put the card's long text here and nothing else |
| `.card-title` | a one-line title the engine fits to its width |
| `.text-scalable` | an inline span the engine may shrink to fit its line — wrap a title's text in it |
| `.card-type-badge` | a one-line badge, fitted like a title |
| `.cs-wikilink` | a link's display text; unstyled by the base |

A design styles these and its own classes; it does not change their
geometry.

## Sizes are relative

Cards print at several sizes — mini to large — from one stylesheet, so
**box geometry is `%` of the parent and strokes and type are `em`**, never
`mm`, `px` or `pt` for anything structural. The one deliberate absolute is
the type-size budget:

```css from=resources/systems/simple/styles/simple.css
  --card-font-size-min:        2.5mm;
  --card-font-size-max:        3.1mm;
  --card-font-size-title-min:  3.4mm;
  --card-font-size-title-max:  5.5mm;

  --simple-font-body:  clamp(var(--card-font-size-min),       calc(var(--card-width, 63mm) * 0.046), var(--card-font-size-max));
  --simple-font-title: clamp(var(--card-font-size-title-min), calc(var(--card-width, 63mm) * 0.075), var(--card-font-size-title-max));
```

The size follows the card's width between a floor that keeps the smallest
preset legible and a ceiling that keeps the largest from shouting. The
floor is also where the layout engine stops shrinking: text that does not
fit at `--card-font-size-min` overflows instead (below).

## Fonts

A font is declared with `@font-face` in the stylesheet, its file referenced
by `url()` relative to the system folder:

```css from=resources/systems/simple/styles/simple.css
@font-face {
  font-family: 'Source Sans 3';
  font-style: normal;
  font-weight: 400 700;
  font-display: swap;
  src: url('fonts/source-sans-3-normal-latin.woff2') format('woff2');
```

The reference is the declaration — nothing lists fonts elsewhere. Every
font travels inside the exported file, so use WOFF2 and, where the font
offers them, the `latin` / `latin-ext` subsets with their `unicode-range`:
a card without umlauts then loads half. Keep the licence text beside the
font files; only fonts whose licence allows embedding and redistribution.

## PDF-safe CSS

Cards print through Chromium's PDF engine and are opened in other viewers.
Two constructs render as stray rectangles in some of them and are out:

- gradient-filled text (`-webkit-background-clip: text`);
- a blurred `box-shadow` or `filter: drop-shadow()` on anything on a face.

A hard-offset shadow, a flat fill and a gradient inside a box are fine. A
picture with soft edges is an `<img class="fade-edges">`: the engine bakes
the fade into the picture itself, so no mask reaches the PDF.

## Overflow

Before it prints, every card is laid out. The engine shrinks the type in
`.card-body-scalable` step by step towards the floor; if the text still
does not fit, the card's `overflow-mode` decides:

| `overflow-mode` | |
|---|---|
| `none` | the text is clipped at the footer |
| `extra-cards` | the text continues on further cards, each with the face's header and footer |
| `back-then-cards` | the back of the card is filled first, then further cards |

Only the body is split, at block boundaries — never inside a paragraph, a
table row or a `%% keep-together %%` region. The engine stamps classes a
stylesheet can key on: `.cs-overflow-active` on every face of a card that
overflowed, `.cs-front-first`, `.cs-front-continued` on every front after
the first, `.cs-front-has-next` on every front but the last (a "continues"
cue), and `.cs-body-continued` on a body that received the tail of the one before it. A title's
`<span class="cs-overflow-counter">` shows `2 / 3` under
`.cs-overflow-active` and is empty otherwise.

## Layout candidates

A design may offer a card several mutually exclusive ways to be laid out —
with a picture below the text, or without one when it would not fit — and
let the engine choose by measuring:

```yaml
layouts:
  - { name: with-back,   front-face-count: odd,  fallback: true }
  - { name: front-image, front-face-count: even }
layout-decision:
  order:
    - { metric: printed-cards, direction: minimize }
    - { metric: whitespace,    direction: minimize }
  tie-break: declaration-order
```

Every candidate is rendered from the same HTML; the winner's name is
stamped as `.cs-layout-<name>` on the root, and the stylesheet shows or
hides the conditional elements under it. Four rules keep this sound:

1. **No structural change between candidates** — every conditional element
   is in the template, and CSS keyed on `.cs-layout-<name>` shows or hides
   it. `{{#if}}` decides presence once, not per candidate.
2. **Mark what is measured** with `data-cs-measure="<marker>"`; a hidden
   element or a broken picture measures zero.
3. **The default CSS state is the fallback's look**, since a card that fits
   carries the fallback's class and nothing else.
4. **Gate on `.cs-layout-<name>` and nothing else** for anything that
   changes the body.

| Candidate field | |
|---|---|
| `name` | `[a-z0-9_-]+`, the class suffix |
| `front-face-count` | `any`, `odd` or `even` — under `back-then-cards`, whether the run of fronts is padded to that parity so a duplex print stays aligned |
| `eligible-if` | `{ element, min-width?, min-height? }` — out of the running unless the marked element clears the length |
| `fallback` | the winner of last resort; exactly one per set |

| Decision key | |
|---|---|
| `metric` | `printed-cards` (fewest physical cards), `element-size` (a marker's `width`, `height` or area), `whitespace` (the unfilled share of the last front) |
| `direction` | `minimize` or `maximize` |
| `epsilon` | the near-tie band for the continuous metrics, default 2 % |

A set of one `any` candidate with no guard — the baseline's — takes the
fast path: shrink, split, done.
