/**
 * Which other games sit at the bottom of a game's overview page.
 *
 * The signal is credits — designer, then publisher — and nothing else. Board
 * games cluster by house far more reliably than by mechanism, and a reader who
 * has just finished a Splotter rulebook is usually well served by another
 * Splotter game. `tags` exist in `game.json` and are deliberately not read
 * here: they cover six of twenty games, so a tag-weighted score would be a
 * different ranking for a quarter of the shelf and no ranking at all for the
 * rest. See `docs/DECISIONS.md` for what this is and `docs/DEFERRED.md` for
 * what a real taxonomy would let it become.
 *
 * The list is never short. Once the credits run out the remaining games fill
 * in at zero, so a game with no shared anybody — Xia, on this shelf — still
 * offers a way onwards. Those carry no reason line: the row says what it can
 * prove and stays quiet about the rest, rather than inventing a connection.
 */

import { slugify } from "./slugify.js";

/**
 * How a credit outranks another.
 *
 * A designer is worth more than a publisher because it is the narrower claim:
 * every Splotter game shares a publisher, and most of them share the same two
 * designers, so publisher alone is the weaker half of an already-strong link.
 * A game matching both scores the sum, which is what puts Arcs above Pax Pamir
 * on Root's page.
 */
export const DESIGNER_WEIGHT = 3;
export const PUBLISHER_WEIGHT = 2;

/**
 * How many are rendered, and how many are rendered to choose from.
 *
 * Four are shown — the same count as the home page's recent row, and as many
 * as fit across a laptop without becoming a second shelf. Eight are written
 * into the page and the surplus ships `hidden`, because the browser re-ranks
 * this list against what the reader has favourited and opened, and a re-rank
 * that can only reorder what is already visible cannot surface anything.
 */
export const SHOWN = 4;
export const POOL = 8;

/**
 * "Jeroen Doumen and Joris Wiersinga" → two people.
 *
 * Credits are authored for a reader, so they arrive as a sentence rather than
 * as a list, and they have to be split before two games can be compared. The
 * separators are the comma, the semicolon and the word "and" — not `&` and not
 * a slash, both of which turn up inside single publisher names ("Hans im Glück
 * & Co") and would cut one house into two.
 *
 * The display string is untouched; this travels beside it. Nothing renders
 * these, and `game.json` never sees them.
 */
export function parseCredits(value) {
  const seen = new Set();
  const out = [];
  for (const part of String(value ?? "").split(/\s*[,;]\s*|\s+and\s+/i)) {
    const label = part.trim();
    const slug = slugify(label);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    out.push({ slug, label });
  }
  return out;
}

/** The slugs two credit lists have in common. */
function shared(a, b) {
  const other = new Set(b.map((credit) => credit.slug));
  return a.filter((credit) => other.has(credit.slug));
}

/** "Doumen", "Doumen and Wiersinga", "Eklund, Grey and two others". */
function joinNames(credits) {
  const names = credits.map((credit) => credit.label);
  if (names.length <= 1) return names[0] || "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  const rest = names.length - 2;
  return `${names[0]}, ${names[1]} and ${rest} other${rest === 1 ? "" : "s"}`;
}

/**
 * A stable, uneven order for games that share nothing.
 *
 * The filler has to be ordered somehow, and every obvious answer is a bias:
 * alphabetical puts Antiquity and Arcs on fourteen pages, newest-first puts
 * Arcs on all of them. Hashing the pair of slugs gives each page its own
 * arbitrary order that is nonetheless the same on every build — which is what
 * `verify:links` and a readable diff both need. It is not randomness; it is a
 * shuffle the build can repeat.
 */
function pairOrder(fromSlug, toSlug) {
  let hash = 0x811c9dc5;
  for (const char of `${fromSlug}:${toSlug}`) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/** One candidate, scored against the game whose page it will appear on. */
function scoreAgainst(game, candidate) {
  const designers = shared(game.meta.designers, candidate.meta.designers);
  const publishers = shared(game.meta.publishers, candidate.meta.publishers);
  const score = designers.length * DESIGNER_WEIGHT + publishers.length * PUBLISHER_WEIGHT;

  /*
   * One reason, not a list of every link. The designer is the stronger claim
   * and says the publisher's part implicitly — "Also by Cole Wehrle" beside a
   * Leder game is not improved by adding that it is also from Leder.
   */
  let reason = "";
  if (designers.length) reason = `Also by ${joinNames(designers)}`;
  else if (publishers.length) reason = `Also from ${joinNames(publishers)}`;

  return {
    slug: candidate.slug,
    title: candidate.title,
    url: candidate.url,
    boxArt: candidate.meta.box_art || "",
    designer: candidate.meta.designer || "",
    year: candidate.meta.year_published || "",
    designers: candidate.meta.designers.map((credit) => credit.slug),
    publishers: candidate.meta.publishers.map((credit) => credit.slug),
    score,
    reason,
  };
}

/** The games to offer beneath one game, best link first. */
export function relatedTo(game, candidates) {
  return candidates
    .filter((candidate) => candidate.slug !== game.slug)
    .map((candidate) => scoreAgainst(game, candidate))
    .sort(
      (a, b) =>
        b.score - a.score || pairOrder(game.slug, a.slug) - pairOrder(game.slug, b.slug),
    )
    .slice(0, POOL);
}

/**
 * Everything the row needs, for every game that has a page.
 *
 * `games` is every built game, because an unlisted one still has an overview
 * and still deserves a way onwards. `candidates` is the listed games only —
 * unlisted means unadvertised, and this row advertises.
 *
 * `affinity` is the second half, and it is for the browser rather than for the
 * template: re-ranking this list against the reader's favourites and history
 * means knowing who made the games *they* have, which are not the games on
 * this page. It is credits keyed by slug and nothing else — twenty short
 * entries, no URLs, so there is no deploy prefix for it to lose.
 */
export function relatedIndex(games, candidates) {
  const byGame = {};
  const affinity = {};

  for (const game of games) {
    byGame[game.slug] = relatedTo(game, candidates);
    affinity[game.slug] = {
      designers: game.meta.designers.map((credit) => credit.slug),
      publishers: game.meta.publishers.map((credit) => credit.slug),
    };
  }

  return { games: byGame, affinity, shown: SHOWN };
}
