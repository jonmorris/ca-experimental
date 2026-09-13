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
