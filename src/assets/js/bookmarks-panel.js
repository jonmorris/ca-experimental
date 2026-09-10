import { bookmarkStore } from "./bookmark-store.js";

/**
 * The "Your bookmarks" panel on a game's landing page.
 *
 * Bookmarks are grouped by the content type they live in, each entry linking
 * straight to its H2 anchor.
 */

function groupByRule(bookmarks) {
  const groups = new Map();
  for (const bookmark of bookmarks) {
    if (!groups.has(bookmark.ruleSlug)) {
      groups.set(bookmark.ruleSlug, {
        ruleSlug: bookmark.ruleSlug,
        ruleTitle: bookmark.ruleTitle || bookmark.ruleSlug,
        ruleUrl: bookmark.ruleUrl,
        items: [],
      });
    }
    groups.get(bookmark.ruleSlug).items.push(bookmark);
  }
  return [...groups.values()].sort((a, b) => a.ruleTitle.localeCompare(b.ruleTitle));
}

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

    for (const group of groupByRule(bookmarks)) {
      const groupNode = groupTemplate.content.cloneNode(true);
      const groupLink = groupNode.querySelector("[data-group-link]");
      groupLink.textContent = group.ruleTitle;
      groupLink.href = group.ruleUrl;

      const list = groupNode.querySelector("[data-group-list]");

      // Within a section, present bookmarks in reading order rather than the
      // order they happened to be saved in.
      const ordered = [...group.items].sort((a, b) => a.url.localeCompare(b.url));

      for (const bookmark of ordered) {
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
