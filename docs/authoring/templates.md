# Templates

A face is a [Handlebars](https://handlebarsjs.com) template that renders
to the card's HTML. It reads *slots* — the places the system's properties
bind to — and nothing else about the note. The `simple` system's front is
a complete example:

```handlebars from=resources/systems/simple/templates/front.hbs
<div class="card-root card-front simple simple-card">

  <div class="card-header simple-header">
    <div class="card-title simple-title"><span class="text-scalable">{{slot "front-title"}}</span><span class="cs-overflow-counter"></span></div>
    <div class="simple-rule"></div>
  </div>

  <div class="card-content-container simple-content">
    <div class="card-body-scalable">
      <div class="simple-body">{{slot "front-body" linebreaks=true}}</div>
    </div>
  </div>

  {{#if (slot "front-reference")}}
  <div class="card-footer simple-footer">{{slot "front-reference"}}</div>
  {{/if}}

</div>
```

The classes `card-root`, `card-header`, `card-content-container`,
`card-body-scalable`, `card-footer`, `card-title` and `text-scalable` are
the skeleton the layout engine measures and scales — see
[Styles](styles.md). Everything else is the design's own.

## `{{slot}}`

One call form, and switches with defaults:

```handlebars
{{slot "front-title"}}
{{slot "front-body" linebreaks=true}}
{{slot "front-stat-1a" glyph=true fallback=(t "none-label")}}
{{#if (slot "front-reference")}}…{{/if}}
```

An empty slot renders the empty string, so `{{#if (slot "x")}}` is the
hull around an optional place. `0` is a value and renders.

| Switch | Default | Does |
|---|---|---|
| `markdown` | `true` | inline Markdown — bold, italic, lists, wikilinks. `false` escapes instead. `"block"` renders a body: paragraphs, headings, tables, embedded pictures, the break markers |
| `linebreaks` | `false` | a newline becomes `<br>` |
| `glyph` | `false` | the value through the card type's glyph table for this slot first — `1H` printed as `einhändig`; an unknown value passes through |
| `signed` | `false` | a number with its sign: `5` → `+5` |
| `join=` | `", "` | what a list's items are joined with |
| `fallback=` | — | what renders when the value is empty, through the same switches; usually `fallback=(t "key")` |
| `image` | `false` | the value is a picture: its link resolved to a `data:` URI, for a `src` |
| `plain` | `false` | display text only, escaped — for a comparison, or a `title` attribute |
| `list=` | `false` | the value as an array, for `{{#each}}` (below) |

They apply in this order: glyph → signed → join → fallback → image, plain
or markdown → linebreaks. A switch that is not in the table, or a value
that is not `true`/`false`, is reported — which catches `linebreaks=ture`.

**Lists.** `{{#each (slot "x" list=true)}}` iterates the value: a scalar
is one item, a list its items, a list of mappings keeps each mapping's keys
as the note wrote them — so `{{name}}` and `{{desc}}` inside the block
print the fields, rendered with the call's switches.

```handlebars
{{#each (slot "front-table" list=true)}}<tr><td>{{roll}}</td><td>{{name}} {{desc}}</td></tr>{{/each}}
```

**Wikilinks** render as `<span class="cs-wikilink">display text</span>`
everywhere — `[[target|alias]]` shows the alias. The baseline gives the
span no style; a design that wants references to stand out styles it.

## The other helpers

| Helper | |
|---|---|
| `{{slot-label "x"}}` | the caption of a place: the translation `x-label`, or nothing |
| `{{slot-class "x"}}` | a class token from the card type's classifier for `x`, by what the place shows — `badge-{{slot-class "front-header-die"}}`. `value=` classifies another value through the same table, for the items of a list |
| `{{t "key"}}` | a translation in the card's language; the key itself when there is none, so a missing caption is visible on the card |
| `{{asset "assets/logo.png"}}` | a file of the system as a `data:` URI. `inline=true` inserts an SVG's markup itself, so the icon takes the text colour. The path may also come from a value: `{{asset (slot-class "x")}}` |
| `(or a b …)` | the first argument that is present — `{{#if (or (slot "a") (slot "b"))}}` |
| `(eq a b)` | whether two values read the same — for a plaque that would only repeat the title |
| `{{card-type}}` | the card type's id, for a class |

## Partials

A partial is a template of its own, declared once at system level and
called by name:

```yaml from=resources/systems/dragonbane/dragonbane.yaml
partial-templates:
  stat-cell: templates/stat-cell.hbs
  stat-wide: templates/stat-wide.hbs
  card-image: templates/card-image.hbs
```

```handlebars
{{> stat-cell for="front-stat-1a"}}
```

Inside the partial, `{{slot for}}` reads whichever place the caller named —
a slot name may be a literal or a path — which is how one partial draws
every stat cell. `markdown-image-partial: card-image` names the partial an
`![[embed]]` in a note's body renders through, so a picture in the prose
gets the design's frame too.

## Two faces, several cards

A card type names a `front-template` and, when the card has a back, a
`back-template`. A back that only repeats the game's name is still a
template — it is what prints on the sheet's back page.

When a card's text does not fit, the layout engine continues it on further
cards according to `overflow-mode`; the header and footer of the face are
repeated on each. A template shows where it stands in the run with
`<span class="cs-overflow-counter"></span>`, which the engine fills with
`1 / 3` and leaves empty on a single card. Only what is inside
`card-body-scalable` is split; header and footer are never.
