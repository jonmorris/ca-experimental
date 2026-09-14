import { historyStore, MAX_GAMES } from "./reading-history.js";
import { withBasePath } from "./base-path.js";
import { favoriteStore } from "./favorites.js";
import { favoriteSlugs } from "./favorites-ui.js";
import { collapseToRow } from "./row-collapse.js";

/**
 * "Recently opened" on the home page.
 *
 * The row is server-rendered but ships `hidden`, and is only revealed once
 * there is something to put in it — a first-time reader should not meet an
 * empty shelf above the games.
 *
 * Tiles are the same `game-tile` the grid below uses, and the box art is
 * borrowed from that grid rather than re-derived: the art there has already
 * been through the image transform, with its srcset and dimensions, and a
 * second source of truth for it would be a second thing to get wrong. A game
 * with no tile to borrow from — one that is unlisted, reachable only by its
 * URL — still gets a row; it simply gets one without a picture.
 *
 * A cover and a name, and nothing else. The card used to carry the document
 * and section it was last left at, which answered a question nobody had asked
 * it: this row is for getting back to a game, and where inside the game the
 * reader stopped is a different errand with its own places to be served from.
 * The store still records it — the line is gone, not the history.
 */

/*
 * How many the row has to offer. What it *shows* is a line of whatever fits
 * across, with the rest behind the last card — see `row-collapse.js` — so the
 * cap here is the store's own: the point past which a game is old enough that
 * nobody is coming back to it from this row.
 */

function borrowArt(gameSlug) {
  const tile = document.querySelector(`[data-game-slug="${CSS.escape(gameSlug)}"] .game-tile__art`);
  return tile ? tile.cloneNode(true) : null;
}

function buildTile(entry) {
  const item = document.createElement("li");
  item.className = "game-tile";

  const art = borrowArt(entry.gameSlug);
  if (art) {
    const link = document.createElement("a");
    link.className = "game-tile__link";
    link.href = withBasePath(entry.gameUrl);
    link.setAttribute("tabindex", "-1");
    link.setAttribute("aria-hidden", "true");
    link.append(art);
    item.append(link);
  }

  const body = document.createElement("div");
  body.className = "game-tile__body";

  const title = document.createElement("h3");
  title.className = "game-tile__title";
  const titleLink = document.createElement("a");
  titleLink.href = withBasePath(entry.gameUrl);
  titleLink.textContent = entry.gameTitle;
  title.append(titleLink);
  body.append(title);

  item.append(body);
  return item;
}

export function initRecentGames() {
  const section = document.querySelector("[data-recent-games]");
  const list = section?.querySelector("[data-recent-list]");
  if (!section || !list) return;

  let recollapse = null;

  function render() {
    /*
     * A starred game is already on the shelf above this one. Showing it twice
     * would make the two rows read as one long list rather than as two
     * different answers.
     */
    const starred = favoriteSlugs();
    const entries = historyStore
      .list()
      .filter((entry) => !starred.has(entry.gameSlug))
      .slice(0, MAX_GAMES);

    list.replaceChildren(...entries.map(buildTile));
    section.hidden = entries.length === 0;
    // One row, with the rest behind the last card. See `row-collapse.js`.
    recollapse ? recollapse() : (recollapse = collapseToRow(list, { label: "See all recent" }));
  }

  render();
  historyStore.subscribe(render);
  favoriteStore.subscribe(render);
}
