/**
 * Reading preferences.
 *
 * The same shape and discipline as `bookmark-store.js`: a versioned payload
 * under one key, defensive reads, and a narrow interface that is the only
 * thing any UI touches. Swapping localStorage for a synced backend later is a
 * change to this file alone.
 *
 * Every preference is applied as an attribute on <html>, so the CSS cascade
 * does all the work and no script ever writes a style property.
 */

export const STORAGE_KEY = "cardboard-appendix:preferences";
export const SCHEMA_VERSION = 1;

/**
 * The full set of preferences, their allowed values and their defaults.
 *
 * `attribute` is what gets written to the root element. A value of `system`
 * or `default` writes nothing, so the stylesheet's own default applies and
 * the OS setting is respected — that is why those are absent rather than
 * spelled out in the markup.
 */
export const PREFERENCES = {
  theme: {
    attribute: "data-theme",
    values: ["system", "light", "dark"],
    default: "system",
    implicit: "system",
    label: "Theme",
  },
  density: {
    attribute: "data-density",
    values: ["compact", "comfortable", "spacious"],
    default: "comfortable",
    implicit: "comfortable",
    label: "Text size",
  },
  /*
   * No "Default" option: each design nominates a body face, and in the shipped
   * one that face is the serif — so "Default" and "Serif" were two labels for
   * one outcome.
   *
   * Deliberately no `implicit` either. An implicit value writes no attribute
   * and so falls through to whatever the design nominated, which is only the
   * same thing by coincidence: the precision direction nominates the sans, and
   * a reader who picked "Serif" there would have been given sans. The design's
   * choice still applies with JavaScript off, when no attribute is written at
   * all.
   */
  face: {
    attribute: "data-face",
    values: ["serif", "sans"],
    default: "serif",
    label: "Typeface",
  },
  /*
   * Line spacing rather than line width. Every reading app that offers text
   * controls has this one — Kindle, Kobo, Apple Books, Play Books, Instapaper,
   * Reader — while a width control is something only the wide-screen ones
   * carry, and both Instapaper and Readwise Reader drop it on a phone for want
   * of room to give away. At a table, on a phone, it would have been a control
   * that did nothing.
   */
  spacing: {
    attribute: "data-spacing",
    values: ["tight", "normal", "relaxed"],
    default: "normal",
    implicit: "normal",
    label: "Line spacing",
  },
};

export function defaultPreferences() {
  return Object.fromEntries(
    Object.entries(PREFERENCES).map(([key, spec]) => [key, spec.default]),
  );
}

function defaultStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * Reads and repairs the stored payload. Anything unreadable, unrecognised or
 * from a future schema is treated as "no preferences" rather than throwing —
 * a corrupt entry must never break the page it is on.
 */
function read(storage) {
  const fallback = { values: defaultPreferences(), readOnly: false };
  if (!storage) return fallback;

  let raw;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return fallback;
  }
  if (!raw) return fallback;

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return fallback;
  }
  if (!parsed || typeof parsed !== "object") return fallback;

  // Written by a newer version of the site. Read it, but never overwrite it.
  if (Number(parsed.schemaVersion) > SCHEMA_VERSION) {
    return { values: defaultPreferences(), readOnly: true };
  }

  const values = defaultPreferences();
  const stored = parsed.preferences;
  if (stored && typeof stored === "object") {
    for (const [key, spec] of Object.entries(PREFERENCES)) {
      if (spec.values.includes(stored[key])) values[key] = stored[key];
    }
  }
  return { values, readOnly: false };
}

function write(storage, payload) {
  if (!storage || payload.readOnly) return false;
  try {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({ schemaVersion: SCHEMA_VERSION, preferences: payload.values }),
    );
    return true;
  } catch {
    // Private browsing, a full quota, or storage blocked. The choice still
    // applies to this page; it just will not persist.
    return false;
  }
}

/** Writes the current preferences onto the root element. */
export function applyPreferences(values, root = document.documentElement) {
  for (const [key, spec] of Object.entries(PREFERENCES)) {
    const value = values[key];
    if (!value || value === spec.implicit) root.removeAttribute(spec.attribute);
    else root.setAttribute(spec.attribute, value);
  }
}

export function createPreferencesStore({ storage = defaultStorage() } = {}) {
  const listeners = new Set();

  function current() {
    return read(storage).values;
  }

  return {
    /** Every preference, with defaults filled in. */
    all: current,

    get(key) {
      return current()[key];
    },

    /** Sets one preference, applies it to the document, and notifies. */
    set(key, value) {
      const spec = PREFERENCES[key];
      if (!spec || !spec.values.includes(value)) return current();

      const payload = read(storage);
      payload.values[key] = value;
      write(storage, payload);
      applyPreferences(payload.values);
      for (const listener of listeners) listener(payload.values);
      return payload.values;
    },

    /** Returns everything to its default. */
    reset() {
      const payload = { values: defaultPreferences(), readOnly: read(storage).readOnly };
      write(storage, payload);
      applyPreferences(payload.values);
      for (const listener of listeners) listener(payload.values);
      return payload.values;
    },

    /**
     * Subscribes to changes, including from another tab. Returns an
     * unsubscribe function.
     */
    subscribe(listener) {
      listeners.add(listener);
      const onStorage = (event) => {
        if (event.key !== STORAGE_KEY && event.key !== null) return;
        const values = current();
        applyPreferences(values);
        listener(values);
      };
      globalThis.addEventListener?.("storage", onStorage);
      return () => {
        listeners.delete(listener);
        globalThis.removeEventListener?.("storage", onStorage);
      };
    },
  };
}

export const preferences = createPreferencesStore();
