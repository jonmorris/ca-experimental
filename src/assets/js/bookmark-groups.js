/**
 * Grouping bookmarks for display.
 *
 * Shared by the header drawer and the landing-page panel so the two can never
 * organise the same list differently.
 *
 * Two levels, because a bookmark has two things worth knowing about it: which
 * game it is in, and which document within that game. Scoped to one game only
 * the second matters; across all games both do.
 */

import { withBasePath } from "./base-path.js";

function titleFromSlug(slug) {
  return String(slug || "")
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * A bookmark's document — the content type it lives in, qualified by its
 * expansion. A game's base rulebook and an expansion's rulebook are different
 * documents that happen to share a content-type slug, so the expansion has to
 * be part of both the key and the label or they read as one.
 */
function documentKey(bookmark) {
  return `${bookmark.expansionSlug || ""}::${bookmark.ruleSlug}`;
}

function documentTitle(bookmark) {
  const rule = bookmark.ruleTitle || titleFromSlug(bookmark.ruleSlug);
  const expansion = bookmark.expansionTitle || titleFromSlug(bookmark.expansionSlug);
  return expansion ? `${expansion} · ${rule}` : rule;
}

function groupByDocument(bookmarks) {
  const groups = new Map();

  for (const bookmark of bookmarks) {
    const key = documentKey(bookmark);
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        title: documentTitle(bookmark),
        url: bookmark.ruleUrl,
        isExpansion: Boolean(bookmark.expansionSlug),
        items: [],
      });
    }
    groups.get(key).items.push(bookmark);
  }

  for (const group of groups.values()) {
    // Reading order within a document, not the order they happened to be saved.
    group.items.sort((a, b) => a.url.localeCompare(b.url));
  }

  // Base content first, then expansions — the order they appear in the nav.
  return [...groups.values()].sort(
    (a, b) => Number(a.isExpansion) - Number(b.isExpansion) || a.title.localeCompare(b.title),
  );
}

/**
 * @param {Array} bookmarks
 * @param {{ byGame?: boolean }} options
 * @returns {Array} when `byGame`, a list of games each holding document groups;
 *                  otherwise the document groups directly.
 */
export function groupBookmarks(bookmarks, { byGame = false } = {}) {
  if (!byGame) return groupByDocument(bookmarks);

  const games = new Map();
  for (const bookmark of bookmarks) {
    if (!games.has(bookmark.gameSlug)) {
      games.set(bookmark.gameSlug, {
        slug: bookmark.gameSlug,
        title: bookmark.gameTitle || titleFromSlug(bookmark.gameSlug),
        // Built here rather than stored, so it needs the deploy prefix that
        // the markup gets from `HtmlBasePlugin`.
        url: withBasePath(`/games/${bookmark.gameSlug}/`),
        items: [],
      });
    }
    games.get(bookmark.gameSlug).items.push(bookmark);
  }

  return [...games.values()]
    .map((game) => ({ ...game, groups: groupByDocument(game.items) }))
    .sort((a, b) => a.title.localeCompare(b.title));
}
