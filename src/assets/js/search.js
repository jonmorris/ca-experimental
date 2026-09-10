/**
 * Pagefind adapter.
 *
 * No DOM: this module knows how to ask Pagefind a question and nothing about
 * how the answer is shown. The command palette is the only search interface,
 * so full-text results appear in the same place as everything else a reader
 * might be looking for.
 *
 * Scoping is the important part. Every page is tagged
 * `data-pagefind-filter="game:…"` on <body>, and a scoped query filters on
 * `{ game: [slug] }`, so a search made inside one game can never return
 * another game's rules.
 *
 * The index is built by `npm run build:search` after the site build, so it does
 * not exist during `npm run dev`. `isAvailable()` reports that rather than
 * letting the UI fail silently.
 */

import { BASE_PATH, withBasePath } from "./base-path.js";

const PAGEFIND_URL = withBasePath("/pagefind/pagefind.js");

let pagefindPromise = null;
let available = null;

/** Loads Pagefind once and shares it across callers. */
function loadPagefind() {
  if (!pagefindPromise) {
    pagefindPromise = import(PAGEFIND_URL)
      .then(async (pagefind) => {
        await pagefind.options({
          excerptLength: 22,
          // Two different paths: `basePath` is where the Pagefind bundle and
          // its index chunks live, `baseUrl` is the site root that result URLs
          // are built from. Both move when the site is served from a subpath.
          basePath: withBasePath("/pagefind/"),
          baseUrl: BASE_PATH,
        });
        await pagefind.init();
        available = true;
        return pagefind;
      })
      .catch(() => {
        available = false;
        return null;
      });
  }
  return pagefindPromise;
}

/** null until the first query has resolved; then true or false. */
export function isAvailable() {
  return available;
}

/**
 * Runs a full-text query.
 *
 * @param {string} query
 * @param {object} options
 * @param {string|null} [options.gameSlug] scope to one game; omit for all
 * @param {number} [options.limit]
 * @returns {Promise<{ok: boolean, total: number, results: Array}>}
 */
export async function searchText(query, { gameSlug = null, limit = 6 } = {}) {
  if (!query.trim()) return { ok: true, total: 0, results: [] };

  const pagefind = await loadPagefind();
  if (!pagefind) return { ok: false, total: 0, results: [] };

  const search = await pagefind.search(
    query,
    gameSlug ? { filters: { game: [gameSlug] } } : undefined,
  );

  const results = await Promise.all(
    search.results.slice(0, limit).map((result) => result.data()),
  );

  return {
    ok: true,
    total: search.results.length,
    results: results.map((result) => ({
      title: result.meta?.title || result.url,
      url: result.url,
      excerpt: result.excerpt || "",
    })),
  };
}
