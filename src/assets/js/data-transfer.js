import { bookmarkStore } from "./bookmark-store.js";
import { favoriteStore } from "./favorites.js";
import { historyStore } from "./reading-history.js";
import { preferences, PREFERENCES } from "./preferences.js";

/**
 * Taking your data with you.
 *
 * Everything this site remembers lives in one browser, and browsers lose
 * things: Safari deletes a site's storage after about a week without a visit,
 * clearing browsing data takes it, a phone and a laptop never share it, and
 * moving the site to another domain would strand all of it at once. There are
 * no accounts to fall back on, so the honest thing is to make the data
 * something the reader holds rather than something the site holds for them.
 *
 * One file, four stores, a version on the envelope as well as on each payload —
 * so a file written today can still be read after the shapes inside it have
 * moved on.
 *
 * Imports merge rather than replace. Somebody restoring a backup onto a device
 * that already has bookmarks has not asked to lose the ones they have, and a
 * merge is also what makes the file work as a way to carry a phone's reading
 * over to a laptop rather than only as a rescue.
 */

export const FORMAT = "cardboard-appendix";
export const FORMAT_VERSION = 1;

function stamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Everything, as one object. */
export function buildExport() {
  return {
    format: FORMAT,
    formatVersion: FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    bookmarks: bookmarkStore.snapshot(),
    favorites: favoriteStore.snapshot(),
    history: historyStore.snapshot(),
    preferences: preferences.all(),
  };
}

export function exportFileName() {
  return `${FORMAT}-${stamp()}.json`;
}

/**
 * Hands the file to the browser.
 *
 * The object URL is revoked on the next frame rather than immediately: the
 * download has to have started reading from it first, and revoking in the same
 * tick has been observed to produce a file that never arrives.
 */
export function downloadExport() {
  const blob = new Blob([JSON.stringify(buildExport(), null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = exportFileName();
  document.body.append(link);
  link.click();
  link.remove();

  requestAnimationFrame(() => URL.revokeObjectURL(url));
  return true;
}

/**
 * Reads a file back in.
 *
 * Nothing here trusts the file. It is a JSON document the reader chose off
 * their own disk, which may be from a newer version of the site, from a
 * different site entirely, or simply not what they meant to pick — so the
 * envelope is checked before anything is written, every store filters what it
 * is handed, and a preference that is not one of ours is dropped rather than
 * stored and applied.
 */
export function applyImport(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: "That file is not readable as JSON." };
  }

  if (!parsed || typeof parsed !== "object" || parsed.format !== FORMAT) {
    return { ok: false, reason: "That file is not a Cardboard Appendix export." };
  }

  if (Number(parsed.formatVersion) > FORMAT_VERSION) {
    return {
      ok: false,
      reason: "That file was written by a newer version of this site.",
    };
  }

  const added = {
    bookmarks: bookmarkStore.merge(parsed.bookmarks),
    favorites: favoriteStore.merge(parsed.favorites),
    history: historyStore.merge(parsed.history),
  };

  /*
   * Preferences are the one thing replaced rather than merged: there is no
   * meaningful union of "serif" and "sans", and a reader importing their own
   * settings means to have them. Only keys this build knows, only values it
   * offers.
   */
  let settings = 0;
  const incoming = parsed.preferences;
  if (incoming && typeof incoming === "object") {
    for (const [key, spec] of Object.entries(PREFERENCES)) {
      const value = incoming[key];
      if (!spec.values.includes(value)) continue;
      if (preferences.get(key) === value) continue;
      preferences.set(key, value);
      settings += 1;
    }
  }

  return { ok: true, added, settings };
}

/** "12 bookmarks, 3 favorites and 5 games of history." */
export function describeImport(result) {
  const parts = [];
  if (result.added.bookmarks) {
    parts.push(`${result.added.bookmarks} bookmark${result.added.bookmarks === 1 ? "" : "s"}`);
  }
  if (result.added.favorites) {
    parts.push(`${result.added.favorites} favorite${result.added.favorites === 1 ? "" : "s"}`);
  }
  if (result.added.history) {
    parts.push(`${result.added.history} game${result.added.history === 1 ? "" : "s"} of history`);
  }
  if (result.settings) parts.push("your reading settings");

  if (!parts.length) return "Nothing new — you already had everything in that file.";

  const last = parts.pop();
  const list = parts.length ? `${parts.join(", ")} and ${last}` : last;
  return `Added ${list}.`;
}
