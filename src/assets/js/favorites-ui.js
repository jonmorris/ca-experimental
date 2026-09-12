import { favoriteStore } from "./favorites.js";
import { withBasePath } from "./base-path.js";

/**
 * Everywhere a favourite is made or shown.
 *
 * Three surfaces, one store:
 *
 *  - the star on a game's overview, which is where a favourite is made;
 *  - a Favorites row on the home page, above Recent;
 *  - a quiet mark on the starred games in the shelf below, so the state is
 *    visible where the games are rather than only where the star was pressed.
 *
 * The control lives on the overview and nowhere else. A star on all eighteen
 * tiles would put a second target inside every card whose whole job is to be
 * one — the same reason the jump list shows which sections are bookmarked but
 * does not let you bookmark from it.
 */

const STAR = (filled) => `<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" focusable="false">
  <path d="M10 2.5l2.35 4.76 5.25.76-3.8 3.7.9 5.23L10 14.48l-4.7 2.47.9-5.23-3.8-3.7 5.25-.76Z"
        fill="${filled ? "currentColor" : "none"}" stroke="currentColor"
        stroke-width="1.5" stroke-linejoin="round"/>
</svg>`;

function gameContext() {
  const { dataset } = document.body;
  if (!dataset.game || !dataset.gameUrl) return null;
  return {
    gameSlug: dataset.game,
    gameTitle: dataset.gameTitle || dataset.game,
    gameUrl: dataset.gameUrl,
  };
}

/** The star on a game's overview page. */
function initToggle() {
  const button = document.querySelector("[data-favorite-toggle]");
  const context = gameContext();
  if (!button || !context) return;

  const label = button.querySelector("[data-favorite-label]");
  const icon = button.querySelector("[data-favorite-icon]");

  function render() {
    const saved = favoriteStore.has(context.gameSlug);
    button.setAttribute("aria-pressed", String(saved));
    button.classList.toggle("is-on", saved);
    if (icon) icon.innerHTML = STAR(saved);
    if (label) label.textContent = saved ? "Favorited" : "Favorite";
    button.setAttribute(
      "aria-label",
      saved ? `Remove ${context.gameTitle} from favorites` : `Add ${context.gameTitle} to favorites`,
    );
  }

  button.hidden = false;
  button.addEventListener("click", () => {
    favoriteStore.toggle(context);
    render();
  });

  render();
  favoriteStore.subscribe(render);
}

/**
 * The Favorites row on the home page, and the marks on the shelf below it.
 *
 * Tiles are cloned out of the shelf rather than rebuilt: the art there has
 * already been through the image transform, with its srcset and its dimensions,
 * and a second way of producing a game tile would be a second thing to keep in
 * step with the first.
 */
function initHome() {
  const section = document.querySelector("[data-favorite-games]");
  const list = section?.querySelector("[data-favorite-list]");
  if (!section || !list) return;

  function render() {
    const favorites = favoriteStore.list();

    list.replaceChildren();
    for (const favorite of favorites) {
      const tile = document.querySelector(
        `.game-grid [data-game-slug="${CSS.escape(favorite.gameSlug)}"]`,
      );

      if (tile) {
        const clone = tile.cloneNode(true);
        clone.removeAttribute("data-game-slug");
        clone.querySelector(".game-tile__meta")?.remove();
        clone.querySelector(".game-tile__description")?.remove();
        clone.querySelector(".chip-row")?.remove();
        clone.querySelector(".game-tile__star")?.remove();
        list.append(clone);
        continue;
      }

      /*
       * A favourite that is not on the shelf — an unlisted game, reachable only
       * by its URL. It is still the reader's own favourite, so it appears, just
       * without a cover to borrow.
       */
      const item = document.createElement("li");
      item.className = "game-tile";
      const body = document.createElement("div");
      body.className = "game-tile__body";
      const title = document.createElement("h3");
      title.className = "game-tile__title";
      const link = document.createElement("a");
      link.href = withBasePath(favorite.gameUrl);
      link.textContent = favorite.gameTitle;
      title.append(link);
      body.append(title);
      item.append(body);
      list.append(item);
    }

    section.hidden = favorites.length === 0;

    // And mark them where they sit on the shelf.
    for (const tile of document.querySelectorAll(".game-grid [data-game-slug]")) {
      const saved = favorites.some((favorite) => favorite.gameSlug === tile.dataset.gameSlug);
      tile.classList.toggle("is-favorite", saved);

      const existing = tile.querySelector(".game-tile__star");
      if (saved && !existing) {
        const star = document.createElement("span");
        star.className = "game-tile__star";
        star.title = "Favorited";
        star.innerHTML = STAR(true);
        const hidden = document.createElement("span");
        hidden.className = "visually-hidden";
        hidden.textContent = " (favorited)";
        star.append(hidden);
        tile.querySelector(".game-tile__title")?.append(star);
      } else if (!saved && existing) {
        existing.remove();
      }
    }
  }

  render();
  favoriteStore.subscribe(render);
}

export function initFavorites() {
  initToggle();
  initHome();
}

/** Which games are favourited — so Recent can avoid repeating them. */
export function favoriteSlugs() {
  return new Set(favoriteStore.list().map((favorite) => favorite.gameSlug));
}
