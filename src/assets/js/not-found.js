import { BASE_PATH } from "./base-path.js";
import { rank, score, SUBSTRING_MATCH } from "./fuzzy.js";

/**
 * Recovery on the not-found page.
 *
 * A 404 here almost always arrives with a usable clue attached: the URL itself.
 * `/games/indonesia/setup/` is not a page, but it says plainly which game was
 * wanted and roughly which part of it — so rather than apologising and pointing
 * at the front door, this reads the path back and offers the pages it most
 * likely meant, using the same index and the same matcher as the palette.
 *
 * Everything it adds is additive. The page ships a working list of games and a
 * search button in the markup, so with JS off it is still a way out.
 */

/** The site path the reader asked for, with any deploy prefix taken off. */
function requestedPath() {
  const path = window.location.pathname;
  if (BASE_PATH !== "/" && path.startsWith(BASE_PATH)) return `/${path.slice(BASE_PATH.length)}`;
  return path;
}

/**
 * Search terms from a URL. The last meaningful segment is the specific thing
 * being asked for — the fragment if there is one, otherwise the final path
 * segment — with hyphens opened back out into words.
 */
function queryFrom(segments, hash) {
  const last = hash || segments[segments.length - 1] || "";
  return last.replace(/\.[a-z]+$/i, "").split("-").join(" ").trim();
}

/**
 * The game a path segment refers to: the slug exactly, or the closest one that
 * clearly contains it. Deliberately strict — guessing the wrong game sends the
 * reader further from where they were going, not closer.
 */
function matchGame(index, segment) {
  const slugs = [...new Set(index.map((entry) => entry.gameSlug))];
  if (slugs.includes(segment)) return segment;

  const near = slugs
    .map((slug) => ({ slug, value: score(slug, segment) }))
    .filter((entry) => entry.value >= SUBSTRING_MATCH)
    .sort((a, b) => b.value - a.value);

  return near.length === 1 ? near[0].slug : null;
}

export function initNotFound() {
  const root = document.querySelector("[data-not-found]");
  if (!root) return;

  const pathOut = root.querySelector("[data-not-found-path]");
  const suggestions = root.querySelector("[data-not-found-suggestions]");
  const list = root.querySelector("[data-not-found-list]");
  const lede = root.querySelector("[data-not-found-lede]");

  const path = requestedPath();
  if (pathOut) {
    pathOut.querySelector("code").textContent = path;
    pathOut.hidden = false;
  }

  // Reuses the header's palette rather than opening a second search of its own.
  const searchButton = root.querySelector("[data-not-found-search]");
  const paletteTrigger = document.querySelector("[data-palette-toggle]");
  if (searchButton && paletteTrigger) {
    searchButton.addEventListener("click", () => paletteTrigger.click());
  } else if (searchButton) {
    searchButton.hidden = true;
  }

  // The palette's build-time index, on this page like every other.
  let index = [];
  try {
    index = JSON.parse(document.querySelector("[data-palette-index]")?.textContent || "[]");
  } catch {
    index = [];
  }
  if (!index.length || !suggestions || !list) return;

  const segments = path.split("/").filter(Boolean);
  const hash = window.location.hash.slice(1);

  // Does the path name a game that exists? If so the reader is in the right
  // neighbourhood and only the last part is wrong, so suggestions stay inside
  // it. A near miss counts: `/games/xia/` is unmistakably Xia: Legends of a
  // Drift System, and someone who shortened the slug by hand deserves the same
  // help as someone who got it exactly right.
  const gameSlug = segments[0] === "games" && segments[1] ? matchGame(index, segments[1]) : null;
  const game = gameSlug ? index.find((entry) => entry.gameSlug === gameSlug) : null;

  const pool = gameSlug ? index.filter((entry) => entry.gameSlug === gameSlug) : index;
  const query = queryFrom(segments, hash);

  /*
   * Inside a known game, a loose match is still a useful offer. Across the
   * whole site it is not: "up" threads through Supply, Setup and Rupiah, and
   * three confident wrong answers are worse than none, so an unscoped guess has
   * to actually contain what was asked for.
   */
  let matches = rank(pool, query, 6, gameSlug ? 0 : SUBSTRING_MATCH);
  // A recognised game with nothing matching the rest is still a good answer:
  // offer its pages rather than nothing.
  if (!matches.length && game) matches = pool.filter((entry) => entry.group === "Pages").slice(0, 6);
  if (!matches.length) return;

  if (lede && game) {
    lede.textContent = `That isn’t a page in ${game.gameTitle}, but these are close.`;
  }

  for (const entry of matches) {
    const item = document.createElement("li");
    item.className = "suggestion";

    const link = document.createElement("a");
    link.className = "suggestion__link";
    link.href = entry.url;

    const label = document.createElement("span");
    label.className = "suggestion__label";
    label.textContent = entry.label;
    link.append(label);

    const detail = document.createElement("span");
    detail.className = "suggestion__detail";
    detail.textContent = gameSlug
      ? entry.detail || entry.group
      : `${entry.gameTitle} · ${entry.detail || entry.group}`;
    link.append(detail);

    item.append(link);
    list.append(item);
  }

  suggestions.hidden = false;
}
