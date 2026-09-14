import { buildGames, listedGames } from "../../lib/registry.js";
import { shelfBounds, shelfPublishers } from "../../lib/shelf.js";

/*
 * What the shelf's controls are made of: the bounds of its sliders, and the
 * publishers it can be narrowed to.
 *
 * Only a default export. Eleventy reads an ESM data file's named exports when
 * it finds any and ignores the default one, so a helper exported from here
 * would quietly replace the whole file's data — which is why the parsing lives
 * in `lib/shelf.js` instead.
 */
export default function () {
  const games = Object.values(listedGames(buildGames()));
  return { ...shelfBounds(games), publishers: shelfPublishers(games) };
}
