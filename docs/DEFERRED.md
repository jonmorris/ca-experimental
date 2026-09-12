# Deferred features

Deliberately not built. Each entry records what it is, why it is out of scope
for now, and what the current code already does so that building it later is an
addition rather than a rewrite.

Nothing here is a TODO. Do not build any of it without a decision to.

---

## Text-highlight annotations

A reader selecting a passage and saving the highlight, the way bookmarks save
a section.

**Why deferred:** highlights need a durable way to identify a range of text
across content edits. Anchoring to a character offset breaks the moment a
typo is fixed. Solving that well is its own project.

**What already helps:** every H2 has a permanent anchor, so a highlight can be
addressed as "an offset within section X" rather than "an offset within the
page" — which survives edits to any other section. The bookmark record shape
already carries `gameSlug` / `ruleSlug` / `anchor`, which is the same address a
highlight would extend with a range.

---

## Accounts and server-synced bookmarks

Signing in so bookmarks follow you between devices.

**Why deferred:** the site is static, with no backend and no accounts, and
phase 1 does not need one.

**What already helps — this is the one that constrains present code:**

- Bookmarks are stored as versioned JSON under a single key, with a
  `schemaVersion` field. Storage that reports a **newer** schema version than
  this build understands is treated as read-only rather than overwritten, so an
  older tab cannot destroy a newer client's data.
- The stored shape is a flat array of self-describing records, not a keyed map.
  Each record carries everything an API would need — game, content type,
  anchor, title, URL, `createdAt` — so the payload can be `POST`ed as-is.
- `BookmarkStore` (`list`, `has`, `add`, `remove`, plus `subscribe`) is the
  only surface any UI touches. `createBookmarkStore()` takes its storage as an
  argument. Nothing else in the codebase reads or writes `localStorage`.

Adding sync means writing a second implementation of that interface and
choosing between them at `src/assets/js/bookmark-store.js`. It should not touch
a single UI file.

---

## Cross-game similarity and recommendations

"If you like Indonesia, look at…", or filtering the homepage by mechanism.

**Why deferred:** two games is not enough of a corpus for either to be
meaningful, and the taxonomy would be guesswork.

**What already helps:** `game.json` carries a `tags` array of
`{ slug, label }`, normalised and deduplicated by the registry and exposed on
every game record. It is hidden metadata — nothing renders it yet, by design —
so tags can be authored now and the shape is settled when filtering arrives.

---

## An authoring UI

**Why deferred:** content is Markdown plus frontmatter, committed to git, and
that is a deliberate product decision rather than a temporary state. An
authoring UI implies a database and a backend.

**What already helps:** nothing, intentionally. If this is ever reconsidered it
is a different product.

---

## Further reading preferences

Reading position, collapsed sections, justification, line width. Theme, text
size, body typeface and line spacing are **built** — see `preferences.js`.

Line width was built and then withdrawn: measured across our own content its
three settings gave 58, 68 and 83 characters, so the default already sat in
the 50–75 band the research favours and one of the other two was always worse.
It is also the one control the reading apps drop on a phone — both Instapaper
and Readwise Reader restrict it to wide screens — which is the context this
site is designed for. The measure is now a design decision, held at ~66
characters by `--measure`.

**Why deferred:** each control is one more thing to design, persist and test,
and the four that shipped cover the complaints that actually come up.

**What already helps:** `PREFERENCES` in `src/assets/js/preferences.js` is a
table. Adding one is an entry there plus the tokens it drives — the panel, the
persistence, the cross-tab sync and the no-flash boot script all read from the
same table and need no changes.

---

## Collapsible sections and inline glossary popovers

Folding H2 sections to skim a rulebook as an outline, and showing a glossary
definition in place rather than navigating to it.

**Why deferred:** both were considered for the at-the-table redesign and cut.
Collapsing needs care so that print and deep links still expand correctly;
popovers duplicate a destination that already exists as a page.

**What already helps:** every H2 already carries a stable anchor and is
addressable, and `section-tracker.js` already knows the document's outline.
Glossary terms already resolve through one shortcode, so a popover would be a
change to how `{% term %}` renders and nothing else.

---

## Offline reading and installing to the home screen

A service worker caching the site so it works with no connection, a
`manifest.webmanifest` so it can be added to a phone's home screen, and a
"Save for offline" button to pull down a game you have not read yet.

**Why deferred:** the promise cannot be kept, and the mechanism cannot be
supervised.

The promise: Safari clears script-writable storage — the Cache API, the service
worker registration, everything — after roughly seven days without a visit, and
no API call from inside a Safari tab overrides it. Adding the site to the home
screen largely escapes that, but on iOS a standalone web app has had its own
storage container, so a game saved in a tab is not necessarily there when the
icon is opened. The reliable recipe is therefore "install first, then
download", which is a ritual to explain before the feature can be trusted. A
button that says *saved for offline* would be telling a reader something we
cannot check and they cannot verify, and the moment it matters is the moment
they have no signal to fix it.

The mechanism: a service worker is sticky. A browser that has one keeps using
it, and a broken one cannot be reached — only replaced, through an update path
that is itself the thing that broke. This site has no analytics and no error
reporting, so a fault would be invisible from here and unfixable from there.
That is a poor trade for a feature whose payoff is that the rules sometimes
still open on a train.

**Revisit if** any of these change: the audience is known to install the site
(which makes the storage story sound), there is some way to observe failures in
the field, or the site moves off a subpath to a root domain, which removes the
scope and prefix questions below.

**What already helps:**

- **Content-hashed filenames.** `scripts/hash-assets.mjs` names every stylesheet,
  script and font for its own contents, which is the hard half of cache
  invalidation and the reason a cache-first strategy would be safe here: an
  edit changes the address, so a stale copy is never asked for again. On a site
  with stable filenames, cache-first is how returning readers get bricked.
- **The jump index is already inline.** `paletteIndex` ships as JSON in every
  page rather than as a fetched file, so every section, term and rule target on
  the site is reachable from any cached page with no network round trip. That is
  the useful part of offline, and it already works. Only full-text search needs
  Pagefind's separate index.
- **The 404 page already recovers from a URL**, which is the natural offline
  fallback for a navigation that misses the cache — it would need a different
  sentence, not different logic.
- **`hash-assets.mjs` already excludes a directory** (`_site/pagefind/`), so the
  requirement that `sw.js` keep a stable, unhashed name has a precedent to
  follow rather than a mechanism to invent.
- **Sizes are measured**, so the tiers do not need re-deriving: the shell (CSS,
  JS, fonts) is ~1.5MB, a game is 0.6–5MB, all box art is 5MB, Pagefind's index
  is 3.1MB, and the built site is 27MB — far too much to precache, which is why
  a per-game download is the shape this would take.
- **Scope and prefix.** The site is served under `/ca-experimental/`, so a
  service worker would have to be served from that directory to cover it, and
  the manifest's `start_url` and `scope` would have to carry the prefix
  themselves — `HtmlBasePlugin` rewrites `href` and `src`, never data. The same
  class of bug that once 404'd every search result.
