/**
 * What the reader has opened, most recent first.
 *
 * One record per game, not per page: a game is the unit somebody comes back
 * to. Where they were inside it — which document, which section — rides along
 * on the record, so "Indonesia" can become "Indonesia · Rulebook · Mergers"
 * later without anyone's history having to start over. A history cannot be
 * backfilled, so it is written in full from the first day even though the home
 * page shows only part of it.
 *
 * Built to the same rules as `bookmark-store.js`, and for the same reason: one
 * module owns localStorage, the stored shape is versioned and record-shaped,
 * and anything unreadable is treated as "no history" rather than thrown. The
 * two differ in one way that matters — a bookmark is something the reader
 * chose to keep, and this is something the site wrote down on their behalf, so
 * this one has to be easy to erase.
 *
 *   {
 *     "schemaVersion": 1,
 *     "games": [
 *       {
 *         "gameSlug": "indonesia",
 *         "gameTitle": "Indonesia",
 *         "gameUrl": "/games/indonesia/",
 *         "visitedAt": 1729000000000,
 *         "lastDocument": {
 *           "ruleSlug": "rulebook",
 *           "ruleTitle": "Rulebook",
 *           "expansionSlug": "",
 *           "expansionTitle": "",
 *           "url": "/games/indonesia/rulebook/",
 *           "sectionAnchor": "mergers",
 *           "sectionTitle": "Mergers"
 *         }
 *       }
 *     ]
 *   }
 */

export const STORAGE_KEY = "cardboard-appendix:history";
export const SCHEMA_VERSION = 1;

/**
 * How many games are kept. Well past what the home page shows: the surplus is
 * what makes a fuller history possible later without losing the months before
 * it was built.
 */
export const MAX_GAMES = 12;

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
    // Private browsing, a full quota, or storage blocked outright. The page
    // keeps working; the visit simply is not remembered.
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

export function createHistoryStore({ storage = defaultStorage() } = {}) {
  const listeners = new Set();

  function notify() {
    for (const listener of listeners) listener();
  }

  return {
    /** Every game the reader has opened, most recent first. */
    list({ limit } = {}) {
      const { games } = read(storage);
      const sorted = [...games].sort((a, b) => (b.visitedAt || 0) - (a.visitedAt || 0));
      return typeof limit === "number" ? sorted.slice(0, limit) : sorted;
    },

    /**
     * Records a visit, moving the game to the front.
     *
     * `document` is optional and merged rather than replaced. Landing on a
     * game's overview is a visit to the game, but it is not a place inside it,
     * and it should not wipe out the chapter the reader was actually in.
     * Passing a document with no section does clear the section, though: that
     * is the reader opening the document afresh at the top.
     */
    record({ gameSlug, gameTitle, gameUrl, document: doc } = {}) {
      if (!gameSlug || !gameUrl) return null;

      const payload = read(storage);
      const existing = payload.games.find((game) => game.gameSlug === gameSlug);

      const entry = {
        ...existing,
        gameSlug,
        gameTitle: gameTitle || existing?.gameTitle || gameSlug,
        gameUrl,
        visitedAt: Date.now(),
      };
      if (doc) entry.lastDocument = { ...doc };

      payload.games = [entry, ...payload.games.filter((game) => game.gameSlug !== gameSlug)]
        .sort((a, b) => (b.visitedAt || 0) - (a.visitedAt || 0))
        .slice(0, MAX_GAMES);

      write(storage, payload);
      notify();
      return entry;
    },

    /**
     * Notes the section the reader has jumped to inside the document they are
     * already recorded as reading. A no-op if that document is not the one on
     * the front of the record, so a stale hashchange cannot rewrite history.
     */
    recordSection({ gameSlug, url, anchor, title } = {}) {
      if (!gameSlug || !url || !anchor) return null;

      const payload = read(storage);
      const entry = payload.games.find((game) => game.gameSlug === gameSlug);
      if (!entry?.lastDocument || entry.lastDocument.url !== url) return null;

      entry.lastDocument = { ...entry.lastDocument, sectionAnchor: anchor, sectionTitle: title || "" };
      entry.visitedAt = Date.now();
      write(storage, payload);
      notify();
      return entry;
    },

    /** Everything stored, as stored. */
    snapshot() {
      return { schemaVersion: SCHEMA_VERSION, games: read(storage).games };
    },

    /**
     * Folds an exported payload in.
     *
     * A history is about when, so a game on both sides keeps the *later*
     * visit — the opposite of bookmarks and favourites, where the earlier
     * record is the truer one because it is when the reader decided.
     */
    merge(payload) {
      const incoming = Array.isArray(payload?.games) ? payload.games.filter(isValid) : [];
      if (!incoming.length) return 0;

      const current = read(storage);
      const seen = new Map(current.games.map((game) => [game.gameSlug, game]));
      let added = 0;

      for (const game of incoming) {
        const existing = seen.get(game.gameSlug);
        if (existing) {
          if ((game.visitedAt || 0) > (existing.visitedAt || 0)) seen.set(game.gameSlug, game);
          continue;
        }
        seen.set(game.gameSlug, game);
        added += 1;
      }

      current.games = [...seen.values()]
        .sort((a, b) => (b.visitedAt || 0) - (a.visitedAt || 0))
        .slice(0, MAX_GAMES);
      write(storage, current);
      notify();
      return added;
    },

    /** Forgets everything. The reader's own record is theirs to erase. */
    clear() {
      const payload = read(storage);
      if (!payload.games.length) return false;
      payload.games = [];
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
export const historyStore = createHistoryStore();
