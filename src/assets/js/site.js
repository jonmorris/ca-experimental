/**
 * Entry point. Every enhancement is opt-in on the markup it needs, so each
 * initialiser is a no-op on pages that do not carry it.
 */

import { initMenu } from "./menu.js";
import { initSearch } from "./search.js";
import { initBookmarkToggles } from "./bookmarks-ui.js";
import { initBookmarksPanel } from "./bookmarks-panel.js";
import { initRulebookNav } from "./rulebook-nav.js";

function start() {
  initMenu();
  initSearch();
  initBookmarkToggles();
  initBookmarksPanel();
  initRulebookNav();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, { once: true });
} else {
  start();
}
