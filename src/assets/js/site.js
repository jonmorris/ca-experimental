/**
 * Entry point.
 *
 * Every enhancement is opt-in on the markup it needs, so each initialiser is a
 * no-op on pages that do not carry it. The section tracker runs first because
 * the palette and the section navigation both read from it.
 */

import { preferences, applyPreferences } from "./preferences.js";
import { initPreferences } from "./preferences-ui.js";
import { initMenu } from "./menu.js";
import { initCommandPalette } from "./command-palette.js";
import { initBookmarkToggles } from "./bookmarks-ui.js";
import { initBookmarksPanel } from "./bookmarks-panel.js";
import { initBookmarksDrawer } from "./bookmarks-drawer.js";
import { initSectionTracker } from "./section-tracker.js";
import { initSectionNav } from "./section-nav.js";
import { initNotFound } from "./not-found.js";
import { initHeadingLinks } from "./heading-links.js";
import { initHistoryRecorder } from "./history-recorder.js";
import { initRecentGames } from "./recent-games.js";
import { initJumpBookmarks } from "./jump-bookmarks.js";
import { initMyReference } from "./my-reference.js";
import { initPrint } from "./print.js";
import { initFavorites } from "./favorites-ui.js";

function start() {
  // The inline head script already applied these before first paint; this
  // re-applies them from the same store so the two can never drift.
  applyPreferences(preferences.all());

  initSectionTracker();
  initSectionNav();

  // After the tracker: the recorder asks it which headings are sections.
  initHistoryRecorder();
  initFavorites();
  initRecentGames();

  initMenu();
  initPreferences();
  initCommandPalette();
  initBookmarkToggles();
  initJumpBookmarks();
  initMyReference();
  initPrint();
  initBookmarksPanel();
  initBookmarksDrawer();
  initNotFound();
  initHeadingLinks();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, { once: true });
} else {
  start();
}
