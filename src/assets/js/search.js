/**
 * Search, backed by Pagefind.
 *
 * Two scopes:
 *
 * - **Per-game.** Any widget carrying `data-search-game` filters on
 *   `{ game: [slug] }`. Every page is tagged `data-pagefind-filter="game:…"`
 *   on `<body>`, so a search made on one game's page cannot return another
 *   game's results.
 * - **Global.** The homepage widget applies no filter and spans everything.
 *
 * The index is built by `npm run build:search` after the site build, so it does
 * not exist during `npm run dev`. That case is reported in the status line
 * rather than failing silently.
 */

import { BASE_PATH, withBasePath } from "./base-path.js";

const PAGEFIND_URL = withBasePath("/pagefind/pagefind.js");
const DEBOUNCE_MS = 180;
const MAX_RESULTS = 8;

let pagefindPromise = null;

/** Loads Pagefind once and shares it between every widget on the page. */
function loadPagefind() {
  if (!pagefindPromise) {
    pagefindPromise = import(PAGEFIND_URL)
      .then(async (pagefind) => {
        await pagefind.options({
          excerptLength: 24,
          // Two different paths: `basePath` is where the Pagefind bundle and
          // its index chunks live, `baseUrl` is the site root that result URLs
          // are built from. Both move when the site is served from a subpath.
          basePath: withBasePath("/pagefind/"),
          baseUrl: BASE_PATH,
        });
        await pagefind.init();
        return pagefind;
      })
      .catch(() => null);
  }
  return pagefindPromise;
}

function debounce(fn, wait) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

function renderResults(list, results) {
  list.replaceChildren();

  for (const result of results) {
    const item = document.createElement("li");
    item.className = "search-result";

    const link = document.createElement("a");
    link.className = "search-result__link";
    link.href = result.url;
    link.textContent = result.meta?.title || result.url;
    item.append(link);

    if (result.excerpt) {
      const context = document.createElement("p");
      context.className = "search-result__context";
      // Pagefind's excerpt is generated from indexed content and contains only
      // <mark> elements, so it is safe to insert as markup.
      context.innerHTML = result.excerpt;
      item.append(context);
    }

    list.append(item);
  }
}

function initWidget(widget) {
  const input = widget.querySelector("[data-search-input]");
  const status = widget.querySelector("[data-search-status]");
  const list = widget.querySelector("[data-search-results]");
  const clearButton = widget.querySelector("[data-search-clear]");
  if (!input || !status || !list) return;

  const gameSlug = widget.dataset.searchGame || null;
  const filters = gameSlug ? { game: [gameSlug] } : undefined;

  // The form only exists to give the input a search landmark; there is nowhere
  // to submit to, so Enter should not reload the page.
  widget.querySelector("form")?.addEventListener("submit", (event) => event.preventDefault());

  function reset() {
    list.replaceChildren();
    status.textContent = "";
    if (clearButton) clearButton.hidden = true;
  }

  async function run(query) {
    if (!query.trim()) {
      reset();
      return;
    }

    if (clearButton) clearButton.hidden = false;
    status.textContent = "Searching…";

    const pagefind = await loadPagefind();
    if (!pagefind) {
      list.replaceChildren();
      status.textContent = "Search is unavailable — run `npm run build` to create the index.";
      return;
    }

    // A slower search must not overwrite the results of a later one.
    if (input.value !== query) return;

    const search = await pagefind.search(query, filters ? { filters } : undefined);
    if (input.value !== query) return;

    const results = await Promise.all(
      search.results.slice(0, MAX_RESULTS).map((result) => result.data()),
    );
    if (input.value !== query) return;

    renderResults(list, results);

    const scope = gameSlug ? " in this game" : "";
    status.textContent = results.length
      ? `${search.results.length} result${search.results.length === 1 ? "" : "s"}${scope}` +
        (search.results.length > results.length ? `, showing the first ${results.length}` : "")
      : `No results${scope} for “${query}”.`;
  }

  input.addEventListener("input", debounce(() => run(input.value), DEBOUNCE_MS));

  input.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    input.value = "";
    reset();
  });

  clearButton?.addEventListener("click", () => {
    input.value = "";
    reset();
    input.focus();
  });
}

export function initSearch() {
  for (const widget of document.querySelectorAll("[data-search]")) {
    initWidget(widget);
  }
}
