/**
 * Bookmark storage.
 *
 * The only surface any UI touches is the `BookmarkStore` interface —
 * `list`, `has`, `add`, `remove`. Nothing else in the codebase reads or writes
 * localStorage, so replacing this file with a server-backed implementation is
 * the whole job of adding synced bookmarks later.
 *
 * The stored shape is versioned and record-shaped rather than keyed, so it can
 * be posted to an API as-is:
 *
 *   {
 *     "schemaVersion": 1,
 *     "bookmarks": [
 *       {
 *         "gameSlug": "indonesia",
 *         "ruleSlug": "rulebook",
 *         "ruleTitle": "Rulebook",
 *         "ruleUrl": "/games/indonesia/rulebook/",
 *         "anchor": "setup",
 *         "title": "Setup",
 *         "url": "/games/indonesia/rulebook/#setup",
 *         "createdAt": 1729000000000
 *       }
 *     ]
 *   }
 */

export const STORAGE_KEY = "cardboard-appendix:bookmarks";
export const SCHEMA_VERSION = 1;

/**
 * Identity of a bookmark: one anchor, in one document, in one game.
 *
 * The expansion is part of it. A game's base rulebook and an expansion's
 * rulebook share a content-type slug and frequently share anchors too — Arcs
 * and The Blighted Reach both open with `#introduction` — so without this the
 * two are the same bookmark and toggling one toggles the other.
 *
 * Absent expansions collapse to an empty segment rather than "undefined", so
 * records saved before this existed keep the key they already had.
 */
function keyOf(bookmark) {
  const expansion = bookmark.expansionSlug || "";
  return `${bookmark.gameSlug}::${expansion}::${bookmark.ruleSlug}::${bookmark.anchor}`;
}

function isValid(bookmark) {
  return Boolean(
    bookmark &&
      typeof bookmark === "object" &&
      bookmark.gameSlug &&
      bookmark.ruleSlug &&
      bookmark.anchor &&
      bookmark.url,
  );
}

/**
 * Reads and repairs the stored payload.
 *
 * Storage is shared with other tabs and survives across releases, so anything
 * unreadable, unrecognised or from a future schema is treated as "no bookmarks"
 * rather than throwing — a corrupt entry must never break the page it is on.
 */
function read(storage) {
  if (!storage) return { schemaVersion: SCHEMA_VERSION, bookmarks: [] };

  let raw;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { schemaVersion: SCHEMA_VERSION, bookmarks: [] };
  }
  if (!raw) return { schemaVersion: SCHEMA_VERSION, bookmarks: [] };

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { schemaVersion: SCHEMA_VERSION, bookmarks: [] };
  }

  if (!parsed || typeof parsed !== "object") {
    return { schemaVersion: SCHEMA_VERSION, bookmarks: [] };
  }
  if (Number(parsed.schemaVersion) > SCHEMA_VERSION) {
    // Written by a newer version of the site. Leave it alone.
    return { schemaVersion: parsed.schemaVersion, bookmarks: [], readOnly: true };
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    bookmarks: Array.isArray(parsed.bookmarks) ? parsed.bookmarks.filter(isValid) : [],
  };
}

function write(storage, payload) {
  if (!storage || payload.readOnly) return false;
  try {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({ schemaVersion: SCHEMA_VERSION, bookmarks: payload.bookmarks }),
    );
    return true;
  } catch {
    // Private browsing, a full quota, or storage blocked outright. The page
    // keeps working; the bookmark simply does not persist.
    return false;
  }
}

/** Storage may be unavailable entirely, which must not throw on access. */
function defaultStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function createBookmarkStore({ storage = defaultStorage() } = {}) {
  const listeners = new Set();

  function notify() {
    for (const listener of listeners) listener();
  }

  return {
    /** Every bookmark, newest first; optionally filtered to one game. */
    list({ gameSlug } = {}) {
      const { bookmarks } = read(storage);
      const filtered = gameSlug ? bookmarks.filter((b) => b.gameSlug === gameSlug) : bookmarks;
      return [...filtered].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    },

    has(bookmark) {
      const wanted = keyOf(bookmark);
      return read(storage).bookmarks.some((b) => keyOf(b) === wanted);
    },

    /** Adds a bookmark, or leaves the existing one alone. Returns the record. */
    add(bookmark) {
      const payload = read(storage);
      const wanted = keyOf(bookmark);
      const existing = payload.bookmarks.find((b) => keyOf(b) === wanted);
      if (existing) return existing;

      const record = { ...bookmark, createdAt: Date.now() };
      payload.bookmarks.push(record);
      write(storage, payload);
      notify();
      return record;
    },

    /** Removes a bookmark. Returns true if one was actually removed. */
    remove(bookmark) {
      const payload = read(storage);
      const wanted = keyOf(bookmark);
      const next = payload.bookmarks.filter((b) => keyOf(b) !== wanted);
      if (next.length === payload.bookmarks.length) return false;

      payload.bookmarks = next;
      write(storage, payload);
      notify();
      return true;
    },

    /** Removes every bookmark. Returns true if there were any to remove. */
    clear() {
      const payload = read(storage);
      if (!payload.bookmarks.length) return false;
      payload.bookmarks = [];
      write(storage, payload);
      notify();
      return true;
    },

    /**
     * Subscribes to changes — both from this tab and, via the `storage` event,
     * from any other tab the reader has open. Returns an unsubscribe function.
     */
    subscribe(listener) {
      listeners.add(listener);
      const onStorage = (event) => {
        if (event.key === STORAGE_KEY || event.key === null) listener();
      };
      globalThis.addEventListener?.("storage", onStorage);
      return () => {
        listeners.delete(listener);
        globalThis.removeEventListener?.("storage", onStorage);
      };
    },
  };
}

/** The store every UI module shares. */
export const bookmarkStore = createBookmarkStore();
