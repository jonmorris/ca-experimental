# Cardboard Appendix

A static site for board game rules. Each game gets a rulebook, a summary, a
glossary and a book index — cross-linked, searchable within that game,
bookmarkable at the section level, and laid out for print as carefully as for
screen. No accounts, no backend, no comments. Content is Markdown plus
frontmatter, committed to git.

Built against [REQUIREMENTS.md](docs/REQUIREMENTS.md), which is the
specification of record.

## Quick start

```bash
npm install
npm run dev        # http://localhost:8080 — no search index (see below)
npm run build      # site + search index into _site/
npm run verify     # URL contract, internal links, BGG IDs
```

Node 20 or newer.

## Scripts

| Script | Does |
| --- | --- |
| `npm run dev` | Eleventy dev server with live reload. |
| `npm run build:site` | Builds the site into `_site/`. |
| `npm run build:search` | Builds the Pagefind index over `_site/`. |
| `npm run build` | Both, in order. This is the deploy command. |
| `npm run verify:links` | Checks the URL contract and every internal link and anchor in `_site/`. Needs a build first. |
| `npm run verify:bgg` | Validates every `bgg_id` against Geekdo. |
| `npm run verify:bgg:strict` | The same, but a network error is a failure. What CI runs. |
| `npm run verify` | Links and BGG together. |

**Search is not available in dev.** The index is built by `npm run build:search`
as a post-build step, so `npm run dev` has nothing to query. The widget says so
rather than failing silently. Run `npm run build` and serve `_site/` to test
search.

## Layout

```
lib/                     Shared logic — used by the build, the data layer and the scripts
  slugify.js               The one slug function. Anchors, term slugs and URL segments all use it
  headings.js              Markdown heading parsing and anchor resolution
  content-types.js         The content-type registry: labels, layouts, nav order
  registry.js              Scans src/games/ and builds the game registry
  heading-tools.js         Injects per-heading UI and anchor aliases into rendered HTML
src/
  _data/                 Global data (site.json, games.js, glossaryTerms.js)
  _includes/
    layouts/               base → game → { article, rulebook, glossary, index-page }, plus landing
    partials/              header, game nav, breadcrumbs, search, prev/next, bookmarks panel
  assets/
    css/                   tokens, base, layout, components, content, print
    js/                    ES modules, no bundler
  games/
    games.11tydata.js      Permalinks, layouts and game context for everything under games/
    {game-slug}/           One directory per game
scripts/                 Verification scripts
docs/                    Requirements, conventions, deferred features
```

## Adding a game

1. `src/games/{slug}/game.json` — see [docs/CONVENTIONS.md](docs/CONVENTIONS.md)
   for the fields.
2. `src/games/{slug}/landing.njk` — an empty frontmatter block is enough; the
   landing page is built from `game.json`.
3. Add content files: `rulebook.md`, `summary.md`, `glossary.md`, `index.md`.
   **Only add a file when it has real content** — absence means that content
   type doesn't exist for that game, and nothing renders an empty shell.
4. `npm run verify:bgg` to confirm the BGG ID.

No code changes are needed, including for a content type no other game has:
a file called `strategy-primer.md` builds at
`/games/{slug}/strategy-primer/` with the generic layout and appears in the
nav automatically.

## Deployment

Cloudflare Pages, static.

| Setting | Value |
| --- | --- |
| Build command | `npm run build` |
| Output directory | `_site` |
| Node version | `20` (or newer) |

No `wrangler.toml` — Pages serves the output directly.

## Documentation

- [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) — the specification this
  implements.
- [docs/CONVENTIONS.md](docs/CONVENTIONS.md) — content model, URL contract,
  cross-linking, anchors, and the engineering rules that apply to every change.
- [docs/DEFERRED.md](docs/DEFERRED.md) — features deliberately not built, and
  what the current code already does to keep the door open for them.
