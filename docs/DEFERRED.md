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

Reading position, collapsed sections, justification. Theme, text size, body
typeface and line width are **built** — see `preferences.js`.

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
