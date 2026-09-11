import { bookmarkStore } from "./bookmark-store.js";
import { groupBookmarks } from "./bookmark-groups.js";
import { createOverlay } from "./overlay.js";

/**
 * Bookmarks, reachable from any page.
 *
 * The landing page keeps the fuller panel; this is the at-the-table version —
 * a saved rule is one tap away wherever you are, rather than a trip back to
 * the game's home page. Both read the same store and use the same grouping.
 *
 * Scoped to the current game it groups by document. Across all games it adds a
 * game heading above those, because "Rulebook" on its own stops meaning
 * anything once three games are listed.
 */

function documentSection(group) {
  const section = document.createElement("section");
  section.className = "drawer-group";

  const heading = document.createElement("h3");
  heading.className = "drawer-group__title";
  const headingLink = document.createElement("a");
  headingLink.href = group.url;
  headingLink.textContent = group.title;
  heading.append(headingLink);

  const count = document.createElement("span");
  count.className = "drawer-group__count";
  count.textContent = String(group.items.length);
  heading.append(count);

  const list = document.createElement("ul");
  list.className = "drawer-group__list";

  section.append(heading, list);
  return { section, list };
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

  function itemElement(bookmark) {
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
    return item;
  }

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

    if (!showAll) {
      for (const group of groupBookmarks(bookmarks)) {
        const { section, list } = documentSection(group);
        for (const bookmark of group.items) list.append(itemElement(bookmark));
        body.append(section);
      }
      return;
    }

    for (const game of groupBookmarks(bookmarks, { byGame: true })) {
      const gameSection = document.createElement("section");
      gameSection.className = "drawer-game";

      const gameHeading = document.createElement("h3");
      gameHeading.className = "drawer-game__title";
      const gameLink = document.createElement("a");
      gameLink.href = game.url;
      gameLink.textContent = game.title;
      gameHeading.append(gameLink);
      gameSection.append(gameHeading);

      for (const group of game.groups) {
        const { section, list } = documentSection(group);
        // Nested one level, so the game heading reads as the parent.
        section.classList.add("drawer-group--nested");
        // Demote the document heading: it now sits under the game's h3.
        const h4 = document.createElement("h4");
        h4.className = "drawer-group__title";
        h4.append(...section.querySelector(".drawer-group__title").childNodes);
        section.querySelector(".drawer-group__title").replaceWith(h4);

        for (const bookmark of group.items) list.append(itemElement(bookmark));
        gameSection.append(section);
      }

      body.append(gameSection);
    }
  }

  scopeToggle?.addEventListener("click", () => {
    showAll = !showAll;
    scopeToggle.textContent = showAll ? "This game only" : "Show all games";
    scopeToggle.setAttribute("aria-pressed", String(showAll));
    render();
  });

  if (scopeToggle && !gameSlug) scopeToggle.hidden = true;

  createOverlay({ panel, trigger });
  render();
  bookmarkStore.subscribe(render);
}
