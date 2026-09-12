import { historyStore } from "./reading-history.js";
import { withBasePath } from "./base-path.js";
import { favoriteStore } from "./favorites.js";
import { favoriteSlugs } from "./favorites-ui.js";

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
 */

/** How many to show. The store keeps more than this, for a fuller history later. */
const SHOWN = 4;

function borrowArt(gameSlug) {
  const tile = document.querySelector(`[data-game-slug="${CSS.escape(gameSlug)}"] .game-tile__art`);
  return tile ? tile.cloneNode(true) : null;
}

/** "The Blighted Reach · Rulebook · Setup" — as much of it as there is. */
function placeLabel(doc) {
  return [doc.expansionTitle, doc.ruleTitle, doc.sectionTitle].filter(Boolean).join(" · ");
}

function placeHref(doc) {
  const url = withBasePath(doc.url);
  return doc.sectionAnchor ? `${url}#${doc.sectionAnchor}` : url;
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

  /*
   * Two targets, and both are predictable: the name goes to the game, the line
   * under it goes back to the exact place. Sending the whole tile to a spot
   * halfway down a rulebook would surprise anyone who clicked it expecting the
   * game.
   */
  const doc = entry.lastDocument;
  if (doc?.url) {
    const place = document.createElement("p");
    place.className = "game-tile__place";
    const placeLink = document.createElement("a");
    placeLink.href = placeHref(doc);
    placeLink.textContent = placeLabel(doc);
    place.append(placeLink);
    body.append(place);
  }

  item.append(body);
  return item;
}

export function initRecentGames() {
  const section = document.querySelector("[data-recent-games]");
  const list = section?.querySelector("[data-recent-list]");
  if (!section || !list) return;

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
      .slice(0, SHOWN);

    list.replaceChildren(...entries.map(buildTile));
    section.hidden = entries.length === 0;
  }

  render();
  historyStore.subscribe(render);
  favoriteStore.subscribe(render);
}
