/**
 * What is new, for the line under the home page's search field.
 *
 * A new game, a new feature, a fix worth knowing about — one line, and only
 * the most recent one is shown. It is the answer to "has anything happened
 * here since I last looked", which a reader cannot get from a shelf that is
 * sorted alphabetically and says nothing about when anything arrived.
 *
 * Edit `ENTRIES`. Newest first is not required — they are sorted here — and
 * every field but `url` is required:
 *
 *   date   ISO day. What it is sorted by, and what decides whether it has
 *          gone stale.
 *   tag    The pill. Two or three characters up to a short word: New, Update,
 *          Fixed. It is a category, not a sentence.
 *   text   One line, written as something that happened. It has to read as
 *          news at a glance and fit on a phone without wrapping to three
 *          lines — around eighty characters.
 *   url    Optional, and off for now. Where the news leads; the whole line
 *          becomes the link, with an arrow at the end of the sentence. Left
 *          out, the line is a statement — which is what most news here is,
 *          since a new feature is on every page and a new game is one of
 *          eighteen on the shelf below. Add it when a line has somewhere
 *          particular to send someone.
 *
 * Nothing shown means nothing has happened lately, which is the honest state
 * for a site between bursts of work. The window is deliberately short: a "New"
 * pill on something six months old is worse than no pill at all.
 */

const ENTRIES = [
  {
    date: "2026-09-13",
    tag: "New",
    text: "Favorite a game to keep it at the top of the shelf.",
  },
  {
    date: "2026-09-06",
    tag: "New",
    text: "My Reference gathers every section you bookmark onto one page.",
  },
  {
    date: "2026-08-28",
    tag: "Games",
    text: "Xia, Roads & Boats and Greed Incorporated join the shelf.",
  },
];

/*
 * How long a piece of news stays news.
 *
 * Not exported. Eleventy reads an ESM data file's named exports when it finds
 * any, and ignores the default one — so a stray `export` here quietly turns
 * this file into `{ FRESH_DAYS: 60 }` and the line disappears from the page
 * with no error anywhere.
 */
const FRESH_DAYS = 60;

function daysSince(date, now) {
  return (now - Date.parse(`${date}T00:00:00Z`)) / 86_400_000;
}

export default function () {
  const now = Date.now();
  const sorted = [...ENTRIES].sort((a, b) => b.date.localeCompare(a.date));
  const latest = sorted[0] || null;
  const age = latest ? daysSince(latest.date, now) : Infinity;

  return {
    entries: sorted,
    // Negative ages are a date typed in the future — show it rather than hide
    // it, so the mistake is visible to whoever made it.
    current: latest && age < FRESH_DAYS ? latest : null,
  };
}
