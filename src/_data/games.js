import { buildGames } from "../../lib/registry.js";

/**
 * Every game the site builds pages for.
 *
 * Hidden games are already gone by the time this returns. Unlisted ones are
 * here, because their pages and URLs are real — the shelf uses `listed`
 * instead.
 */
export default function () {
  return buildGames();
}
