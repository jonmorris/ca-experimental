import { favoriteStore } from "./favorites.js";
import { historyStore } from "./reading-history.js";

/**
 * Re-ranking "More games" against what this reader has actually read.
 *
 * The build ranks the row by the current game's credits, which is the same
 * answer for everybody. This is the second pass: a reader who has starred Root
 * and Oath has told us they like Cole Wehrle, and on a Splotter page the one
 * Wehrle game in the row should come up the list rather than sit fourth.
 *
 * It reorders; it never fetches and never replaces. Eight tiles are already on
 * the page with their credits on them, four are shown, and this decides which
 * four — so the row is complete and correct before this runs, and stays that
 * way if it never does. Same contract as the shelf's sorting: everything it
 * does is done by moving and hiding elements the build wrote.
 *
 * Nothing is filtered out. A reader who has opened most of a twenty-game shelf
 * would otherwise be left with an empty row, and re-meeting a game read months
 * ago is not obviously a failure. Whether this module is meant to send people
 * somewhere new or just sideways is the open question in `docs/DEFERRED.md`;
 * until it is answered, showing the best links is the honest default.
 */

/**
 * What the reader's own games are worth.
 *
 * A favourite is a statement and a visit is a trace, so a favourite counts for
 * more. Within either, sharing a designer beats sharing a publisher for the
 * same reason it does at build time: it is the narrower claim.
 *
 * The cap is what keeps this a second opinion rather than the whole ranking.
 * A build-time designer match scores 3 and a designer-and-publisher match 5,
 * so a bonus ceiling of 4 lets affinity lift a game past a publisher-only link
 * and past the unscored filler, but never past a game by the same designer as
 * the one being read. The page the reader is on stays the strongest signal
 * about the page the reader is on.
 */
const FAVORITE_WEIGHT = 2;
const VISIT_WEIGHT = 1;
const DESIGNER_MATCH = 2;
const PUBLISHER_MATCH = 1;
const MAX_BONUS = 4;

function readAffinity(section) {
  try {
    return JSON.parse(section.querySelector("[data-related-affinity]")?.textContent || "{}");
  } catch {
    return {};
  }
}

/**
 * The reader's games, by weight, minus the one they are looking at.
 *
 * Excluding the current game matters: starring it would otherwise credit every
 * tile in the row with an affinity it has already been scored for at build
 * time, and the ranking would lurch the moment somebody pressed the star at
 * the top of this very page.
 */
function engagedGames(currentSlug) {
  const weights = new Map();
  for (const entry of historyStore.list()) weights.set(entry.gameSlug, VISIT_WEIGHT);
  for (const entry of favoriteStore.list()) weights.set(entry.gameSlug, FAVORITE_WEIGHT);
  weights.delete(currentSlug);
  return weights;
}

const slugsOf = (value) => String(value || "").split(" ").filter(Boolean);

/** How much this reader's own shelf argues for one candidate. */
function affinityBonus(tile, engaged, affinity) {
  const designers = new Set(slugsOf(tile.dataset.designers));
  const publishers = new Set(slugsOf(tile.dataset.publishers));

  let bonus = 0;
  for (const [slug, weight] of engaged) {
    const credits = affinity[slug];
    if (!credits) continue;
    const sharesDesigner = credits.designers?.some((designer) => designers.has(designer));
    const sharesPublisher = credits.publishers?.some((publisher) => publishers.has(publisher));
    if (sharesDesigner) bonus += weight * DESIGNER_MATCH;
    else if (sharesPublisher) bonus += weight * PUBLISHER_MATCH;
  }
  return Math.min(bonus, MAX_BONUS);
}

export function initRelatedGames() {
  const section = document.querySelector("[data-related-games]");
  const list = section?.querySelector("[data-related-list]");
  if (!section || !list) return;

  const tiles = [...list.querySelectorAll("[data-game-slug]")];
  if (!tiles.length) return;

  const currentSlug = document.body.dataset.game || "";
  const affinity = readAffinity(section);
  // However many the build chose to show, which is however many start visible.
  const shown = tiles.filter((tile) => !tile.hidden).length;

  function render() {
    const engaged = engagedGames(currentSlug);

    const ranked = tiles
      .map((tile) => ({
        tile,
        order: Number(tile.dataset.order) || 0,
        total: (Number(tile.dataset.score) || 0) + affinityBonus(tile, engaged, affinity),
      }))
      // The build's order breaks every tie, so a reader with nothing stored
      // sees exactly what the page was written with.
      .sort((a, b) => b.total - a.total || a.order - b.order);

    ranked.forEach(({ tile }, index) => {
      tile.hidden = index >= shown;
    });
    list.replaceChildren(...ranked.map(({ tile }) => tile));
  }

  render();
  favoriteStore.subscribe(render);
  historyStore.subscribe(render);
}
