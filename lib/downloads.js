import { statSync } from "node:fs";
import { join } from "node:path";

/**
 * The files a game offers: original PDFs, and anything made for this site.
 *
 * Two kinds of entry, and they are told apart by which key they carry rather
 * than by a `type` the author has to remember:
 *
 *   { "file": "downloads/arcs-rulebook.pdf" }   a file in the game's own
 *                                               `downloads/` directory
 *   { "url": "https://ledergames.com/…" }       somebody else's copy
 *
 * Everything a reader is told about a local file — its format and its size —
 * is measured here rather than typed into `game.json`. A hand-written "12 MB"
 * is a number that goes stale the first time the file is replaced, and the
 * failure is silent: the page keeps saying what it said last year. For a file
 * on another host there is nothing to measure, so the author may state a size
 * and format and both are optional.
 */

/** 12_400_000 → "12.4 MB", the way a file manager counts. */
function formatSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  const units = ["bytes", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit += 1;
  }
  if (unit === 0) return `${Math.round(value)} bytes`;
  // A decimal up to three figures: "12.4 MB" is the fact worth having about a
  // rulebook PDF, and "12 MB" throws it away to save one character.
  return `${value < 100 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

/*
 * Said once per problem, however many times the registry is built.
 *
 * Eleventy builds it per data file and again for the shortcode fallback, so a
 * single missing PDF reported itself six times — which reads as six faults and
 * trains the eye to skip the whole class of message.
 */
const warned = new Set();
function warnOnce(message) {
  if (warned.has(message)) return;
  warned.add(message);
  console.warn(message);
}

/** "arcs-rulebook.pdf" → "PDF". */
function formatOf(path) {
  const extension = /\.([a-z0-9]+)(?:[?#]|$)/i.exec(String(path))?.[1];
  return extension ? extension.toUpperCase() : "";
}

/**
 * Normalises one game's `downloads` array.
 *
 * An entry whose file is not on disk is dropped with a warning rather than
 * rendered: a download that 404s is worse than a download that is not offered,
 * and the build is the only place that can tell the difference. The warning is
 * not a build failure for the same reason a missing cross-reference is not —
 * the site should still come up while somebody finds the file.
 */
export function normalizeDownloads(entries, { gameSlug, gameDir }) {
  if (!Array.isArray(entries)) return [];

  const out = [];
  for (const entry of entries) {
    if (!entry || !entry.title) continue;
    const title = String(entry.title).trim();
    const note = String(entry.note || "").trim();

    if (entry.file) {
      // Always inside the game's own directory: the path is data, and data
      // that can climb out of its directory is a way to publish anything.
      const name = String(entry.file).replace(/^\/+/, "").replace(/^downloads\//, "");
      if (!name || name.includes("..") || name.includes("/")) {
        warnOnce(`[downloads] "${title}" in ${gameSlug} — "${entry.file}" is not a plain filename in downloads/`);
        continue;
      }

      let bytes = 0;
      try {
        bytes = statSync(join(gameDir, "downloads", name)).size;
      } catch {
        warnOnce(`[downloads] "${title}" in ${gameSlug} — downloads/${name} is not there, so it is not offered`);
        continue;
      }

      out.push({
        title,
        note,
        url: `/games/${gameSlug}/downloads/${name}`,
        external: false,
        format: formatOf(name),
        size: formatSize(bytes),
        bytes,
      });
      continue;
    }

    if (entry.url) {
      out.push({
        title,
        note,
        url: String(entry.url),
        external: true,
        format: String(entry.format || formatOf(entry.url)).toUpperCase(),
        size: String(entry.size || "").trim(),
        bytes: 0,
      });
      continue;
    }

    warnOnce(`[downloads] "${title}" in ${gameSlug} — has neither a file nor a url`);
  }

  return out;
}
