import { bookmarkStore } from "./bookmark-store.js";

/**
 * Marks the sections you have bookmarked in the jump lists.
 *
 * The bookmarks drawer answers "what have I saved"; this answers the same
 * question without leaving the document, which is the one that matters at a
 * table — you opened the list to go somewhere, and the marks are what remind
 * you where you meant to go.
 *
 * One query covers both lists: the sidebar at desk width and the sheet the
 * sticky bar opens on a phone are the same markup, and every jump link on a
 * page belongs to the document that page is, so an anchor is enough to match
 * on once the bookmarks are narrowed to this document.
 */

const FLAG = `<svg viewBox="0 0 16 20" width="11" height="13" aria-hidden="true" focusable="false">
  <path d="M2.5 1.5h11a1 1 0 0 1 1 1v15.2a.6.6 0 0 1-.94.49L8 14.2l-5.56 4a.6.6 0 0 1-.94-.5V2.5a1 1 0 0 1 1-1Z"
        fill="currentColor"/>
</svg>`;

function pageContext() {
  const { dataset } = document.body;
  if (!dataset.game || !dataset.contentType) return null;
  return {
    gameSlug: dataset.game,
    ruleSlug: dataset.contentType,
    expansionSlug: dataset.expansion || "",
  };
}

export function initJumpBookmarks() {
  const links = [...document.querySelectorAll("[data-jump-anchor]")];
  if (!links.length) return;

  const context = pageContext();
  if (!context) return;

  function render() {
    const saved = new Set(
      bookmarkStore
        .list({ gameSlug: context.gameSlug })
        .filter(
          (b) =>
            b.ruleSlug === context.ruleSlug &&
            (b.expansionSlug || "") === context.expansionSlug,
        )
        .map((b) => b.anchor),
    );

    for (const link of links) {
      const isSaved = saved.has(link.dataset.jumpAnchor);
      link.classList.toggle("is-bookmarked", isSaved);

      const existing = link.querySelector(".jump-link__flag");
      if (isSaved && !existing) {
        const flag = document.createElement("span");
        flag.className = "jump-link__flag";
        flag.innerHTML = FLAG;
        /*
         * Named rather than decorative. The mark is the only thing telling a
         * screen reader that this entry is one of the reader's own, and it
         * carries no text of its own to say so.
         */
        flag.setAttribute("title", "Bookmarked");
        const label = document.createElement("span");
        label.className = "visually-hidden";
        label.textContent = " (bookmarked)";
        flag.append(label);
        link.append(flag);
      } else if (!isSaved && existing) {
        existing.remove();
      }
    }
  }

  render();
  bookmarkStore.subscribe(render);
}
