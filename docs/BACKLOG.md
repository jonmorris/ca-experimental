# Backlog

Work we intend to do, in no particular order, none of it scheduled.

This is the complement to `DEFERRED.md`. That file records what we have decided
**not** to build and why, and nothing in it is a TODO. This one is the opposite:
everything here is a TODO that has not been picked up yet. An item leaves this
file by being done — and if it turns out to be something we have decided against
after all, it moves to `DEFERRED.md` with the reason rather than being deleted.

Each entry says what the job is and what is already known about it, so it can be
picked up cold rather than re-scoped from scratch.

---

## Review all of the typography

A pass over every face, size, weight and measure on the site, together rather
than one control at a time.

The faces have just changed and nothing has been re-checked against them:
Literata for the rules, Atkinson Hyperlegible Next for the sans reading mode,
Public Sans for headings and the interface. Specific things known to be worth a
look:

- `--scale: 0.97` on the editorial theme is commented as an adjustment for
  Literata running large. Atkinson has a generous x-height too and may want its
  own correction rather than sharing that one.
- `--display-tracking: -0.014em` and the weight corrections were fitted to Libre
  Franklin. Public Sans is its descendant so they carried over untouched, which
  is a reason to believe them but not a reason to have checked them.
- The precision theme is still IBM Plex throughout and has not been revisited.
- The small end of the scale — `--text-2xs` at 11px — now carries the footer's
  legal block, the download sizes, the card meta and the jump-list numbers.
  Whether it is one size doing four jobs or one size too many is the question.

---

## Full accessibility audit

Against the floor in `CONVENTIONS.md` §7, end to end, rather than per feature.

Known places to start:

- **Icon-only controls.** The heading tools, the print button, the header's
  icon buttons and the footer's social links are all icon-only with an
  `aria-label` and no visible text. That is a deliberate choice; it should be
  checked against a screen reader rather than assumed.
- **Colour contrast at the small sizes**, particularly `--ink-faint` on
  `--surface-sunken`, which is the footer's legal block and several meta lines.
  The token comments carry measured ratios; they were measured against the old
  faces and the old sizes.
- **The overlays.** Palette, bookmarks drawer, preferences and the jump sheet
  are `<dialog>` elements, so focus trapping and Escape come from the browser —
  worth confirming the browser is actually giving us all of it, including on
  iOS.
- **Keyboard reachability of everything that appears on scroll**: the sticky
  section bar, the pinned pager, the sidebar's current-section marker.
- Reduced motion, forced colours, and 200% zoom are each their own pass.

---

## Code review and clean-up

A lot has shipped quickly. A read-through with no feature in hand.

Debris already known about:

- **`src/viewport-probe.njk`, `src/assets/js/debug-probe.js`, `.debug-probe` in
  `components.css`, and the `viewport probe` line in `URL_PATTERNS`** are all
  temporary, and all currently live. They come out with the iOS item below.
- **`padding-bottom: env(safe-area-inset-bottom)` on `.prev-next` is dead code.**
  The viewport meta has no `viewport-fit=cover`, so iOS reports zero. Either add
  it — which means auditing every page gutter for the side insets in landscape —
  or drop the declaration.
- **`.prev-next::after`** paints a strip below the pinned pager whose usefulness
  was never confirmed. Same item.
- The `hidden`/`[hidden]` interaction with `+` sibling selectors, the CSS load
  order between `components.css` and `content.css`, and the Eleventy data-file
  named-export trap have each bitten more than once. Worth a note in
  `CONVENTIONS.md` if they are not there already.

---

## The pinned pager on iOS

Unresolved, with temporary diagnostic code on the live site because of it.

On a phone the pager sits above the bottom of the screen once the browser's
toolbar collapses, with page showing through underneath it. Two fixes have been
tried and reverted: painting past the bar's own edge, and shifting it by a
`visualViewport` measurement — the second took the bar off the screen entirely
in Chrome on iOS.

What is known: on `/viewport-probe/`, a plain `position: fixed; bottom: 0` lands
on the edge correctly, and so does a bottom edge pinned to `100dvh`. So the
difference is something on our side, and reading the stylesheet has not found
it. `?probe` on any content page reports where the bar actually is, including
its `offsetParent`, which says whether an ancestor has become its containing
block.

Finish this and the probe pages come out with it.

---

## Set up the social accounts

Discord, Instagram and Patreon.

The footer is already built for them: `src/_data/site.json` carries a `social`
array with the three networks and an empty `url` each, and the template renders
a link only where there is a URL — so the row stays hidden until the accounts
exist and appears the moment they do. Nothing to build; the work is off the
site.

---

## Photograph the games

Cover art and component shots for as many games as possible.

Box art currently comes from upstream and is resized at build time by
`@11ty/eleventy-img`; originals live in `src/games/{slug}/images/`. Own
photography would replace those and give the shelf a consistent treatment rather
than whatever resolution and crop each publisher happens to publish.

This one is not a code task.

---

## Review the state of every game's content

An audit of what is actually in `src/games/`, game by game, written down.

Several rulebooks were imported and have not been edited since. Some of the
formatting did not survive the import — headings, tables, emphasis, and lists
that should be tables. Nothing records which of them are finished, which are
readable but rough, and which are raw.

**Read this before editing any of it:** `npm run sync` rebuilds
`src/games/` from upstream and overwrites what it finds, so a correction made by
hand in a synced markdown file is lost on the next sync. Fixes belong upstream,
or in the override tables in `scripts/sync-content.mjs` — which is also where
the existing per-game corrections are recorded, with a note on each saying why.
`LOCAL_ONLY` is the list of files the sync will not touch.

The output of this item is a status per game, which is itself the thing that
does not exist yet.

---

## Not here: accounts

Accounts and server-synced bookmarks are in `DEFERRED.md`, twice — once for the
mechanism (*Accounts and server-synced bookmarks*, which describes what present
code already does to keep the door open) and once for the product question
(*Accounts, and what a paid one is for*). Neither is scheduled, so neither
belongs in this file; both are worth reading before anything here touches
storage.
