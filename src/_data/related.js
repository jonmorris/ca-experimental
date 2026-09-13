import { buildGames, listedGames } from "../../lib/registry.js";
import { relatedIndex } from "../../lib/related.js";

/**
 * The games offered at the bottom of every game's overview, worked out once at
 * build time.
 *
 * Both halves of what the page needs: `games` is the ranked row itself, keyed
 * by the slug whose page it belongs on, and `affinity` is the credits of every
 * game on the site, which the browser reads to re-rank that row against what
 * this reader has favourited and opened.
 *
 * Only a default export — Eleventy reads an ESM data file's named exports when
 * it finds any and ignores the default, so the scoring lives in `lib/related.js`
 * rather than being exported from here.
 */
export default function () {
  const games = buildGames();
  return relatedIndex(Object.values(games), Object.values(listedGames(games)));
}
