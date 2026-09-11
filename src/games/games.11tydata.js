import { slugify } from "../../lib/slugify.js";
import { NON_CONTENT_DIRS } from "../../lib/content-types.js";

/**
 * Directory data for everything under `src/games/`.
 *
 * Every in-game page gets its game context, its layout and — critically — its
 * permalink from here. Permalinks are computed from the file's own path rather
 * than left to Eleventy's default routing, so the URL contract lives in exactly
 * one place instead of being restated in every file's frontmatter.
 *
 * None of these computed values read their own key back off `data`: a computed
 * property that references itself is a circular dependency, and Eleventy
 * resolves it by quietly falling back to the default. Where a frontmatter value
 * should win, it is read through the game registry (which parses the same
 * frontmatter) instead.
 */

const GAMES_SEGMENT = /[/\\]games[/\\]/;

/** Splits `src/games/arcs/the-blighted-reach/rulebook.md` into its parts. */
function parsePath(inputPath = "") {
  const parts = String(inputPath).split(GAMES_SEGMENT);
  if (parts.length < 2) return null;

  const segments = parts[1].split(/[/\\]/).filter(Boolean);
  const gameSlug = segments.shift();
  if (!gameSlug) return null;

  const file = segments.pop() || "";
  const dirs = segments;

  return {
    gameSlug: slugify(gameSlug),
    dirs,
    file,
    fileSlug: slugify(file.replace(/\.[^.]+$/, "")),
    isPrivate: dirs.some((dir) => dir === "_source" || dir === "_working"),
    expansionSlug: dirs.length && !NON_CONTENT_DIRS.has(dirs[0]) ? slugify(dirs[0]) : null,
  };
}

function isLanding(parsed) {
  return parsed.dirs.length === 0 && parsed.fileSlug === "landing";
}

/** The registry record for the content type this page renders, if any. */
function findContentType(data) {
  const parsed = parsePath(data.page?.inputPath);
  if (!parsed || isLanding(parsed)) return null;
  const game = data.games?.[parsed.gameSlug];
  if (!game) return null;
  return (
    game.allContentTypes.find(
      (type) =>
        type.slug === parsed.fileSlug && (type.expansionSlug || null) === parsed.expansionSlug,
    ) || null
  );
}

export default {
  eleventyComputed: {
    gameSlug: (data) => parsePath(data.page?.inputPath)?.gameSlug || null,

    expansionSlug: (data) => parsePath(data.page?.inputPath)?.expansionSlug || null,

    game: (data) => {
      const slug = parsePath(data.page?.inputPath)?.gameSlug;
      return (slug && data.games?.[slug]) || null;
    },

    /** The expansion record this page belongs to, or null for base content. */
    expansion: (data) => {
      const parsed = parsePath(data.page?.inputPath);
      if (!parsed?.expansionSlug) return null;
      const game = data.games?.[parsed.gameSlug];
      return game?.expansions.find((e) => e.slug === parsed.expansionSlug) || null;
    },

    /** Nav label, section list, glossary terms, index entries, anchor aliases. */
    contentType: findContentType,

    contentTypeSlug: (data) => {
      const parsed = parsePath(data.page?.inputPath);
      if (!parsed) return null;
      return isLanding(parsed) ? "landing" : parsed.fileSlug;
    },

    layout: (data) => {
      const parsed = parsePath(data.page?.inputPath);
      if (!parsed || parsed.isPrivate) return undefined;
      if (isLanding(parsed)) return "layouts/landing.njk";
      // `contentType.layout` is the file's own `layout` frontmatter when it set
      // one, and the content type's default otherwise.
      return findContentType(data)?.layout;
    },

    title: (data) => {
      const parsed = parsePath(data.page?.inputPath);
      if (!parsed) return undefined;
      if (isLanding(parsed)) return data.games?.[parsed.gameSlug]?.title;
      return findContentType(data)?.title;
    },

    permalink: (data) => {
      const parsed = parsePath(data.page?.inputPath);
      if (!parsed) return undefined;

      // `_source/` and `_working/` are never published.
      if (parsed.isPrivate) return false;

      /*
       * A hidden game has no pages at all. The registry drops it, so nothing
       * links to it, but pages come from files rather than from the registry —
       * without this a game marked hidden still publishes every URL it has.
       */
      if (!data.games?.[parsed.gameSlug]) return false;

      if (isLanding(parsed)) return `/games/${parsed.gameSlug}/`;

      const prefix = parsed.expansionSlug ? `${parsed.expansionSlug}/` : "";
      return `/games/${parsed.gameSlug}/${prefix}${parsed.fileSlug}/`;
    },

    eleventyExcludeFromCollections: (data) => {
      const parsed = parsePath(data.page?.inputPath);
      return Boolean(parsed?.isPrivate) || !data.games?.[parsed?.gameSlug];
    },
  },
};
