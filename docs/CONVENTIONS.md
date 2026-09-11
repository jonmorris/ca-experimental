# Conventions

Rules that apply to every change, whoever is making it.

---

## 1. Content model

### Games

One directory per game: `src/games/{slug}/`. The slug is kebab-case, stable
forever, and forms the URL segment.

`game.json` at the game root:

```json
{
  "title": "Indonesia",
  "year_published": 2005,
  "designer": "Jeroen Doumen and Joris Wiersinga",
  "publisher": "Splotter Spellen",
  "players": "2–5",
  "time": "180–240 minutes",
  "bgg_id": 19777,
  "box_art": "/games/indonesia/images/indonesia-cover.jpg",
  "description": "One or two sentences.",
  "tags": [{ "slug": "economic", "label": "Economic" }],
  "expansions": {
    "the-blighted-reach": { "title": "The Blighted Reach", "released": "2024-10-01" }
  }
}
```

`title`, `designer`, `publisher`, `players`, `time`, `bgg_id`, `description`
and `tags` are required. `tags` is hidden metadata for future filtering and
similarity work — it is not rendered anywhere yet.

`expansions` is optional presentation data for expansion directories: a title
and a release date used for ordering. Without it, an expansion's title is
derived from its directory name.

**Presentation differences between games come from `game.json` data.** Never
from a `{% if gameSlug == "…" %}` check in a template, and never from a
game-prefixed CSS selector.

### Content types

One file per content type, at the game root. The filename is the content-type
slug and the URL segment.

| File | URL | Layout |
| --- | --- | --- |
| `landing.njk` | `/games/{slug}/` | `layouts/landing.njk` |
| `rulebook.md` | `/games/{slug}/rulebook/` | `layouts/rulebook.njk` |
| `summary.md` | `/games/{slug}/summary/` | `layouts/article.njk` |
| `glossary.md` | `/games/{slug}/glossary/` | `layouts/glossary.njk` |
| `index.md` | `/games/{slug}/index/` | `layouts/index-page.njk` |
| anything else | `/games/{slug}/{filename}/` | `layouts/article.njk` |

Labels, layouts and nav order live in `lib/content-types.js`. That table is
**not** a whitelist — a content type not listed there still builds, using the
generic article layout. Adding `strategy-primer.md` to one game requires no
code change and produces no bespoke template.

A content file may override its nav label and position from frontmatter:

```yaml
---
title: Official FAQ
navLabel: FAQ        # what the nav tab says
navOrder: 25         # lower sorts earlier; the standard types are 10/20/30/40
subhead: One line under the page title.
---
```

**A file only exists when it has real content.** No empty placeholders.
Absence means that content type doesn't exist for that game, and the nav,
landing page and homepage all reflect that automatically.

### Expansions

A directory nested under the base game: `src/games/{game}/{expansion}/`. URLs
mirror the path — `/games/{game}/{expansion}/{type}/`. There is no
`expansions/` segment anywhere.

Content is base-level by default. Put a file in an expansion directory only
when it is exclusively about that expansion.

### Source and working files

- `_source/` — raw source material, OCR dumps, copied draft text. **Read-only.**
  Never edited, reformatted, renamed, moved or deleted by tooling. Pull from it
  into destination content files; never edit it in place.
- `_working/` — in-progress notes and drafts that travel with the game.

Neither is published. Both are excluded from the Eleventy build entirely, so
nothing in them is ever parsed as a template.

---

## 2. URL contract

| URL | Source |
| --- | --- |
| `/` | Homepage, lists games |
| `/games/{slug}/` | Game landing page |
| `/games/{slug}/rulebook/` | Rulebook; section anchors are `#section-slug` |
| `/games/{slug}/summary/` | Summary |
| `/games/{slug}/glossary/` | Full glossary |
| `/games/{slug}/glossary/{term-slug}/` | One term |
| `/games/{slug}/index/` | Book index |
| `/games/{slug}/{expansion}/{type}/` | Expansion content, same shape |

Permalinks are computed from the file's own path in
`src/games/games.11tydata.js` — never left to Eleventy's default routing, and
never restated per file. There is one place where a URL is decided.

**URLs are stable forever.** `npm run verify:links` enforces the contract and
checks that every internal link and fragment resolves.

**Assets are named after their contents.** `scripts/hash-assets.mjs` stamps
every stylesheet, script and font with a hash of its bytes and rewrites each
reference — in pages, in a stylesheet's `url()`, and in one module's import of
another. Nothing references an asset by a name it writes down by hand, and
nothing may: the name in the output is not the name on disk. Dependencies are
stamped first so a file's hash covers its rewritten references, which is what
makes a change propagate — editing `preferences.js` renames it, `preferences-ui.js`
which imports it, and `site.js` which imports both, while every other module
keeps its name and stays cached.

**A URL that is not an href or a src has to carry the deploy prefix itself.**
`HtmlBasePlugin` rewrites markup for `PATH_PREFIX` and nothing else, so a URL
travelling to the browser as a data attribute, as JSON, built at runtime, or
inside a stylesheet's `url()` will miss it and 404 on a subpath host while
every rendered link on the same page works. Pass it through `withBasePath`
(`lib/base-path.js` at build time, `src/assets/js/base-path.js` on the client),
or in CSS write the reference relative to the stylesheet. `verify:links`
checks the palette index and stylesheet assets for exactly this.

---

## 3. Anchors

Sections within a content type are H2s with stable, manually-set anchor IDs:

```markdown
## Setup & Phase Overview {: #setup-and-phase-overview}
```

The `{: #id}` form is used rather than the more common `{#id}` because
Nunjucks renders markdown files before markdown-it sees them, and reads `{#`
as the start of a comment.

An H2 without an explicit anchor still gets one, from the slugified heading
text. Set it explicitly anyway: an anchor that is written down is an anchor
nobody renames by accident.

**Renaming a section keeps the old anchor as an alias.** Declare it in the
file's frontmatter:

```yaml
anchorAliases:
  - from: contents      # the anchor this section used to have
    to: components      # the anchor it has now
```

An invisible target with the old ID is rendered just before the heading, so
saved bookmarks and inbound links still land. `verify:links` fails if an alias
points at a heading that no longer exists, or collides with a live one.

---

## 4. Cross-linking

Two shortcodes, usable inside any content file:

```njk
{% term "rupiah" %}                    → /games/{slug}/glossary/rupiah/
{% term "slots", "slot" %}             → explicit slug, for plurals
{% rule "New Era" %}                   → /games/{slug}/rulebook/#new-era
{% rule "R&D track", "research-and-development" %}
```

- The current game comes from the data cascade; the URL is only parsed as a
  fallback.
- The label is slugified and matched against the target's `slug` first, then
  against the slugified canonical name. `{% term %}` also matches a term's
  declared `aliases`.
- `{% rule %}` resolves against every heading in the rulebook, not only H2s, so
  a reference to a sub-section works. Shallower headings win a tie.
- **On a miss: a warning is logged and the label renders as plain text. The
  build never fails.** Watch the build output — a warning is a content bug.

Cross-links are styled distinctly from ordinary links, and not by colour alone:
glossary terms get a dotted underline, rulebook references a dashed one, plain
links stay solid. That distinction survives into print.

**Shortcodes are the only structured-content mechanism.** No custom Markdown
syntax. Callouts, cross-references and any future structured block are all
shortcodes:

```njk
{% callout %}An aside.{% endcallout %}
{% callout "Errata" %}With a heading.{% endcallout %}
{% callout inline=true %}Inside a paragraph or list item.{% endcallout %}
{% figure "/games/indonesia/images/mergers.jpg", "Alt text", "Caption" %}
```

---

## 4b. Design system

Everything visual is a token in `src/assets/css/tokens.css`. No component
stylesheet hard-codes a colour, size or space value.

Five attributes on `<html>` drive the whole cascade, so no script ever writes a
style property:

| Attribute | Values | Set by |
| --- | --- | --- |
| `data-design` | `editorial`, `precision` | `site.json` |
| `data-theme` | `light`, `dark` (absent = follow the OS) | reader |
| `data-density` | `compact`, `comfortable`, `spacious` | reader |
| `data-face` | `serif`, `sans` (absent = the design's default) | reader |
| `data-spacing` | `tight`, `normal`, `relaxed` | reader |

Colours are declared once as `light-dark()` pairs, with a plain light value
first as a fallback. Never define a colour in only one theme, and never put a
palette in a media query — an explicit theme is a `color-scheme` flip.

A design direction is a **token overlay** (`theme-editorial.css`,
`theme-precision.css`) scoped to `:root[data-design="…"]`. A direction may not
introduce a component or restructure a layout; if it needs to, that belongs in
the shared stylesheet driven by a token.

**A direction never sets a token the reader controls.** `:root[data-design="…"]`
and `:root[data-spacing="…"]` carry identical specificity, and the design
stylesheet loads later, so it wins and the reader's choice does nothing. A
direction nominates its starting point through a separate `*-default` token
that the reader's control then resolves or scales — `--font-body-default` for
the body face, `--leading-normal-default` for body leading. Both exist because
this went wrong first.

A design nominates `--font-body-default`, never `--font-body`: the two
selectors have equal specificity and the design file loads later, so setting
`--font-body` there would silently beat the reader's choice.

Type and space are fluid (`clamp`) between a phone and a large laptop, so
nothing steps at a breakpoint. Density scales the whole type ramp through
`--scale` rather than by overriding individual sizes.

Fonts are self-hosted and openly licensed, fetched by `scripts/fetch-fonts.mjs`
which also pulls each family's OFL. Latin subset only.

## 5. Bookmarks

H2-level anchors on bookmarkable content types only — currently the rulebook,
set by `bookmarkable` in `lib/content-types.js`.

Storage is versioned JSON in `localStorage` under one key. The shape is
record-based rather than keyed so it can be posted to an API unchanged.

`BookmarkStore` — `list`, `has`, `add`, `remove` — is the only surface any UI
touches. Swapping `src/assets/js/bookmark-store.js` for a remote implementation
is the whole job of adding synced bookmarks.

`preferences.js` follows the same pattern for reading preferences, under its
own key. Between them they are the only code that reads or writes
`localStorage`, with one deliberate exception: the inline script in
`base.njk` applies stored preferences before first paint, because a module
would run after the page had already been drawn in the wrong theme.

Bookmarks surface in three places, all reading the same store — the toggle
beside every bookmarkable H2, the drawer in the header (reachable from any
page), and the fuller panel on a game's landing page.

---

## 6. Search

Pagefind, built as a post-build step over `_site/`.

- Every page carries `data-pagefind-filter="game:{slug}"` on `<body>`.
- Main content is wrapped in `data-pagefind-body`; chrome that would pollute
  results (TOC, prev/next, bookmarks panel) carries `data-pagefind-ignore`.
- A widget with `data-search-game` filters on `{ game: [slug] }`, so a search
  made on one game's page cannot return another game's results.
- The homepage widget applies no filter and spans everything.

---

## 7. Accessibility floor

Every page and component meets this. No exceptions.

- Semantic HTML: `<nav>`, `<main>`, `<article>`, `<button>` for buttons, `<a>`
  for links. Never `<div onclick>`.
- Visible focus on every interactive element. One `:focus-visible` treatment,
  defined once in `base.css`, never removed.
- WCAG AA contrast: 4.5:1 for body text, 3:1 for large text and control
  borders. Every token pair in `tokens.css` is annotated.
- Full keyboard access. Tab reaches everything; nothing is mouse-only.
- Alt text on every image; decorative images get `alt=""`.
- ARIA landmarks and labels on search, navigation, breadcrumbs and the
  bookmarks panel.
- A control that only works with JavaScript ships `hidden` and is revealed by
  the script that makes it work — a reader never meets a dead button.

---

## 8. Print

**Print is a first-class output.** Every page and every component has to be
right in print preview.

All print overrides live in `src/assets/css/print.css`, loaded with
`media="print"`. No `@media print` block anywhere else. What happens on paper
is readable in one file.

---

## 9. Engineering principles

- **Default to extending, not creating.** Before writing a new component or
  shortcode, look for an existing one to extend. New requires justification.
- **Reusable by default; experiments excepted.** Anything used a second time
  becomes a proper reusable form before that second use ships.
- **No game-specific code paths.** If a feature is per-game, drive it from
  `game.json`, not a slug check.
- **No game-specific selectors in shared CSS.** `.merger-calculator`, never
  `.indonesia-merger-table`.
- **Generic templates for new content types.** Never a one-off for the first
  game that needs it.
- **Anchor IDs are stable forever.** Renames keep old anchors as aliases.
- **Clean as you go.** When a feature is removed or reworked, the dead code and
  files go in the same change.
- **Content is Markdown plus frontmatter, committed to git.** No authoring UI,
  no database.
