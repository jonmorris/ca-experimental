# Working on this project

## Never judge the site by its current content

The games and documents in `src/games/` are an early slice of a growing
library, not the finished shape of the site. Do not reason about how much
content there is, count it, work out ratios between kinds of it, or use any of
that to argue about a design decision — not in a recommendation, not as a
caveat, not as an aside after doing the work.

Concretely, none of these are ever a reason to question a design:

- how many games there are, or how few
- how many documents are official versus written for the site
- that some feature would apply to most or all of the library today
- that a label, badge or section would "appear on nearly every page"

Build what was asked for, scaled to a library many times this size. If a
decision genuinely depends on content volume, assume it will grow and say
nothing about today's count.

## Design conventions

`docs/CONVENTIONS.md` is the authority on the content model, URL contract,
design tokens and engineering principles. `docs/DEFERRED.md` records what is
deliberately not built and why — nothing in it is a TODO.
