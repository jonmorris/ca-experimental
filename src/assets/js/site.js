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

function start() {
  // The inline head script already applied these before first paint; this
  // re-applies them from the same store so the two can never drift.
  applyPreferences(preferences.all());

  initSectionTracker();
  initSectionNav();

  initMenu();
  initPreferences();
  initCommandPalette();
  initBookmarkToggles();
  initBookmarksPanel();
  initBookmarksDrawer();
  initNotFound();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, { once: true });
} else {
  start();
}
