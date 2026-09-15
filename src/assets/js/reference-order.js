/**
 * The order a reader has put their own reference in.
 *
 * My Reference is assembled in rules order, which is the right answer until
 * somebody says otherwise — it needs no interface and it matches the book. This
 * is what "otherwise" is stored in: a list of section keys per game, written
 * the first time that game's page is reordered and absent until then.
 *
 * Absent is the important state. A game with no entry here is in rules order,
 * which is what every reader has today and what "Reset to rules order" returns
 * them to by deleting the entry rather than by writing a different one. There
 * is no such thing as a stored order that means "the default".
 *
 * Per game, because the page is per game. The keys are the same
 * `expansion::ruleSlug::anchor` that `my-reference.js` already stamps on every
 * section it builds — the game is the key of the list, so it is not repeated
 * inside it.
 *
 * Same rules as the other four stores: one module owns localStorage, the shape
 * is versioned and could be posted to an API unchanged, anything unreadable
 * reads as "no orders" rather than throwing, and a blocked or full store loses
 * the write rather than the page.
 *
 *   {
 *     "schemaVersion": 1,
 *     "orders": {
 *       "arcs": {
 *         "keys": ["::rulebook::setup", "the-blighted-reach::rulebook::act-i-setup"],
 *         "updatedAt": 1729000000000
 *       }
 *     }
 *   }
 */

export const STORAGE_KEY = "cardboard-appendix:reference-order";
export const SCHEMA_VERSION = 1;

/** A list of non-empty strings, deduplicated, or null if there is no list. */
function cleanKeys(value) {
  if (!Array.isArray(value)) return null;
  const seen = new Set();
  for (const key of value) {
    if (typeof key !== "string" || !key) continue;
    seen.add(key);
  }
  return seen.size ? [...seen] : null;
}

function read(storage) {
  const empty = { schemaVersion: SCHEMA_VERSION, orders: {} };
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
    return { schemaVersion: parsed.schemaVersion, orders: {}, readOnly: true };
  }

  const orders = {};
  const stored = parsed.orders && typeof parsed.orders === "object" ? parsed.orders : {};
  for (const [gameSlug, entry] of Object.entries(stored)) {
    const keys = cleanKeys(entry?.keys);
    if (!gameSlug || !keys) continue;
    orders[gameSlug] = { keys, updatedAt: Number(entry.updatedAt) || 0 };
  }

  return { schemaVersion: SCHEMA_VERSION, orders };
}

function write(storage, payload) {
  if (!storage || payload.readOnly) return false;
  try {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({ schemaVersion: SCHEMA_VERSION, orders: payload.orders }),
    );
    return true;
  } catch {
    // Private browsing, a full quota, or storage blocked. The order still
    // applies to this page; it just will not survive the next load.
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

export function createReferenceOrderStore({ storage = defaultStorage() } = {}) {
  const listeners = new Set();

  function notify() {
    for (const listener of listeners) listener();
  }

  return {
    /** The stored keys for one game, or null when it is in rules order. */
    get(gameSlug) {
      if (!gameSlug) return null;
      return read(storage).orders[gameSlug]?.keys || null;
    },

    has(gameSlug) {
      return Boolean(this.get(gameSlug));
    },

    /**
     * Records an order for one game.
     *
     * Takes the whole list rather than a move, because a move is only
     * meaningful against a list this store cannot see: the page knows which
     * sections exist and which of them are still bookmarked, and this knows
     * how to keep a string array alive across releases. Splitting it the other
     * way would put the page's rules in here.
     */
    set(gameSlug, keys) {
      const cleaned = cleanKeys(keys);
      if (!gameSlug || !cleaned) return false;

      const payload = read(storage);
      payload.orders[gameSlug] = { keys: cleaned, updatedAt: Date.now() };
      write(storage, payload);
      notify();
      return true;
    },

    /** Back to rules order: the absence of an entry, not a different one. */
    reset(gameSlug) {
      const payload = read(storage);
      if (!payload.orders[gameSlug]) return false;
      delete payload.orders[gameSlug];
      write(storage, payload);
      notify();
      return true;
    },

    /** Everything stored, as stored. */
    snapshot() {
      return { schemaVersion: SCHEMA_VERSION, orders: read(storage).orders };
    },

    /**
     * Folds an exported payload in, per game, keeping the newer order.
     *
     * The other stores merge sets — two devices' bookmarks are one reader's
     * bookmarks. An order is not a set: half of one device's order and half of
     * another's is an arrangement neither reader made, so a game is taken
     * whole from whichever side touched it last, and a game only one side has
     * comes across untouched.
     */
    merge(payload) {
      const incoming = payload?.orders && typeof payload.orders === "object" ? payload.orders : {};
      const current = read(storage);
      let changed = 0;

      for (const [gameSlug, entry] of Object.entries(incoming)) {
        const keys = cleanKeys(entry?.keys);
        if (!gameSlug || !keys) continue;

        const updatedAt = Number(entry.updatedAt) || 0;
        const existing = current.orders[gameSlug];
        if (existing && (existing.updatedAt || 0) >= updatedAt) continue;

        current.orders[gameSlug] = { keys, updatedAt };
        changed += 1;
      }

      if (!changed) return 0;
      write(storage, current);
      notify();
      return changed;
    },

    clear() {
      const payload = read(storage);
      if (!Object.keys(payload.orders).length) return false;
      payload.orders = {};
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
export const referenceOrderStore = createReferenceOrderStore();
