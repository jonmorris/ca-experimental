import { bookmarkStore } from "./bookmark-store.js";
import { groupBookmarks } from "./bookmark-groups.js";

/**
 * The "Your bookmarks" panel on a game's landing page.
 *
 * Always scoped to this game, so it groups by document only — rulebook,
 * summary, and each expansion's documents separately. Grouping and ordering
 * come from `bookmark-groups.js`, shared with the header drawer.
 */

export function initBookmarksPanel() {
  const panel = document.querySelector("[data-bookmarks-panel]");
  if (!panel) return;

  const gameSlug = panel.dataset.bookmarksGame;
  const emptyState = panel.querySelector("[data-bookmarks-empty]");
  const container = panel.querySelector("[data-bookmarks-groups]");
  const groupTemplate = panel.querySelector("[data-bookmarks-group-template]");
  const itemTemplate = panel.querySelector("[data-bookmarks-item-template]");
  if (!gameSlug || !emptyState || !container || !groupTemplate || !itemTemplate) return;

  // The panel is hidden until JS confirms it can be populated.
  panel.hidden = false;

  function render() {
    const bookmarks = bookmarkStore.list({ gameSlug });
    container.replaceChildren();

    if (!bookmarks.length) {
      emptyState.hidden = false;
      container.hidden = true;
      return;
    }

    emptyState.hidden = true;
    container.hidden = false;

    for (const group of groupBookmarks(bookmarks)) {
      const groupNode = groupTemplate.content.cloneNode(true);
      const groupLink = groupNode.querySelector("[data-group-link]");
      groupLink.textContent = group.title;
      groupLink.href = group.url;

      const groupCount = groupNode.querySelector("[data-group-count]");
      if (groupCount) groupCount.textContent = String(group.items.length);

      const list = groupNode.querySelector("[data-group-list]");

      for (const bookmark of group.items) {
        const itemNode = itemTemplate.content.cloneNode(true);
        const link = itemNode.querySelector("[data-item-link]");
        link.textContent = bookmark.title;
        link.href = bookmark.url;

        const removeButton = itemNode.querySelector("[data-item-remove]");
        removeButton.querySelector("[data-item-remove-label]").textContent =
          `Remove bookmark: ${bookmark.title}`;
        removeButton.addEventListener("click", () => {
          bookmarkStore.remove(bookmark);
          render();
        });

        list.append(itemNode);
      }

      container.append(groupNode);
    }
  }

  render();
  bookmarkStore.subscribe(render);
}
