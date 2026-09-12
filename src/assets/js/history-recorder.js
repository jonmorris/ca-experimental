import { historyStore } from "./reading-history.js";
import { getSections } from "./section-tracker.js";
import { stripBasePath } from "./base-path.js";

/**
 * Writes the reading history.
 *
 * Two things are recorded and nothing else:
 *
 *  - opening a page that belongs to a game, which is a visit to that game;
 *  - jumping to a section, which is the reader saying where they want to be.
 *
 * Scrolling is deliberately not one of them. The section tracker knows the
 * current section continuously, and subscribing to it here would write sixteen
 * entries during one read of Indonesia's rulebook — a scroll log, in which the
 * thing you were looking for is buried under everything you passed on the way.
 * `hashchange` is the opposite: it fires for the jump list, the sidebar,
 * prev/next, a search result, a pasted link and the back button, and never for
 * scrolling. It is already the "the reader chose this" signal, so it is the one
 * the history listens to.
 */

function pageContext() {
  const { dataset } = document.body;
  if (!dataset.game || !dataset.gameUrl) return null;

  return {
    gameSlug: dataset.game,
    gameTitle: dataset.gameTitle || dataset.game,
    gameUrl: dataset.gameUrl,
    contentType: dataset.contentType || "site",
    expansionSlug: dataset.expansion || "",
    expansionTitle: dataset.expansionTitle || "",
  };
}

/**
 * The document being read, or null on a game's overview.
 *
 * The overview is a visit to the game but not a place inside it, so it refreshes
 * the record's position in the list without overwriting the chapter the reader
 * was last actually in.
 */
function documentContext(context) {
  if (context.contentType === "site" || context.contentType === "landing") return null;

  const heading = document.querySelector(".page-title");
  return {
    ruleSlug: context.contentType,
    ruleTitle: heading?.textContent.trim() || context.contentType,
    expansionSlug: context.expansionSlug,
    expansionTitle: context.expansionTitle,
    url: stripBasePath(window.location.pathname),
    sectionAnchor: "",
    sectionTitle: "",
  };
}

export function initHistoryRecorder() {
  const context = pageContext();
  if (!context) return;

  const doc = documentContext(context);
  historyStore.record({
    gameSlug: context.gameSlug,
    gameTitle: context.gameTitle,
    gameUrl: context.gameUrl,
    document: doc,
  });

  if (!doc) return;

  function noteSection() {
    const anchor = decodeURIComponent(window.location.hash.slice(1));
    if (!anchor) return;

    // Only headings that are sections. A cross-reference to a numbered rule
    // lands mid-section and is not a place worth listing.
    const section = getSections().find((candidate) => candidate.id === anchor);
    if (!section) return;

    historyStore.recordSection({
      gameSlug: context.gameSlug,
      url: doc.url,
      anchor: section.id,
      title: section.title,
    });
  }

  // A deep link is a jump like any other; it just happened before load.
  noteSection();
  window.addEventListener("hashchange", noteSection);
}
