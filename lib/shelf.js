/**
 * Parsing the shelf's human-written numbers, and the shelf's own vocabulary.
 *
 * Player counts and playing times are written for people — "2–5", "180–240
 * minutes" — which is right on a game's page and useless to a slider. They are
 * turned into numbers once, at build time, so the browser never sees a string
 * it has to understand and the parsing lives next to the data rather than in
 * the UI.
 */

/** "2–5", "1-4", "3", "180–240 minutes" → { min, max }. Any dash, any words. */
export function parseRange(value) {
  const numbers = String(value ?? "").match(/\d+/g);
  if (!numbers?.length) return null;
  const parsed = numbers.map(Number);
  return { min: Math.min(...parsed), max: Math.max(...parsed) };
}

/** The step a time slider moves in. Half an hour is how people think in games. */
export const TIME_STEP = 30;

const floorTo = (value, step) => Math.floor(value / step) * step;
const ceilTo = (value, step) => Math.ceil(value / step) * step;

/**
 * The bounds of the sliders, taken from the catalogue rather than from
 * constants: they should cover exactly the games there are, and keep covering
 * them when a one-hour game or a six-hour one arrives without anybody
 * remembering to widen a range.
 */
export function shelfBounds(games) {
  const players = games.map((game) => parseRange(game.meta?.players)).filter(Boolean);
  const times = games.map((game) => parseRange(game.meta?.time)).filter(Boolean);

  return {
    players: {
      min: players.length ? Math.min(...players.map((r) => r.min)) : 1,
      max: players.length ? Math.max(...players.map((r) => r.max)) : 8,
      step: 1,
    },
    /*
     * Rounded outwards to the step, so both ends are reachable: a catalogue
     * whose shortest game is 45 minutes would otherwise have a lower bound the
     * handle could never land on.
     */
    time: {
      min: times.length ? floorTo(Math.min(...times.map((r) => r.min)), TIME_STEP) : 0,
      max: times.length ? ceilTo(Math.max(...times.map((r) => r.max)), TIME_STEP) : 240,
      step: TIME_STEP,
    },
  };
}

/**
 * Every publisher on the shelf, once each, in alphabetical order.
 *
 * Taken from the catalogue rather than from a list kept somewhere, for the
 * reason the slider bounds are: a house that arrives with a new game should
 * appear in the filter without anybody remembering to add it, and one whose
 * last game leaves should stop being offered as a way to find nothing.
 *
 * `meta.publishers` is already split into credits — a game published by two
 * houses belongs under both — so a game can match more than one entry here.
 *
 * Each entry is `{ key, label }` and not `{ slug, label }`, because this list
 * exists to be a menu: the key is the publisher's slug, which is what the
 * tiles carry and therefore what the filter compares, and calling it that is
 * what lets the shelf's two menus be one piece of markup.
 */
export function shelfPublishers(games) {
  const seen = new Map();
  for (const game of games) {
    for (const publisher of game.meta?.publishers || []) {
      if (!seen.has(publisher.slug)) seen.set(publisher.slug, publisher.label);
    }
  }

  return [...seen]
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
