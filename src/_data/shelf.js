import { buildGames, listedGames } from "../../lib/registry.js";
import { shelfBounds } from "../../lib/shelf.js";

/*
 * The bounds of the shelf's sliders.
 *
 * Only a default export. Eleventy reads an ESM data file's named exports when
 * it finds any and ignores the default one, so a helper exported from here
 * would quietly replace the whole file's data — which is why the parsing lives
 * in `lib/shelf.js` instead.
 */
export default function () {
  return shelfBounds(Object.values(listedGames(buildGames())));
}
