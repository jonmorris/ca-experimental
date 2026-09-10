import { bookmarkStore } from "./bookmark-store.js";
import { createOverlay } from "./overlay.js";

/**
 * Bookmarks, reachable from any page.
 *
 * The landing page keeps the fuller panel; this is the at-the-table version —
 * a saved rule is one tap away wherever you are, rather than a trip back to
 * the game's home page. Both read the same store.
 */

function groupByRule(bookmarks) {
  const groups = new Map();
  for (const bookmark of bookmarks) {
    if (!groups.has(bookmark.ruleSlug)) {
      groups.set(bookmark.ruleSlug, {
        title: bookmark.ruleTitle || bookmark.ruleSlug,
        url: bookmark.ruleUrl,
        items: [],
      });
    }
    groups.get(bookmark.ruleSlug).items.push(bookmark);
  }
  return [...groups.values()].sort((a, b) => a.title.localeCompare(b.title));
}

export function initBookmarksDrawer() {
  const panel = document.querySelector("[data-bookmarks-drawer]");
  const trigger = document.querySelector("[data-bookmarks-toggle]");
  if (!panel || !trigger) return;

  const body = panel.querySelector("[data-drawer-body]");
  const empty = panel.querySelector("[data-drawer-empty]");
  const count = trigger.querySelector("[data-bookmarks-count]");
  const scopeToggle = panel.querySelector("[data-drawer-scope]");
  if (!body) return;

  trigger.hidden = false;

  const gameSlug = document.body.dataset.game || null;
  let showAll = !gameSlug;

  function render() {
    const bookmarks = bookmarkStore.list(showAll ? {} : { gameSlug });
    const total = bookmarkStore.list().length;

    if (count) {
      count.textContent = total ? String(total) : "";
      count.hidden = total === 0;
    }
    trigger.setAttribute(
      "aria-label",
      total ? `Bookmarks (${total} saved)` : "Bookmarks — none saved yet",
    );

    body.replaceChildren();

    if (!bookmarks.length) {
      if (empty) {
        empty.hidden = false;
        empty.textContent = showAll
          ? "No bookmarks yet. Tap the icon next to any heading in a rulebook to save it."
          : "Nothing saved in this game yet.";
      }
      return;
    }
    if (empty) empty.hidden = true;

    for (const group of groupByRule(bookmarks)) {
      const section = document.createElement("section");
      section.className = "drawer-group";

      const heading = document.createElement("h3");
      heading.className = "drawer-group__title";
      const headingLink = document.createElement("a");
      headingLink.href = group.url;
      headingLink.textContent = group.title;
      heading.append(headingLink);

      const list = document.createElement("ul");
      list.className = "drawer-group__list";

      // Reading order within a section, not the order they were saved.
      for (const bookmark of [...group.items].sort((a, b) => a.url.localeCompare(b.url))) {
        const item = document.createElement("li");
        item.className = "drawer-item";

        const link = document.createElement("a");
        link.className = "drawer-item__link";
        link.href = bookmark.url;
        link.textContent = bookmark.title;

        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "drawer-item__remove";
        remove.innerHTML = '<span aria-hidden="true">×</span>';
        remove.setAttribute("aria-label", `Remove bookmark: ${bookmark.title}`);
        remove.addEventListener("click", () => {
          bookmarkStore.remove(bookmark);
          render();
        });

        item.append(link, remove);
        list.append(item);
      }

      section.append(heading, list);
      body.append(section);
    }
  }

  scopeToggle?.addEventListener("click", () => {
    showAll = !showAll;
    scopeToggle.textContent = showAll ? "Show this game only" : "Show all games";
    scopeToggle.setAttribute("aria-pressed", String(showAll));
    render();
  });

  if (scopeToggle && !gameSlug) scopeToggle.hidden = true;

  createOverlay({ panel, trigger });
  render();
  bookmarkStore.subscribe(render);
}
