# Deferred features

Deliberately not built. Each entry records what it is, why it is out of scope
for now, and what the current code already does so that building it later is an
addition rather than a rewrite.

Nothing here is a TODO. Do not build any of it without a decision to.

An entry marked **Partly built** is one where some of it shipped and the rest
was held back. What shipped, and why it is shaped the way it is, is in
`DECISIONS.md`; what is still deferred stays here.

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

That is the mechanism. What an account would be *for*, and which side of the
free line each thing falls on, is **Accounts, and what a paid one is for**
below.

---

## Cross-game similarity and recommendations

**Partly built.** A credits-based version shipped: "More games" at the foot of
every game's overview, ranked by shared designer and publisher and re-ranked in
the browser against the reader's favourites and history. How it works and why
is in `docs/DECISIONS.md`. What follows is the rest of it.

### A tagging vocabulary that covers the shelf

Tags exist in `game.json` and the related-games row deliberately does not read
them: they are on six games of twenty, so a tag-weighted score would be a
different ranking for a quarter of the shelf and no ranking at all for the
rest. Filtering the shelf by mechanism is blocked on the same thing — most tags
are on exactly one game, so the control would be twenty checkboxes that each
hide nineteen games.

**Why deferred:** the vocabulary is the work, not the wiring. Tagging twenty
heavy games well means deciding what the axes are — mechanism, structure,
interaction, theme — and whether "economic" and "heavy euro" are the same claim
said twice, which is a question about this catalogue rather than about board
games in general. Done badly it is worse than nothing: a similarity score built
on inconsistent tags is confidently wrong, and unlike a missing feature nothing
on the page says so.

**What already helps:** the registry normalises and deduplicates tags into
`{ slug, label }` on every game record, so the shape is settled and tags can be
authored at any time. `parseCredits` in `lib/related.js` shows the pattern a
second signal would follow — scored into the same total, with its own weight
beside `DESIGNER_WEIGHT` and `PUBLISHER_WEIGHT`. Adding tags to the ranking is
one term in one function.

### Recommending across houses rather than within one

Today a Splotter page recommends Splotter, which is right at twenty games and
increasingly dull at eighty. The interesting version reaches sideways: *you
like heavy economic games with brutal opening decisions, here is one by
somebody else entirely.* That needs the vocabulary above and enough games for
two houses to overlap in it.

### Bookmarks as a third affinity signal

The browser pass reads favourites and history. Bookmarks are the strongest
statement of the three — a reader who saved nine sections of one rulebook is
telling us more than one who opened it — and they are not read at all.

**Why deferred:** a bookmark is per-section, so "how much do you care about
this game" means counting records per `gameSlug` and deciding what a count is
worth against a star. That is a weighting question with no obvious answer and
nothing to test it against yet.

**What already helps:** every bookmark record already carries `gameSlug`, so
the grouping needs no storage change — `bookmark-store.js` would be a third
import in `related-games.js` and a third weight beside the two there.

### What the row is actually for

The open question, and the one that decides the rest. Nothing is filtered out
of the row today: a reader who has already read all four games it offers sees
them anyway. That is a deliberate holding position, not an answer — on a
twenty-game shelf, hiding what somebody has seen would empty the row for
exactly the readers who use the site most.

There are two different modules hiding under one heading:

- **A way sideways.** Show the best-connected games whatever the reader has
  done. Good for browsing, honest about what it knows, and useless as
  discovery once somebody has read most of the shelf.
- **A way onward.** Show the best-connected games they have *not* seen. Real
  discovery, but it needs a catalogue deep enough that the answer is not empty,
  and it needs deciding what "seen" means — opened once, or read.

**Revisit when** the shelf is deep enough that a reader can plausibly have seen
everything the row would offer, which is the point at which the question
answers itself.

**Worth settling at the same time:** a second edition currently ranks as a
recommendation for its own first edition. It is useful information and it is
not the same thing as "another game you might like", and no signal in the
scoring can tell the difference.

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

---

## Managing bookmarks in bulk

**Partly built.** Reordering My Reference shipped — see `DECISIONS.md`. It was
held here for three reasons and two of them turned out to be the same one: the
drag affordance and its keyboard equivalent are both answered by a pair of
buttons on each row, which work by thumb on the first try, and the place to
persist it was already described in this entry. A pointer drag is still not
built and is additive when it is.

What is left is a place to clear out bookmarks a game at a time.

Bulk removal is the same story from the other side: removing one bookmark is a
tap, and there is now an undo on it. Whether anyone ever removes enough of them
at once to want a management page is a thing to find out rather than to assume.

**What already helps:** the page does not group by document — each section
carries its own source label as an eyebrow instead. That was chosen partly
because grouping and ordering are the same decision, and a page whose sections
are individually self-describing can be put in any order without anything
becoming ambiguous. That is what let the ordering half ship as an array of
section keys in a store with nothing else moving, and it is the same reason a
bulk-removal surface can list sections in any grouping it likes.

Also worth testing before either is built: whether removing a bookmark wants a
confirmation step in general, not only on this page. Adding one should stay a
single tap; removing one perhaps should not be — but not so guarded that it
becomes a chore.

---

## Splitting Your data out of the Reading panel

Two panels instead of one: reading settings on their own, and a data panel
that opens on a summary of everything the site is holding — how many
bookmarks, how many favourites, how many games of history, how much space —
with a clear for each type beside its own count, and the download and restore
that today sit under all four.

**Why deferred:** neither half is big enough yet to need the room. There are
four reading settings and five stores, and one panel with a rule across it
holds both without anyone having to scroll to find anything. Splitting now
would mean a second entry point in a header that carries four controls and is
deliberately thin.

It was built once and taken back out: its own `<dialog>`, a person-shaped
control in the header, a row in the menu for the widths with no room for the
icon, and the summary of counts described above. Nothing about it was broken.
It was simply two panels' worth of entry points for one panel's worth of
content, and the thin header paid for it — so the whole of it came out again
and the section went back under the rule in Reading. The reasoning above is
unchanged; what is new is that it has now been measured against the built
thing rather than guessed at.

The reason to expect it anyway is that both halves grow. More stores are
likely — highlights, notes, a per-game reading position, whatever a reader
ends up making — and each one adds a count to read and a thing to clear, which
is a list wanting a page rather than three more buttons in a corner. On the
other side, settings that are not about reading (a default theme, whether to
count a visit as history at all, what the home page opens on) have nowhere to
go today except a panel titled Reading, where they do not belong.

**What already helps:**

- Every store has the same surface — `list`, `clear`, `snapshot`, `merge`,
  `subscribe` — so a summary is a loop over a list of stores, not a special
  case per type. A count is `store.list().length` and a clear is `store.clear()`
  for every one of them.
- `data-transfer.js` already speaks in whole payloads rather than in panels:
  `buildExport` and `applyImport` know nothing about where they are called
  from, so moving the two buttons is moving two event listeners.
- The export envelope is keyed by store name (`bookmarks`, `favorites`,
  `history`, `searches`, `referenceOrder`, `preferences`), so a new store is a
  new key and an
  older file missing that key already imports cleanly — which is what lets the
  data panel grow a row at a time.
- `overlays.njk` already renders each panel as its own `<dialog>` wired by
  `overlay.js`, and the palette and the Reading panel now share one floating
  shell and one `.overlay-scroll` region. A third panel is markup plus a
  trigger, with no layout to invent.
- The "Your data" section is already ruled off under its own heading with its
  own note, so the split is a move of a block that exists, not a rewrite of
  copy.

**Worth settling when it is built:** whether the data panel is a panel at all
or a page — a summary with per-type counts, sizes and a clear each is closer
to a settings page than to a sheet, and it would have somewhere to explain the
storage limits that the note currently has to compress into three sentences.

---

## Localization

The rules in more than one language, and a site that speaks whichever the
reader does.

**Why deferred:** the hard part is not the plumbing. Eleventy ships
`EleventyI18nPlugin` (exported from `@11ty/eleventy`, no install needed): it
takes a directory-per-language URL structure, gives templates `locale_url` and
`locale_links` for switching between versions of the same page, and falls back
to a default language for anything not yet translated. That is a day's work.
The translating is the project, and there are three separate problems in it.

**Rights.** Rules text here is reproduced by permission, and the footer says as
much. A translation is a derivative work: permission to reproduce a rulebook is
not automatically permission to translate it, and a publisher who has licensed
or sold foreign-language editions has usually given those rights to someone
else entirely. So this starts with asking, one publisher at a time, and the
answer may be no for exactly the games that most need it.

**Official translations usually already exist**, and they are better than
anything this project would produce: a German or French edition of a game has
had its terms settled by people who know both the language and the game, and a
reader looking up a rule needs the words printed on their own cards. Finding
and getting permission for those is a smaller job than translating, and the
result is more correct. It is also a different pipeline — sourcing a second
rulebook per language rather than transforming the one we have.

**Machine translation is the wrong first tool here** even where it is allowed.
Rules text is dense with terms of art that are also ordinary words — a suit, a
turn, a trick, a hand, initiative, a slot — and every one of them has a precise
meaning in one game and a different one in the next. A translation that is
fluent and subtly wrong about which noun is a game term is worse than none,
because nothing on the page tells the reader it happened. If it is ever used it
belongs as a first pass for a human who knows the game, not as the published
text.

**What already helps:**

- **URLs are built from one place.** `lib/registry.js` composes every page URL,
  and `withBasePath` is the only thing that rewrites them. A language segment
  would go in alongside the deployment prefix rather than being threaded
  through templates.
- **Content is files on disk**, one markdown document per content type, already
  keyed by game and expansion in the registry. A translation is another file
  beside the original, not a new content model.
- **Anchors are slugs of headings**, which means a translated document produces
  different anchors — and bookmarks are stored against anchors. Whatever this
  becomes, `anchorAliases` is the existing mechanism for "this section is also
  known as", and the bookmark record already carries enough to be re-homed.
- **Pagefind indexes by language**, reading the `lang` attribute of each page
  and building a separate index per language, so search does not need solving
  separately — the pages just have to declare what they are.
- **UI strings are not extracted.** They are written into the templates and a
  few JS modules (`"All games"`, `"Searching {game}"`, `"2 sections"`, the
  empty states). That is the one piece of present code that a language switch
  would force a change to, and it is worth knowing before starting: the count
  is small, under a hundred, but they are everywhere.

**Worth settling first:** whether a language is a property of a game (this
rulebook exists in German) or of the site (this reader wants German). They lead
to different URL shapes and different fallbacks, and the honest answer for a
long time will be that most games have one language and a few have several.

---

## Accounts, and what a paid one is for

The product question underneath the sync entry above: if there is ever a paid
account, what is being sold.

**The shape, as currently intended.** The whole site works without an account,
and keeps working without one. Free means the browser keeps what it keeps, and
the reader has complete control of it — download a copy, restore from a file,
clear any store on its own. Paid means a login, and the data is simply always
there, on whatever device is in hand. The fee is for not having to think about
it.

So what is sold is durability and portability. Not the rules, not access to a
feature that makes the site usable, and never the reader's own data — a
subscription that holds bookmarks hostage would be breaking the promise the
export button already makes.

**Why deferred:** no backend, no accounts, and none of this is decidable before
there is something to charge for. It is written down because it constrains what
gets built between now and then, not because any of it is scheduled.

**There is now a page of it**, at `/accounts/` — free beside paid, as two
cards, with the promises below them. It is unlinked and unindexed: a pricing
page for something nobody can buy is a broken promise if a reader finds it by
accident, so it is reachable only by its URL until there is something behind
it. Written before the payment machinery on purpose, because a tier list
written afterwards is a rationalisation of whatever turned out to be easy to
gate. The price on it — $25 a year, or $3 a month — is a placeholder in that
page's frontmatter, not a decision.

**The constraint it puts on everything built before it.** Anything gated has to
degrade without destroying. A reader who stops paying keeps every bookmark,
highlight and ordering they made; the feature stops, the data does not. Which
means a premium feature cannot invent a record shape only the paid client can
read — the free client has to be able to hand it back in the export file, even
if it can no longer do anything with it.

**Candidates named so far**, both of which already have entries here:

- **Text-highlight annotations** — see that entry for why the anchoring problem
  is the hard part, and note that it is hard whether or not anyone pays.
- **Reordering My Reference** — now built, and free. Whether it stays free is
  a question for when there is a complete set of features to weigh, not for
  the commit that shipped it.

Both are additive to a reading experience that is complete without them, which
is the right shape for this. A gate on something the site needs in order to be
worth using would be a different product.

**What already helps:**

- **The free tier is built.** Download a copy and Restore from a file are in
  the Reading panel, alongside a clear for each store and one for everything.
  Every store — bookmarks, favourites, history, searches — is a versioned,
  record-shaped payload behind one interface, which is both what an export
  writes and what an API would `POST`.
- **The sales pitch is already on the page, and it is true.** The Reading
  panel's note says the data is kept in this browser only, goes when browsing
  data is cleared, and is deleted by Safari after about a week without a visit.
  A paid tier would be fixing exactly that, which means it is selling a real
  remedy rather than a manufactured worry. The note should not be softened to
  make the upgrade look better; it is the honest version that makes the
  upgrade defensible.

---

## Funding, and the rule against ads

How this gets paid for, other than subscriptions.

**No advertising.** Not a banner, not an interstitial, not a sponsored row in
the shelf, not a native unit dressed up as a game tile. This is a constraint
rather than a preference: a page of rules is read at a table, mid-game, by
someone looking for one specific sentence, and anything competing for that
attention is working against the only thing the site is for. Treat a proposal
that "is not really an ad" as an ad.

**What is allowed instead.** Four ideas, and they share a property worth
naming: someone pays directly, and what they get is a link somewhere it makes
sense. Nothing is auctioned, nothing is served by a third party, nothing
follows the reader.

1. **A sponsor page.** One curated page. A brand pays directly and their links
   live there and nowhere else.
2. **Retail links on game pages.** An online retailer sponsors the site and in
   exchange their product page is linked from the games they carry.
3. **Publisher links.** The same, pointing at the publisher's own sales page.
4. **Affiliate links**, paid per purchase rather than per placement.

**Why deferred:** all four are deals before they are code, and none of the code
is interesting. The sponsor page is a page. The links are data.

**What needs settling before the first one ships**, because it is a design
decision and not a commercial one:

- **Whether a game page can carry a buy link at all without becoming a
  storefront.** (1) is far from the rules; (2), (3) and (4) are on the page
  somebody came to read. That is the whole question, and it is worth answering
  once, for all three, rather than per deal.
- **Whether a paid link looks different from an unpaid one.** If the BGG link
  and a sponsored retail link sit in the same list looking identical, the page
  has quietly started recommending things. Disclosure is not only a legal
  formality here; it is what keeps the rest of the page trustworthy.
- **What happens when a publisher is both.** The footer says rules text appears
  with its publisher's permission. A publisher who is also paying is a
  different relationship from a publisher who has given permission, and the
  reader cannot tell them apart from the outside. Worth thinking through before
  the first conversation rather than after.

**What already helps:**

- **Outbound links are handled in one place.** `lib/external-links.js` marks
  every link that leaves the site `target="_blank"` and *merges* into any
  existing `rel` rather than replacing it — so an authored `rel="sponsored"`
  survives the transform untouched.
- **…but the same transform adds `noreferrer`**, which strips the `Referer`
  header, and some affiliate programmes attribute by referrer. Anything paid
  per click or per purchase has to be checked against that before it is
  trusted. The fix is an exception in one function; the trap is that it fails
  silently — the link works, the money does not arrive.
- **A link is data, not markup.** `game.json` already carries `external_links`
  as `{label, url}` and the `downloads` array takes an external entry in the
  same shape. A retail or publisher link is an entry in a file, and the
  publisher name and `bgg_id` are already there beside it.
- **There is no analytics and no error reporting on this site.** Sponsorship
  and affiliate arrangements normally come with an expectation of numbers, and
  there is currently nothing that could produce them. That is a cost of these
  ideas rather than a blocker, and it is better known before promising anyone a
  monthly report than after — particularly given how much of the site's design
  rests on collecting nothing.
