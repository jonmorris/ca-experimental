import { buildGames, listedGames } from "../../lib/registry.js";

/**
 * The games the shelf shows.
 *
 * An unlisted game is reachable by URL and turns up in search; it is simply
 * not advertised on a page that enumerates the collection. Anything that
 * enumerates games browses this, not `games`.
 */
export default function () {
  return listedGames(buildGames());
}
