# Decisions

Why the built things are built the way they are.

`CONVENTIONS.md` says what every change must do. `REQUIREMENTS.md` says what
the product is. `DEFERRED.md` says what we have chosen not to build. This file
is the fourth corner: how a shipped feature actually works, what was decided
along the way, and what was considered and set aside — so that the next person
to touch it, months later, does not re-run an argument that already has an
answer.

**Read the entry before changing the feature.** If you are adding something
new, read `DEFERRED.md` first: it is likely already there, with the reasons.

---

## How to keep this file

- **One section per feature area, not per change.** A feature that grows gets
  its existing section amended, not a second one underneath it. If you cannot
  find the section your change belongs in, that is the signal to add one.
- **Record the decision, not the diff.** Git has the diff. What git does not
  have is the option that was rejected and why, and that is the thing worth
  five minutes in six months.
- **Four headings per entry**, and skip any that is empty:
  *How it works* · *Why it is shaped this way* · *Known wrinkles* ·
  *Where it goes next*.
- **Put it in the right file.** Something not built belongs in `DEFERRED.md`.
  A rule that binds every change belongs in `CONVENTIONS.md`. A change to what
  the product is belongs in the Amendments section of `REQUIREMENTS.md`. This
  file is for what exists and why it is like that.
- **Prune.** An entry describing code that no longer exists is worse than no
  entry. When a feature is removed or reworked, its section goes or changes in
  the same commit, like the code.

---

## Related games — "More games" on a game's overview

**Shipped.** `lib/related.js`, `src/_data/related.js`,
`src/assets/js/related-games.js`, the last section of `layouts/landing.njk`.

### How it works

Two passes over the same row of four tiles.

**At build time**, every game is scored against every other listed game on
credits alone. `designer` and `publisher` are authored as sentences — *"Jeroen
Doumen and Joris Wiersinga"*, *"Ion Game Design, Sierra Madre Games"* — so
`parseCredits` splits them into comparable slugs on commas, semicolons and the
word "and". A shared designer scores 3, a shared publisher 2, and a game
matching both scores the sum. The eight best go into the page; the first four
are shown and the rest ship `hidden`.

Once the credits run out, the rest of the shelf fills in at zero, so the row is
never short. Their order is a hash of the two slugs — arbitrary, different on
every game's page, and identical on every build, which is what `verify:links`
and a readable diff both need.

A tile is a cover and a name. Nothing on the page says why a game is in the
row.

**In the browser**, `related-games.js` re-ranks those eight against the games
this reader has favourited (weight 2) and opened (weight 1), reading their
credits from a small `data-related-affinity` index inlined in the section. A
candidate gains 2 per engaged game sharing a designer, 1 per engaged game
sharing a publisher, capped at 4. The build's order breaks every tie. It
reorders and re-hides tiles that are already on the page — it never fetches,
and the row is complete and correct if the script never runs.

### Why it is shaped this way

- **Credits, not tags.** `tags` exist in `game.json` and are deliberately not
  read. They cover six of twenty games, so a tag-weighted score would be a
  different ranking for a quarter of the shelf and no ranking at all for the
  rest. Credits are on every game and, in board games, cluster honestly: a
  reader who likes one Splotter game usually likes the next.
- **Same-house results are the feature, not a defect.** Four Splotter games at
  the bottom of a Splotter page is the right answer at this catalogue size.
  Expanding somebody's horizons is a thing to do when there is a taxonomy to do
  it with.
- **The ranking is not explained.** Each tile shipped with a line under the
  name — "Also by Cole Wehrle" — and it was wrong twice over: four of them
  under one heading is a paragraph of bookkeeping about a row somebody is
  glancing at on their way out, and the reader did not ask how the sausage is
  made. Removed. Why these four is the scoring's business.
- **The row is never empty and never overclaims.** Xia shares a designer and a
  publisher with nothing else here. It still gets four games, and the heading
  is the flat "More games" rather than "More like this" because of it — the
  one place the row's honesty still has to be visible is the only line of copy
  it has.
- **Eight written, four shown.** A browser re-rank that can only reorder what
  is already visible cannot surface anything, and four extra tiles is the
  cheapest way to give it room. They are `loading="lazy"`.
- **The cap keeps affinity a second opinion.** At 4 it can lift a game past a
  publisher-only link and past the unscored filler, but never past a game by
  the same designer as the one being read. The page you are on remains the
  strongest evidence about the page you are on.
- **The current game is excluded from the affinity signal.** Starring the game
  you are reading would otherwise credit every tile in its row with a link
  already counted at build time, and the order would lurch under the reader's
  hand the moment they pressed the star at the top of the same page.
- **Nothing is filtered out.** On a twenty-game shelf, hiding what the reader
  has already seen would empty the row for exactly the readers who use the site
  most. See *Where it goes next* — this is the open question, not a settled
  answer.
- **`unlisted` games are candidates for nothing.** They keep working URLs and
  stay in search; this row advertises, and unlisted means unadvertised. An
  unlisted game still gets a row of its own.

### Known wrinkles

- **A deep cluster makes the second pass inert.** Six games tie at the top of
  Antiquity's row — same two designers, same publisher — so no amount of
  personal history reorders it. That is arguably correct (the metadata really
  is that strong) but it means the personalization is invisible on the
  Splotter pages, which are nine of twenty. It fires on Root, Xia and the Pax
  games.
- **A second edition ranks as a recommendation.** Pax Renaissance's top result
  is Pax Renaissance: Second Edition, and John Company's is its own 2nd
  edition. Useful — there *is* a newer edition — but it is not really "another
  game you might like", and nothing in the scoring knows the difference.
### Where it goes next

`DEFERRED.md` → *Cross-game similarity and recommendations*, which now holds
the tagging vocabulary this would need to recommend across houses, bookmark-
derived affinity, and the unanswered question of whether this row exists to
send people somewhere new or merely sideways.

---

## Sorting and filtering the shelf

**Shipped, and deliberately partial.** `src/assets/js/shelf.js`,
`lib/shelf.js`, `src/_data/shelf.js`, the tray in `index.njk`.

### How it works

Two sorts (name, release date) with direction as its own control, and two
range filters (players, playing time). Everything operates on tiles the build
already wrote, alphabetically: the module reorders and hides, fetches nothing,
and keeps no second copy of the catalogue. Each tile carries its own sort and
filter keys as data attributes.

Human-written strings — `"2–5"`, `"180–240 minutes"` — are parsed into numbers
once at build time in `lib/shelf.js`, so the browser never sees a string it
has to understand. The slider bounds come from the catalogue rather than from
constants, so they keep covering the games there are when a one-hour game
arrives and nobody remembers to widen a range.

The whole tray folds away behind a button, with a count beside it. A shut tray
is a tray whose state cannot be seen, and a reader who narrowed the shelf and
scrolled away needs to know the shelf is narrowed — otherwise the missing games
read as missing.

### Why it is shaped this way

- **Direction is a separate control, not four entries in the sort list.** "A to
  Z / Z to A" and "newest / oldest first" are the same question asked twice,
  and a list spelling out every combination grows by multiplication each time a
  sort is added.
- **Ranges overlap rather than contain.** A game that plays 2–5 belongs in a
  search for three players. The reader is asking whether the game can meet
  them, not whether it lives entirely inside their window.
- **Weight and tags were the obvious third and fourth filters and neither
  earns a control yet.** Every game on this shelf is heavy, so a weight filter
  would divide twenty games into twenty and none. Most tags are on one game
  each, so a tag filter would be a list of twenty checkboxes that each hide
  nineteen games.

### Known wrinkles

- The two filters are both about the table — who is here, how long we have —
  and there is nothing yet for "what kind of game is this". That is the gap
  tags would fill, and the reason the tray has room for a third row.
- Sort order is not remembered between visits. Nobody has asked, and it is one
  more thing in storage.

### Where it goes next

A tag filter is the next control, and it is blocked on the same thing the
related-games row is: a tagging vocabulary that covers the whole shelf. Held
in `DEFERRED.md` → *Cross-game similarity and recommendations*.

---

## Reordering My Reference

**Shipped.** `src/assets/js/reference-order.js`, the reorder mode in
`src/assets/js/my-reference.js`, `syncJumpList` in
`src/assets/js/section-nav.js`.

**How it works.** A reader can put the sections of their own reference in any
order they like. *Reorder* collapses the page to its headings — every section
is still there with its body filled, the body is only hidden — and each row
grows an up and a down button. A move is `before`/`after` on the section node,
then a write to the store, then `refreshSections()`, which is what hands the new
sequence to the sidebar list, the jump sheet and the prev/next pager. Nothing is
fetched and nothing is rebuilt.

The order is a list of section keys per game, in its own store. Absent means
rules order, which is what every reader starts with; *Reset to rules order*
deletes the entry rather than writing a different one, so there is no such thing
as a stored order that means "the default". A stored key whose section is no
longer bookmarked is skipped, and a bookmark made since goes on the end.

**Why it is shaped this way.**

- **Buttons, not a drag.** A drag is the obvious affordance and the wrong one to
  build first: it is most of the work, it is the part that fails by thumb, and
  it needs a keyboard equivalent written anyway — which is a pair of buttons. A
  pointer drag can be layered onto the same rows later without touching the
  store or the mode.
- **A mode on this page, not an editable table of contents.** The sidebar list
  and the jump sheet are shared with every rulebook; giving them an edit state
  would put a page-specific intention into site-wide navigation, and on mobile
  it would mean dragging inside a dialog to reorder the page behind it.
  Collapsed to headings, this page *is* a contents list, and the thing you move
  is the thing you are arranging.
- **New bookmarks last.** The alternative is slotting a new section into the
  rules position it would have had, which is a place nobody watching the page
  would think to look. The cost is that removing a bookmark and adding it again
  sends it to the end, which is the honest reading of the rule.
- **A list per game rather than an index per bookmark.** An index on each record
  means reordering one section rewrites every record, and a bare index is
  meaningless if it arrives in an import without its siblings.

**Known wrinkles.**

- The jump lists used to be filled only when empty, which was right while the
  only late-arriving sections were on a page that started with none. A reorder
  leaves them full and wrong, so `syncJumpList` now compares what a list is
  showing against what the document says. A server-rendered list on a rulebook
  compares equal and is left exactly as the build wrote it.
- Merging an imported order takes a game whole from whichever side touched it
  last. Every other store merges sets — two devices' bookmarks are one reader's
  bookmarks — but half of one order and half of another is an arrangement
  neither reader made.
- Clearing bookmarks clears the orders with them. An order over no bookmarks is
  inert, but it would come back the moment those sections were bookmarked
  again, which is not what the button says.

**Where it goes next.** A pointer drag on the same rows. Bulk management of
bookmarks is still deferred — see `DEFERRED.md`.

---

## Sharing a reference

**Shipped.** `src/assets/js/reference-share.js`, the shared branch of
`src/assets/js/my-reference.js`.

**How it works.** *Share* on My Reference puts a link on the clipboard that
carries the sections and their order in the URL's fragment:

    /games/arcs/my-reference/#shared=rulebook~setup,faq~errata

Opening it renders those sections, in that order, under a banner saying whose
they are. Nothing is written by arriving. *Save to my bookmarks* merges them in
— what the reader already had keeps its position, and everything new lands
after it in the order the link listed — and then reloads the page as their own.

**Why it is shaped this way.**

- **In the fragment.** A fragment is never sent in the request: it reaches no
  host, log or referrer. That is what lets a site with no server share
  something, and it means a shared reference is stored nowhere and carried
  entirely by the people passing it round.
- **Slugs, never text.** The link names sections; every word the page then
  shows comes from the build. The worst a mangled link can do is name sections
  that do not exist, which are counted and dropped — it cannot put words in the
  site's mouth.
- **Readable rather than packed.** Base64 of JSON would be shorter and would
  make the link an opaque blob nobody can sanity-check before pasting it into a
  group chat. What is being shared is a list of section names, so the link says
  so.
- **Saving carries the order.** Saving the sections without the sequence throws
  away half of what was shared: somebody who arranged eight sections for their
  group arranged them for a reason.
- **Nothing is written by a navigation.** A link that quietly edited what
  somebody had saved would be the kind of surprise that makes a site
  untrustworthy, so the page shows, says, and waits to be asked.

**Known wrinkles.**

- The fragment is read at load. Pasting a share link while already on the page
  changes the fragment without reloading the document, so a `hashchange`
  listener compares the payload against the one the page was built from and
  reloads when they differ.
- A link naming sections a game no longer has says so and offers nothing to
  save. A link naming some of them shows what survives and counts the rest.
- A shared reference is read-only: the reorder tools and the per-section
  bookmark flags are hidden, because both act on the reader's own bookmarks and
  a flag beside somebody else's section is a claim about the wrong person.

**Where it goes next.** Saving one section at a time rather than all of them,
if anybody wants it. The link has no room for a title or a note from the sender
— that would be text in a URL, which is the thing this deliberately does not
carry.
