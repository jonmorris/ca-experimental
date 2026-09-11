# Cardboard Appendix — Product Requirements

A functional spec for a rewrite from zero. Visual design and file layout are open; **behavior, content model, and URL contract are not**. Keep whatever functionality the current site offers; redesign the interface freely.

---

## 1. Purpose

A static web platform for board game rules. Each game gets a set of authored content types (rulebook, summary, glossary, book index, and any game-specific extras) with stable, human-readable URLs, cross-linking between them, per-game search, and per-reader bookmarks. No accounts, no backend, no comments. Content is Markdown + frontmatter, committed to git.

## 2. Product scope

**In scope:**

- Multi-game site with a shared shell and per-game content
- Base games and expansions (expansions nest under base game)
- Cross-linking (glossary terms, rulebook sections) via shortcodes
- Per-game search (scoped, cannot leak into other games)
- Optional global search across all games
- H2-anchor-level bookmarks, saved per-reader, surfaced on the game's landing page
- Print as a first-class output for every content type
- Static hosting on Cloudflare Pages

- Dark mode, and a reading-preferences panel (theme, text size, body typeface, line spacing)

**Deferred (documented, not built):**

- Text-highlight annotations
- User accounts / server-synced bookmarks (storage shape must be forward-compatible)
- Cross-game similarity / recommendations
- Any authoring UI (content is git-committed)

## 3. Content model

### 3.1 Games

Each game lives at `src/games/{slug}/`. Slug is kebab-case, stable, forms the URL segment. Every game has a metadata file (`game.json` or `game.yml`) containing at minimum:

- `title`
- `designer`, `publisher`
- `players`, `time`
- `bgg_id` (canonical BoardGameGeek numeric ID)
- `description`
- `tags` — array of `{ slug, label }`. Hidden metadata for future filtering/similarity; not rendered until filtering is enabled.

Presentation differences between games are driven from `game.json` data. **Never** from `{% if gameSlug == "..." %}` checks in templates or game-prefixed CSS selectors.

### 3.2 Content types

One file per content type, at the game root. Filename = content type slug. URL = `/games/<game-slug>/<content-type>/`. Sections within a content type are H2s with **stable, manually-set, slugified anchor IDs**. Renames must keep the old anchor as an alias so bookmarks and inbound links survive.

Standard content types:

| Content type | File           | Notes                                                   |
| ------------ | -------------- | ------------------------------------------------------- |
| Rulebook     | `rulebook.md`  | H2 sections drive the on-page TOC and rule shortcode targets. |
| Summary      | `summary.md`   | Narrative overview.                                     |
| Glossary     | `glossary.md`  | Terms as frontmatter array `[{ term, slug, short, long }]`. Each term gets its own deep-linkable page. |
| Book index   | `index.md`     | Entries as frontmatter array `[{ term, refs: [{ rule, anchor?, label? }] }]`. |
| Landing      | `landing.njk`  | The game's home at `/games/{slug}/`. Pulls from metadata. |

Game-specific content types (e.g., a strategy primer, a scenario guide) follow the same rules: one file at the game root, generic template, no bespoke fork per game.

**A file only exists when it has real content.** No empty placeholders. Absence = that content type doesn't exist for that game.

### 3.3 Expansions

Nested directories under the base game. Path: `src/games/{game-slug}/{expansion-slug}/`. URLs mirror the path: `/games/{game-slug}/{expansion-slug}/{content-type}/`. No `expansions/` prefix segment anywhere.

Content is base-level by default. Put a file in an expansion directory only when the content is exclusively about that expansion.

### 3.4 Source and working files

- `_source/` — raw source material, OCR dumps, copied draft text. **Read-only.** Never edited, reformatted, renamed, moved, or deleted by tooling or automation. Pull-only into destination content files.
- `_working/` — in-progress notes and drafts that stay with the game while content is being prepared. Not published.

Neither directory is published in the built output.

### 3.5 BGG metadata

Every game's `bgg_id` must be validated against a Geekdo endpoint. An ID is valid only if the item exists, `subtype` is `boardgame`, and the canonical `href` starts with `/boardgame/{id}/`. A verification script (`npm run verify:bgg`) validates all IDs; strict mode fails the build on network errors.

## 4. URL structure

All permalinks are explicit. Nothing implicit from the SSG's default routing.

| URL                                          | Source                                    |
| -------------------------------------------- | ----------------------------------------- |
| `/`                                          | Site homepage — lists games               |
| `/games/{slug}/`                             | Game landing page                         |
| `/games/{slug}/rulebook/`                    | Rulebook — anchors: `#section-slug`       |
| `/games/{slug}/summary/`                     | Summary                                   |
| `/games/{slug}/glossary/`                    | Full glossary                             |
| `/games/{slug}/glossary/{term-slug}/`        | Individual term page (deep-linkable)      |
| `/games/{slug}/index/`                       | Book index                                |
| `/games/{slug}/{expansion-slug}/{type}/`     | Expansion content, same shape as base     |
| `/404.html`                                  | Not found — see §4.2                      |

URLs are stable forever. Renaming a section keeps the old anchor as an alias.

### 4.1 Hosting under a path prefix

The contract above describes the site's own URLs. Setting `PATH_PREFIX` hangs
the whole of it beneath a subpath, for a host that serves from `/{repo}/`
rather than a root domain, without changing a single authored URL.

The prefix is applied to the *output*, and only href and src attributes are
rewritten for it. **Any URL that reaches the browser some other way has to
carry the prefix itself**: values in data attributes, URLs embedded as JSON,
URLs built at runtime in JavaScript, and `url()` inside a stylesheet — which is
never rewritten at all, so font and image references in CSS are written
relative to the stylesheet rather than root-absolutely. `npm run verify:links`
checks all of these, not just the markup, because a URL that travels as data
fails invisibly: the page around it renders perfectly.

### 4.2 Not found

`/404.html` is a junction rather than an apology, offering three routes out
that widen from the specific to the general:

1. **What you probably meant.** A 404 arrives with a clue attached — the URL
   itself. The page reads the requested path back, and if it names a game that
   exists (exactly, or unambiguously near: `/games/xia/` is Xia: Legends of a
   Drift System) it offers that game's closest matching pages, ranked by the
   same matcher the command palette uses. Outside a known game the bar is
   higher: a suggestion must actually contain what was asked for, because three
   confident wrong answers are worse than none.
2. **Search**, opening the same command palette the rest of the site uses.
3. **Every game**, as box art.

The last two are in the markup, so the page is a way out without JavaScript.

## 5. Cross-linking

Two Nunjucks shortcodes (or equivalent in whatever template engine the rewrite uses), usable inside any content file:

- `{% term "label" %}` — links to a glossary term in the current game
- `{% rule "label" %}` — links to a rulebook section anchor in the current game (`/games/{slug}/rulebook/#section-slug`)

Behavior:

- Current game is derived from the page's data cascade (game slug propagated from the game's directory data file). Fallback: parse from URL.
- Label is slugified and matched against the target's `slug` first, then against the slugified canonical name.
- Both shortcodes accept an optional explicit slug as second arg for plurals or divergent display text.
- On miss: log a warning, render the label as plain text. **Never fail the build.**
- Term links get `.term-link`; rule links get `.rule-link`. Style them distinctly from normal links so readers can tell a reference from a plain hyperlink.

**Shortcodes are the only structured-content mechanism.** No custom Markdown syntax (`:::example`, etc.). Callouts, cross-references, and future structured blocks are all shortcodes.

## 6. Navigation

Optimised for lookup at the table: a phone in hand, mid-game, finding one rule
while everyone waits. Chrome above the fold is chrome between the reader and
the rule, so the header carries identity and four controls and nothing else.

### Global

- Site title / logo, always linked home
- Access to a "browse all games" surface (homepage suffices for now)

### Per-game

Every in-game page shows navigation for its game: rulebook, summary, glossary,
index (plus any game-specific content types and any expansions), with the
current section highlighted.

### Responsive

A single breakpoint gave a phone's layout to everything up to a small laptop.
Three are used instead, and type and space are fluid between them so nothing
steps.

- **< 46rem** — single column. Header controls collapse to icons.
- **>= 46rem** — wider gutters, multi-column card grids, overlays become
  centred dialogs and side panels rather than bottom sheets.
- **>= 64rem** — a persistent sidebar carries the game's pages and the section
  list; the sticky section bar retires.
- **>= 88rem** — the content column stops growing.

### Finding your place

- **Sticky section bar** (below 64rem): names the section being read and its
  position in the document, and opens the full jump list on tap.
- **Sidebar section list** (64rem and up): the whole outline, with the current
  section marked and scrolled into view.
- **Prev / next** between sibling rulebook sections, at the foot of the page.

Both the bar and the sidebar are driven from one scroll position, so they can
never disagree.

### Command palette

Cmd-K / Ctrl-K opens a single search surface, scoped to the current game;
typing `>` widens it to every game. It resolves navigation targets instantly
from an index embedded at build time, and appends Pagefind full-text results
as they arrive. Bookmarked sections are pinned to the top.

### Bookmarks

Reachable from any page through a drawer in the header, not only from the
game's landing page.

### Breadcrumbs

Present on every in-game page. `Home > {Game Name} > {Section}`.

## 7. Search

- Powered by Pagefind (or equivalent static-site search). Index built as a post-build step; not available in dev mode without an explicit rebuild.
- Every page tagged with `data-pagefind-filter="game:{slug}"` on `<body>`. Main content wrapped in `data-pagefind-body`.
- **Per-game search** on every in-game page: filter results by `{ game: [slug] }` so a search on Indonesia's page cannot surface Arcs results.
- **Global search** on the homepage, and from any page by typing `>` in the palette: no filter applied, results span all games.
- The palette is the only search interface. It must handle empty state, be fully keyboard operable, and clear when the input is emptied.
- Dev-mode caveat is expected: the widget silently fails when the index doesn't exist yet. Optionally surface a "search unavailable — run `npm run build`" fallback.

## 8. Bookmarks

### Scope

- H2-level anchors inside rulebook content only
- Always-visible bookmark toggle (outline / filled state) next to every H2 in a rulebook page — both desktop and mobile

### Storage

Client-side, versioned JSON in `localStorage` under a single key. Storage shape must be forward-compatible with a future server-sync backend.

```json
{
  "schemaVersion": 1,
  "bookmarks": [
    {
      "gameSlug": "indonesia",
      "ruleSlug": "rulebook",
      "ruleTitle": "Rulebook",
      "ruleUrl": "/games/indonesia/rulebook/",
      "anchor": "setup",
      "title": "Setup",
      "url": "/games/indonesia/rulebook/#setup",
      "createdAt": 1729000000000
    }
  ]
}
```

A `BookmarkStore` interface (`list`, `has`, `add`, `remove`) is the only surface any UI touches. Swapping localStorage for a remote impl later is a one-file change.

### Landing-page panel

The game's landing page renders a `Your bookmarks` panel that JS populates from storage, filtered to the current game. Empty state shows an inline "no bookmarks yet — tap the icon next to any heading" message. Non-empty state groups bookmarks by rule section, each entry deep-linking to its H2 anchor with a remove button.

## 9. Print

**Print is a first-class output.** Every page and every component must look correct in print preview. Print overrides live in a dedicated `print.css` (or equivalent scoped stylesheet), never inline in a component's main styles.

## 10. Accessibility

Every page and component must meet this floor. No exceptions.

- Semantic HTML: `<nav>`, `<main>`, `<article>`, `<button>` for buttons, `<a>` for links. Never `<div onclick>`.
- Visible focus states on all interactive elements.
- WCAG AA contrast: 4.5:1 for body text, 3:1 for large text.
- Full keyboard access. Tab reaches everything. No mouse-only interactions.
- Alt text on every image; decorative images get `alt=""`.
- ARIA landmarks and labels for search, navigation, breadcrumbs, and the bookmarks panel.

## 11. Deployment

- **Target:** Cloudflare Pages, static hosting.
- **Build command:** whatever the SSG's production build entrypoint is, followed by the search-index step.
- **Output directory:** conventional (`_site`, `dist`, etc. — whatever the SSG picks).
- **Node target:** 20+.
- No `wrangler.toml` required; Pages serves the output directly.

## 12. Tech stack (current — retain unless there's a reason to change)

- **SSG:** Eleventy 3.x
- **Templating:** Nunjucks
- **CSS:** vanilla, no framework, no preprocessor
- **Type:** self-hosted, openly licensed webfonts, latin subset only
- **Search:** Pagefind
- **Client JS:** vanilla ES modules, no bundler
- **Storage:** `localStorage`

If the rewrite reconsiders the stack, the URL contract, cross-link semantics, storage schema, and accessibility floor are still required — implement them in whatever tools you pick.

## 13. Engineering principles

Applies to every change regardless of who is making it.

- **Default to extending, not creating.** Before writing a new component or shortcode, search for an existing one to extend. New requires justification.
- **Reusable by default; experiments excepted.** Anything used a second time becomes a proper reusable form before that second use ships.
- **No game-specific code paths.** If a feature is per-game, drive it from data, not slug checks.
- **No game-specific selectors in shared CSS.** `.merger-calculator`, never `.indonesia-merger-table`.
- **Generic templates for new content types.** Never a one-off for the first game that needs it.
- **Anchor IDs are stable forever.** Renames keep old anchors as aliases.
- **Clean as you go.** When a feature is removed or reworked, dead code and files come out in the same change.
- **Content is Markdown + frontmatter, committed to git.** No authoring UI, no database.

## 14. Out of scope (intentionally)

Accounts, comments, authoring UI, bookmarks sync in phase 1, text highlights,
cross-game similarity.

---

## Amendments

This document is the specification of record and has been amended as the
product changed. Four departures from the original:

1. **Navigation (§6) was reopened.** The original pinned an inline nav bar
   above 1024px, a hamburger below, and a bottom-pinned prev/next bar. The
   brief became at-the-table lookup, which the sidebar, sticky section bar and
   command palette serve better. Two fixed bars competing for one phone screen
   was the wrong trade.
2. **Dark mode was brought into scope.** A rules site is read in dim rooms.
3. **Reading preferences were brought into scope** — theme, text size, body
   typeface and line spacing — which lifts "per-user preferences beyond
   bookmarks" from the out-of-scope list. They reuse the bookmark store's
   versioned-storage pattern.

   Line spacing replaced an earlier line-width control. Every reading app that
   offers text settings has line spacing; line width is carried only by the
   wide-screen ones and is dropped on phones, which is this site's primary
   context. The measure is a design decision instead, held at ~66 characters.
   Typeface lost its "Default" option, which named the same outcome as
   "Serif". Stored preferences needed no migration: a value that is no longer
   recognised already falls back to its default.
4. **The not-found page was specified** (§4.2), and the URL contract now says
   explicitly what a path prefix does and does not rewrite (§4.1). Both came
   out of a real defect: every command-palette result on the deployed site led
   to a 404, because the palette's index travels to the browser as JSON and so
   was never rewritten for the prefix — and neither was anything else that
   reaches the client as data, including every self-hosted webfont.

Everything else — the URL contract, the content model, cross-link semantics,
the bookmark storage schema, print as a first-class output and the
accessibility floor — is unchanged.

---

## Appendix: What existed at the point of rewrite

For context — not requirements — the current implementation includes:

- One example game (Indonesia), scaffolded with metadata, summary, 5+ glossary terms, book index, single-file `rulebook.md` with H2 anchor sections.
- `{% term %}` and `{% rule %}` shortcodes wired end-to-end with graceful miss behavior.
- Per-game Pagefind search + global search surface.
- Responsive hamburger menu, sticky mobile prev/next, breadcrumbs.
- H2 bookmarks with localStorage-backed `BookmarkStore` and landing panel.
- Print styles in `print.css`.
- BGG ID verification script.

The rewrite can look at the current repo (`jonmorris/cardboard-appendix`) as a reference implementation, but nothing in the current visual design or file layout is prescriptive. Only this document is.
