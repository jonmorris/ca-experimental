import { rank } from "./fuzzy.js";
import { withBasePath } from "./base-path.js";
import { bookmarkStore } from "./bookmark-store.js";
import { preferences, PREFERENCES } from "./preferences.js";

/**
 * The working parts of the About page's feature section.
 *
 * Each card demonstrates itself rather than describing itself — the search box
 * searches the real index, the type controls change the type on the page you
 * are reading, the copy-link copies a real link (that one needs nothing here:
 * `heading-links.js` binds every `[data-copy-link]` on the page, including this
 * one). A list of claims about a reading tool is the one thing a reading tool
 * should not have to resort to.
 *
 * Everything degrades to the prose around it. Without scripting the cards still
 * read as sentences; they just stop being demonstrations.
 */

const RESULTS = 5;

/** Every jump target on the site, shipped as JSON in every page. */
function paletteIndex() {
  const node = document.querySelector("[data-palette-index]");
  if (!node) return [];
  try {
    const parsed = JSON.parse(node.textContent || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function initSearch(root) {
  const input = root.querySelector("[data-brag-search]");
  const results = root.querySelector("[data-brag-results]");
  const count = root.querySelector("[data-brag-count]");
  if (!input || !results) return;

  const index = paletteIndex();
  if (!index.length) return;

  const games = new Set(index.map((item) => item.gameSlug).filter(Boolean));
  if (count) {
    count.textContent = `${index.length} places to land, across ${games.size} games.`;
  }

  function render() {
    const query = input.value.trim();
    results.replaceChildren();
    if (!query) return;

    const matches = rank(index, query, RESULTS);
    if (!matches.length) {
      const empty = document.createElement("li");
      empty.className = "brag-search__empty";
      empty.textContent = `Nothing matches “${query}”.`;
      results.append(empty);
      return;
    }

    for (const match of matches) {
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.className = "brag-search__link";
      link.href = withBasePath(match.url);

      const label = document.createElement("span");
      label.className = "brag-search__label";
      label.textContent = match.label;

      const where = document.createElement("span");
      where.className = "brag-search__where";
      where.textContent = [match.gameTitle, match.detail].filter(Boolean).join(" · ");

      link.append(label, where);
      item.append(link);
      results.append(item);
    }
  }

  input.addEventListener("input", render);
  render();
}

/**
 * What this reader has already built, if anything.
 *
 * The card claims the site turns bookmarks into a page. Somebody who has
 * bookmarked things should be shown theirs rather than told about the idea
 * again — and somebody who has not gets a way in that names a real game rather
 * than an abstraction.
 */
function initReference(root) {
  const slot = root.querySelector("[data-brag-reference]");
  if (!slot) return;

  function render() {
    const saved = bookmarkStore.list();
    slot.replaceChildren();

    if (!saved.length) {
      slot.className = "brag__demo brag__demo--quiet";
      slot.textContent = "Bookmark anything and this is where it starts.";
      return;
    }

    const games = new Map();
    for (const bookmark of saved) {
      if (!games.has(bookmark.gameSlug)) games.set(bookmark.gameSlug, bookmark);
    }
    const first = games.values().next().value;

    slot.className = "brag__demo";
    const strong = document.createElement("strong");
    strong.textContent = `You have ${saved.length} saved`;
    const rest = document.createTextNode(
      ` across ${games.size} ${games.size === 1 ? "game" : "games"}. `,
    );
    const link = document.createElement("a");
    link.href = withBasePath(`/games/${first.gameSlug}/my-reference/`);
    link.textContent = `See yours for ${first.gameTitle}`;
    slot.append(strong, rest, link);
  }

  render();
  bookmarkStore.subscribe(render);
}

/**
 * Live typography controls.
 *
 * They write to the same store the preferences panel writes to, because they
 * are the same setting — a demonstration that quietly used a different one
 * would be a lie about what the site does.
 */
function initFaces(root) {
  const slot = root.querySelector("[data-brag-faces]");
  if (!slot) return;

  const groups = [
    { key: "face", labels: { serif: "Serif", sans: "Sans" } },
    { key: "density", labels: { compact: "Small", comfortable: "Medium", spacious: "Large" } },
  ];

  function render() {
    const current = preferences.all();
    slot.replaceChildren();

    for (const group of groups) {
      const spec = PREFERENCES[group.key];
      if (!spec) continue;

      const row = document.createElement("div");
      row.className = "brag-faces__row";
      row.setAttribute("role", "group");
      row.setAttribute("aria-label", spec.label);

      for (const value of spec.values) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "brag-faces__button";
        button.textContent = group.labels[value] || value;
        button.setAttribute("aria-pressed", String(current[group.key] === value));
        button.classList.toggle("is-on", current[group.key] === value);
        button.addEventListener("click", () => preferences.set(group.key, value));
        row.append(button);
      }

      slot.append(row);
    }
  }

  render();
  preferences.subscribe(render);
}

export function initAboutDemos() {
  const root = document.querySelector("[data-about-demos]");
  if (!root) return;

  initSearch(root);
  initReference(root);
  initFaces(root);
}
