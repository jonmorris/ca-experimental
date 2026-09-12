/**
 * Games the reader has starred.
 *
 * The third thing this site remembers, and the only one the reader states
 * outright. Bookmarks say "this rule matters"; the history says "you were
 * here", which the site works out on their behalf. A favourite is neither
 * inferred nor scoped to a section: it is a reader naming the handful of games
 * they actually play, so those games stop being eighteenth on a shelf.
 *
 * Same rules as `bookmark-store.js` and `reading-history.js`: one module owns
 * localStorage, the shape is versioned and record-shaped so it could be posted
 * to an API unchanged, anything unreadable reads as "no favourites" rather than
 * throwing, and a blocked or full store loses the write rather than the page.
 *
 *   {
 *     "schemaVersion": 1,
 *     "games": [
 *       { "gameSlug": "arcs", "gameTitle": "Arcs", "gameUrl": "/games/arcs/",
 *         "addedAt": 1729000000000 }
 *     ]
 *   }
 */

export const STORAGE_KEY = "cardboard-appendix:favorites";
export const SCHEMA_VERSION = 1;

function isValid(entry) {
  return Boolean(entry && typeof entry === "object" && entry.gameSlug && entry.gameUrl);
}

function read(storage) {
  const empty = { schemaVersion: SCHEMA_VERSION, games: [] };
  if (!storage) return empty;

  let raw;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return empty;
  }
  if (!raw) return empty;

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return empty;
  }

  if (!parsed || typeof parsed !== "object") return empty;
  if (Number(parsed.schemaVersion) > SCHEMA_VERSION) {
    // Written by a newer version of the site. Leave it alone.
    return { schemaVersion: parsed.schemaVersion, games: [], readOnly: true };
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    games: Array.isArray(parsed.games) ? parsed.games.filter(isValid) : [],
  };
}

function write(storage, payload) {
  if (!storage || payload.readOnly) return false;
  try {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({ schemaVersion: SCHEMA_VERSION, games: payload.games }),
    );
    return true;
  } catch {
    return false;
  }
}

function defaultStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function createFavoriteStore({ storage = defaultStorage() } = {}) {
  const listeners = new Set();

  function notify() {
    for (const listener of listeners) listener();
  }

  return {
    /**
     * Every favourite, most recently added first.
     *
     * Newest first rather than alphabetical: the game somebody starred this
     * week is the one they are playing this week, and a list short enough to
     * read at a glance does not need sorting into an index.
     */
    list() {
      const { games } = read(storage);
      return [...games].sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
    },

    has(gameSlug) {
      return read(storage).games.some((game) => game.gameSlug === gameSlug);
    },

    add({ gameSlug, gameTitle, gameUrl } = {}) {
      if (!gameSlug || !gameUrl) return null;
      const payload = read(storage);
      const existing = payload.games.find((game) => game.gameSlug === gameSlug);
      if (existing) return existing;

      const record = {
        gameSlug,
        gameTitle: gameTitle || gameSlug,
        gameUrl,
        addedAt: Date.now(),
      };
      payload.games.push(record);
      write(storage, payload);
      notify();
      return record;
    },

    remove(gameSlug) {
      const payload = read(storage);
      const next = payload.games.filter((game) => game.gameSlug !== gameSlug);
      if (next.length === payload.games.length) return false;
      payload.games = next;
      write(storage, payload);
      notify();
      return true;
    },

    toggle(game) {
      if (this.has(game.gameSlug)) {
        this.remove(game.gameSlug);
        return false;
      }
      this.add(game);
      return true;
    },

    clear() {
      const payload = read(storage);
      if (!payload.games.length) return false;
      payload.games = [];
      write(storage, payload);
      notify();
      return true;
    },

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
export const favoriteStore = createFavoriteStore();
