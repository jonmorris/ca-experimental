/**
 * The searches a reader has run, most recent first.
 *
 * The fourth thing this site remembers, and the smallest: a list of strings.
 * It exists because a lookup at a table is rarely a one-off — the rule you
 * could not remember on turn three is the rule you cannot remember on turn
 * seven — and retyping "siap faji mergers" every time is the kind of friction
 * that makes people close the panel and go back to the PDF.
 *
 * Same rules as the other three stores: one module owns localStorage, the
 * shape is versioned and record-shaped, anything unreadable reads as "no
 * history" rather than throwing, and a blocked or full store loses the write
 * rather than the page.
 *
 *   {
 *     "schemaVersion": 1,
 *     "searches": [
 *       { "query": "siap faji", "searchedAt": 1729000000000 }
 *     ]
 *   }
 */

export const STORAGE_KEY = "cardboard-appendix:searches";
export const SCHEMA_VERSION = 1;

/**
 * How many are kept. Well past the four the panel shows at rest: the surplus
 * is what "show more" reveals, and what makes a search from last week findable
 * without making the panel a list of everything.
 */
export const MAX_SEARCHES = 12;

/** Shorter than this is a keystroke on the way somewhere, not a search. */
const MIN_LENGTH = 2;

function isValid(entry) {
  return Boolean(entry && typeof entry === "object" && typeof entry.query === "string" && entry.query);
}

/** Whitespace is not part of what was meant. */
function normalize(query) {
  return String(query ?? "").replace(/\s+/g, " ").trim();
}

function read(storage) {
  const empty = { schemaVersion: SCHEMA_VERSION, searches: [] };
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
    return { schemaVersion: parsed.schemaVersion, searches: [], readOnly: true };
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    searches: Array.isArray(parsed.searches) ? parsed.searches.filter(isValid) : [],
  };
}

function write(storage, payload) {
  if (!storage || payload.readOnly) return false;
  try {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({ schemaVersion: SCHEMA_VERSION, searches: payload.searches }),
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

export function createSearchHistory({ storage = defaultStorage() } = {}) {
  const listeners = new Set();

  function notify() {
    for (const listener of listeners) listener();
  }

  return {
    list({ limit } = {}) {
      const { searches } = read(storage);
      const sorted = [...searches].sort((a, b) => (b.searchedAt || 0) - (a.searchedAt || 0));
      return typeof limit === "number" ? sorted.slice(0, limit) : sorted;
    },

    /**
     * Remembers a search.
     *
     * Matched case-insensitively but stored as typed: "Siap Faji" and "siap
     * faji" are one entry, and the one kept is the most recent, because that is
     * the spelling the reader last chose.
     */
    record(query) {
      const text = normalize(query);
      if (text.length < MIN_LENGTH) return null;

      const payload = read(storage);
      const fold = text.toLowerCase();
      const record = { query: text, searchedAt: Date.now() };

      payload.searches = [record, ...payload.searches.filter((e) => e.query.toLowerCase() !== fold)]
        .slice(0, MAX_SEARCHES);

      write(storage, payload);
      notify();
      return record;
    },

    remove(query) {
      const fold = normalize(query).toLowerCase();
      const payload = read(storage);
      const next = payload.searches.filter((entry) => entry.query.toLowerCase() !== fold);
      if (next.length === payload.searches.length) return false;
      payload.searches = next;
      write(storage, payload);
      notify();
      return true;
    },

    /** Everything stored, as stored. */
    snapshot() {
      return { schemaVersion: SCHEMA_VERSION, searches: read(storage).searches };
    },

    /** Folds an exported payload in, keeping the later of a duplicate pair. */
    merge(payload) {
      const incoming = Array.isArray(payload?.searches) ? payload.searches.filter(isValid) : [];
      if (!incoming.length) return 0;

      const current = read(storage);
      const seen = new Map(current.searches.map((e) => [e.query.toLowerCase(), e]));
      let added = 0;

      for (const entry of incoming) {
        const fold = entry.query.toLowerCase();
        const existing = seen.get(fold);
        if (existing) {
          if ((entry.searchedAt || 0) > (existing.searchedAt || 0)) seen.set(fold, entry);
          continue;
        }
        seen.set(fold, entry);
        added += 1;
      }

      current.searches = [...seen.values()]
        .sort((a, b) => (b.searchedAt || 0) - (a.searchedAt || 0))
        .slice(0, MAX_SEARCHES);
      write(storage, current);
      notify();
      return added;
    },

    clear() {
      const payload = read(storage);
      if (!payload.searches.length) return false;
      payload.searches = [];
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
export const searchHistory = createSearchHistory();
