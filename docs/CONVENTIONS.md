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
official: true       # the publisher's own text — see below
---
```

**`official: true` marks a document as the publisher's own text**, and shows an
Official mark on its card and in its own header. It is opt-in per file and
never inferred from the content type: a `players-book.md` transcribed from the
box and a `strategy-primer.md` written here both land on the generic type, so
any default would either miss the first or put the publisher's name on the
second. Of those two mistakes the second costs a reader something, so absent
means unofficial.

Only the official side is marked. Anything written for this site — a summary, a
glossary, an index — carries no mark, because a badge on every document in the
library would stop being read. The mark's presence is a claim; its absence is
not a counter-claim.

**A file only exists when it has real content.** No empty placeholders.
Absence means that content type doesn't exist for that game, and the nav,
landing page and homepage all reflect that automatically.

### Expansions

A directory nested under the base game: `src/games/{game}/{expansion}/`. URLs
mirror the path — `/games/{game}/{expansion}/{type}/`. There is no
`expansions/` segment anywhere.

Content is base-level by default. Put a file in an expansion directory only
when it is exclusively about that expansion.

### Downloads

Files a game offers alongside its pages — the publisher's original PDF, and
anything made for this site. Declared in `game.json` and rendered as a
**Downloads** section on the game's overview, below the contents cards.

```json
"downloads": [
  { "title": "Arcs Rulebook", "file": "downloads/arcs-rulebook.pdf", "note": "Leder Games, 2024" },
  { "title": "Campaign Reference Sheet", "file": "downloads/arcs-campaign-reference.pdf", "note": "Made for Cardboard Appendix" },
  { "title": "Official FAQ", "url": "https://…/faq.pdf", "size": "1.2 MB" }
]
```

An entry carries **either** `file` or `url`, and that is what tells the two
kinds apart — no `type` field to keep in step with reality:

- `file` is a plain filename in the game's own `downloads/` directory
  (`src/games/{slug}/downloads/`). It is copied to `/games/{slug}/downloads/`
  untouched, and the link carries `download`.
- `url` is somebody else's copy. It opens in a new tab like every other
  external link, and may state `size` and `format` since neither can be
  measured from here.

`title` is required. `note` is optional and is the line under the title — use
it to say whose file it is.

**Format and size are measured at build time** for a local file, never typed
into `game.json`: a hand-written size goes stale silently the first time the
file is replaced. An entry whose file is not on disk is dropped with a build
warning rather than rendered, so the page never offers a download that 404s,
and `verify:links` fails on a download link with no file behind it.

`downloads/` is never touched by `npm run sync`, and the `downloads` key is
carried across a sync like `tags` — both are written here and have no upstream
equivalent.

> Files committed here live in git forever, and GitHub Pages wants the built
> site under 1GB. A dozen 20MB rulebooks is fine; the whole shelf at that size
> is not. Link out with `url` where the publisher hosts a copy worth linking.

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

**A game's `site_visibility` decides how much of the site it reaches.**

| Value | Effect |
| --- | --- |
| `listed` (default) | On the shelf and everywhere else |
| `unlisted` | Pages build and URLs work; off any page that enumerates games |
| `hidden` | Not built at all |

Two different reasons to hold a game back, and collapsing them would serve
neither: rules still being written should have no pages, while a finished game
that is not ready to announce needs working URLs to share. An unlisted game
stays in search and in the command palette — unlisted means unadvertised, not
unreachable.

`buildGames()` drops hidden games, so nothing downstream has to remember they
exist; but pages come from files rather than from the registry, so
`games.11tydata.js` also returns `permalink: false` for a game the registry has
dropped. Anything that enumerates games reads the `listed` data, never `games`.

**Never hand-edit synced content.** `src/games/` is written by
`npm run sync` from the upstream rules repository, which overwrites. A
correction belongs in `scripts/sync-content.mjs` as an override, where it is
re-applied on every sync and carries a note saying what it is for — or upstream,
after which the override can go.

**Images are never referenced from the output directory.** Box art lives in
`src/games/{slug}/images/` and is not passed through to `_site`; the Eleventy
Image transform reads the source and writes only the sizes a page actually
draws. A template therefore points `box_art` at the source path and lets the
transform resolve it — nothing should link to an image expecting to find it in
the built site.

Give every `<img>` a `sizes` attribute. Without one a browser assumes the image
fills the viewport and fetches the largest file for a tile the size of a
playing card; the grid in particular adds columns rather than growing tiles, so
a cover is about 315px wide whatever the screen.

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

### 14px is the floor

**No text on this site is set smaller than 14px.** `--text-min` holds it, the
four rungs of the type ladder that could fall through it carry it in a `max()`,
and `--text-chrome` — the breadcrumbs — sits on it directly.

It is a limit under the ladder rather than a step on it, so the rungs still say
what size they were designed to be. The consequence is that the bottom of the
ladder flattens: at the default scale the three smallest steps all resolve to
14px. That is the cost, and it is the intended one. **Where two pieces of text
genuinely need to differ down there, raise the larger one onto a rung that
clears the floor — never duck the smaller one under it.** Weight, colour and
letter-spacing are the other ways to separate two things at one size, and they
were always the better ones.

Both multipliers are inside the floor: a design's own `--scale` and the
reader's Compact setting can each shrink the ladder, and neither can push
anything through. A reader choosing Compact gets less than they used to at the
small end, which is the floor doing its job.

**An exception is a decision, not a default.** Set the size in the rule that
needs it, write the reason in a comment beside it, and expect to justify it.

**A granted exception returns the element to the size it had before the floor
— never to a new one chosen to be nearly that.** `--text-micro` is that size,
kept for the purpose: it is what `--text-2xs` resolved to before the floor
existed, and it is still on the ladder so it moves with a design's own
calibration. Picking a fresh number each time is what turns a short list of
exceptions into a long list of near-misses, and the old size is the only one
that has already been looked at and agreed.

There are ten, and all sit under the floor at the size they had before it:

- **The bookmark count over the header icon.** A one- or two-digit number taken
  in at a glance as a change of state. At 14px it was the loudest thing in the
  header, a capsule as wide as the control under it. This one keeps its own
  `0.625rem` rather than `--text-micro`, because that is what it was.
- **The section position in the sticky bar.** Two figures and a slash beside
  the name they qualify. At 14px it matched that name exactly, and a bar whose
  two halves are the same size has no first half — the eye takes "Playing a
  Chapter 1 / 3" as one string rather than as a name with a position after it.
- **The row numbers in the section list.** Ordinals in their own column,
  counted along rather than read. At the floor each row was two equal-weight
  things instead of a name with a number in front of it.
- **The Official mark.** A claim about the document rather than a word in its
  name, set against a page title and against a card's heading. At the floor,
  uppercase at 600 with caps tracking, it was a second piece of type competing
  with the name it qualifies — and the capsule, the tracking and the weight
  already make it findable without the size helping.
- **"Previous" and "Next" on the section pager.** The one word on that control
  that never changes and never needs reading — the section name under each is
  what a reader takes from it, and which side of the bar it sits on says the
  rest. At the floor the standing word was heavier than the name it introduces.
- **The format and size on a download row.** "PDF · 3.7 MB" is the cost of the
  tap rather than the name of the thing — read once, before deciding, and never
  again. At the floor it matched the file's name across the row and the row had
  two headlines.
- **The group legends in the reading panel.** "Theme", "Text size" — each
  names the row of choices under it, and the choices are what is read. At the
  floor a legend matched the buttons it introduces, so every setting was two
  equal-weight things and the panel had no structure to scan by. The buttons
  themselves stay on the floor: they are what a reader is looking for and
  pressing.
- **The section count and Official mark at the foot of a contents card.**
  Neither is why anybody is looking at the card — the name at the top is — and
  both are glanced at once while choosing between cards. At the floor the line
  matched the description above it and the card had two paragraphs instead of a
  body and a footnote.
- **The labels in a game's facts block**, not the facts. What a reader takes
  from it is the values, and the labels only say which is which — most are
  guessable from the value alone. At the floor each pair was two lines of one
  size and the block read as alternating words rather than as a table. The
  values stay on the floor, a step above.
- **The game's name above the document's in the open section sheet.** An
  eyebrow is not read on its own account: it is context for the title under it
  and works by being visibly the smaller of the two. At the floor it came
  within a pixel of the name it qualifies, and uppercase at 700 with caps
  tracking it read as the louder of the pair.

That is the test an exception has to pass: not "this is hard to fit", but "this
is not reading text, and holding it to the floor makes the page worse".

Two other things were under the floor when it went in and neither was granted
anything, because both were faults rather than choices: the same badge at 10px,
and an unstyled `h6` in a rulebook setting smaller than the body text it
headed.

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

H2-level anchors on bookmarkable content types, which is every type unless it
sets `bookmarkable: false` in `lib/content-types.js`. Opting out is for a page
with nothing durable of its own to point at — the book index, whose every entry
is already a pointer to a rulebook section — not a judgement about how useful
the content is.

A glossary is the exception to "H2-level": its headings are the letters A, B, C
generated by the layout, so the term carries the control instead. Its markup
comes from the `bookmarkToggle` shortcode, which shares one function with the
`enhanceHeadings` filter so the two cannot drift into two different controls.

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

## 8b. Related games

Every game's overview ends with a row of other games, ranked at build time by
shared designer and publisher and re-ranked in the browser against what the
reader has favourited and opened.

- **The scoring lives in `lib/related.js`** and nowhere else. A template asks
  `related.games[slug]` for a ranked list and renders it; it does not know what
  a score is.
- **Credits are parsed, never re-authored.** `designer` and `publisher` stay
  the sentences they are in `game.json` and stay what the page renders. The
  registry puts the parsed slugs beside them as `meta.designers` and
  `meta.publishers`, which nothing displays.
- **`tags` are not read by it.** Deliberately — see `DEFERRED.md`. Wiring them
  in before the vocabulary covers the shelf is the thing not to do.
- **Candidates come from `listed`**, like everything else that enumerates
  games. An unlisted game gets a row of its own but is never in anybody's.
- **The row is complete without JavaScript.** The browser pass reorders and
  re-hides tiles the build already wrote, the same contract the shelf's sorting
  keeps.

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
