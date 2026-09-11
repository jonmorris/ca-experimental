import { bookmarkStore } from "./bookmark-store.js";

/**
 * The bookmark toggle beside every H2 on a bookmarkable page.
 *
 * The buttons are server-rendered but ship `hidden`; they are revealed here, so
 * a reader without JS never sees a control that cannot work.
 */

function pageContext() {
  const body = document.body;
  const gameSlug = body.dataset.game;
  const ruleSlug = body.dataset.contentType;
  if (!gameSlug || !ruleSlug) return null;

  const heading = document.querySelector(".page-title");
  return {
    gameSlug,
    gameTitle: body.dataset.gameTitle || gameSlug,
    expansionSlug: body.dataset.expansion || "",
    expansionTitle: body.dataset.expansionTitle || "",
    ruleSlug,
    ruleTitle: heading?.textContent.trim() || ruleSlug,
    ruleUrl: window.location.pathname,
  };
}

function bookmarkFor(context, button) {
  return {
    ...context,
    anchor: button.dataset.bookmarkAnchor,
    title: button.dataset.bookmarkTitle,
    url: button.dataset.bookmarkUrl,
  };
}

function render(button, saved) {
  button.setAttribute("aria-pressed", String(saved));
  const title = button.dataset.bookmarkTitle;
  button.setAttribute(
    "aria-label",
    saved ? `Remove bookmark: ${title}` : `Bookmark section: ${title}`,
  );
  const label = button.querySelector(".bookmark-toggle__label");
  if (label) label.textContent = saved ? "Bookmarked" : "Bookmark";
}

export function initBookmarkToggles() {
  const buttons = [...document.querySelectorAll("[data-bookmark-anchor]")];
  if (!buttons.length) return;

  const context = pageContext();
  if (!context) return;

  const refresh = () => {
    for (const button of buttons) {
      render(button, bookmarkStore.has(bookmarkFor(context, button)));
    }
  };

  for (const button of buttons) {
    button.hidden = false;
    button.addEventListener("click", () => {
      const bookmark = bookmarkFor(context, button);
      if (bookmarkStore.has(bookmark)) bookmarkStore.remove(bookmark);
      else bookmarkStore.add(bookmark);
      refresh();
    });
  }

  refresh();
  bookmarkStore.subscribe(refresh);
}
