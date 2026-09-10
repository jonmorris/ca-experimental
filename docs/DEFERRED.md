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

## Dark mode

**Why deferred:** out of scope for phase 1.

**What already helps:** every colour in the site is a custom property in
`src/assets/css/tokens.css`, declared once on `:root`. No component hard-codes
a colour. A dark theme is a second block of token values plus a
`prefers-color-scheme` query — the components would not change.

The contrast annotations in `tokens.css` are per-pair and would need redoing
for a dark palette; that is the actual work.

---

## An authoring UI

**Why deferred:** content is Markdown plus frontmatter, committed to git, and
that is a deliberate product decision rather than a temporary state. An
authoring UI implies a database and a backend.

**What already helps:** nothing, intentionally. If this is ever reconsidered it
is a different product.

---

## Per-user preferences beyond bookmarks

Reading position, font size, collapsed sections.

**Why deferred:** out of scope for phase 1.

**What already helps:** the storage-key namespace (`cardboard-appendix:…`) and
the pattern in `bookmark-store.js` — versioned payload, defensive reads, a
narrow interface — are the shape any further preference store should copy
rather than invent.

---

## Global search on every page

Currently the global surface is the homepage only; in-game pages search their
own game.

**Why deferred:** it is the behaviour the requirements ask for, and per-game
scoping is the point — a search on Indonesia's page must not surface Arcs.

**What already helps:** the widget takes its scope from a `data-search-game`
attribute and applies no filter when it is absent. A global widget anywhere is
a call to the same macro with an empty scope.
