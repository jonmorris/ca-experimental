import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";

import { slugify, titleFromSlug } from "./slugify.js";
import { parseCredits } from "./related.js";
import { contentTypeDefaults, NON_CONTENT_DIRS } from "./content-types.js";
import { parseHeadings } from "./headings.js";
import { normalizeDownloads } from "./downloads.js";

export const GAMES_DIR = join(process.cwd(), "src", "games");

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function listDir(path) {
  try {
    return readdirSync(path, { withFileTypes: true });
  } catch {
    return [];
  }
}

function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  const seen = new Set();
  const out = [];
  for (const tag of tags) {
    const slug = slugify(typeof tag === "string" ? tag : tag?.slug || tag?.label);
    const label = String(
      (typeof tag === "string" ? tag : tag?.label || tag?.slug) || "",
    ).trim();
    if (!slug || !label || seen.has(slug)) continue;
    seen.add(slug);
    out.push({ slug, label });
  }
  return out;
}

function normalizeGlossary(terms) {
  if (!Array.isArray(terms)) return [];
  return terms
    .filter((t) => t && t.term)
    .map((t) => ({
      term: String(t.term).trim(),
      slug: slugify(t.slug || t.term),
      short: String(t.short || "").trim(),
      long: String(t.long || "").trim(),
      aliases: Array.isArray(t.aliases) ? t.aliases.map((a) => slugify(a)).filter(Boolean) : [],
    }))
    .sort((a, b) => a.term.localeCompare(b.term, "en", { sensitivity: "base" }));
}

function normalizeIndexEntries(entries) {
  if (!Array.isArray(entries)) return [];
  return entries
    .filter((entry) => entry && entry.term)
    .map((entry) => ({
      term: String(entry.term).trim(),
      refs: (Array.isArray(entry.refs) ? entry.refs : [])
        .filter((ref) => ref && ref.rule)
        .map((ref) => ({
          rule: String(ref.rule).trim(),
          anchor: ref.anchor ? slugify(ref.anchor) : "",
          label: String(ref.label || "").trim(),
        })),
    }))
    .sort((a, b) => a.term.localeCompare(b.term, "en", { sensitivity: "base" }));
}

function normalizeAliases(aliases) {
  // Accepts either { "old-anchor": "new-anchor" } or [{ from, to }].
  const out = [];
  if (Array.isArray(aliases)) {
    for (const alias of aliases) {
      const from = slugify(alias?.from);
      const to = slugify(alias?.to);
      if (from && to) out.push({ from, to });
    }
  } else if (aliases && typeof aliases === "object") {
    for (const [from, to] of Object.entries(aliases)) {
      const f = slugify(from);
      const t = slugify(to);
      if (f && t) out.push({ from: f, to: t });
    }
  }
  return out;
}

/**
 * Reads one content file into a content-type descriptor.
 *
 * Everything a template or the nav needs comes from here, so no template ever
 * has to know which game or which content type it is rendering.
 */
function readContentType({ file, typeSlug, dir, urlBase, scope, expansionSlug }) {
  const raw = readFileSync(join(dir, file), "utf8");
  const { data, content } = matter(raw);
  const defaults = contentTypeDefaults(typeSlug);
  const headings = parseHeadings(content);
  const sections = headings.filter((heading) => heading.level === 2);

  return {
    slug: typeSlug,
    scope,
    expansionSlug: expansionSlug || null,
    file,
    label: String(data.navLabel || data.title || defaults.label),
    title: String(data.title || defaults.label),
    subhead: String(data.subhead || ""),
    layout: String(data.layout || defaults.layout),
    order: Number.isFinite(data.navOrder) ? Number(data.navOrder) : defaults.order,
    bookmarkable: data.bookmarkable === undefined ? defaults.bookmarkable : Boolean(data.bookmarkable),
    /*
     * Whether this document is the publisher's own text.
     *
     * Opt-in per file and never inferred from the type slug: the mark is a
     * claim about who wrote the words, and a content type is only a filename.
     * A `strategy-primer.md` written here and a `players-book.md` transcribed
     * from the box both land on the generic type, so a default would either
     * miss the second or put the publisher's name on the first — and of the
     * two mistakes, claiming a document is official when it is ours is the
     * one that costs a reader something.
     */
    official: Boolean(data.official),
    url: `${urlBase}${typeSlug}/`,
    sections,
    headings,
    glossary: typeSlug === "glossary" ? normalizeGlossary(data.terms) : [],
    entries: typeSlug === "index" ? normalizeIndexEntries(data.entries) : [],
    anchorAliases: normalizeAliases(data.anchorAliases),
  };
}

function readContentTypes({ dir, urlBase, scope, expansionSlug }) {
  return listDir(dir)
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md") && !entry.name.startsWith("_"))
    .map((entry) =>
      readContentType({
        file: entry.name,
        typeSlug: slugify(entry.name.replace(/\.md$/, "")),
        dir,
        urlBase,
        scope,
        expansionSlug,
      }),
    )
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
}

/** The reader's own page: a content type with no file and no sections. */
function myReferenceType(urlBase) {
  const defaults = contentTypeDefaults("my-reference");
  return {
    slug: "my-reference",
    scope: "base",
    expansionSlug: null,
    file: null,
    synthetic: true,
    label: defaults.label,
    title: defaults.label,
    /*
     * The card on a game's overview is where somebody meets this page before
     * there is anything on it, so the line has to say what it is for rather
     * than what it contains — which, until they have bookmarked something, is
     * nothing.
     */
    subhead: "The sections you bookmark, gathered onto one page.",
    layout: defaults.layout,
    order: defaults.order,
    bookmarkable: false,
    official: false,
    url: `${urlBase}my-reference/`,
    // Filled in the browser, from bookmarks this build cannot see.
    sections: [],
    headings: [],
    glossary: [],
    entries: [],
    anchorAliases: [],
  };
}

function readExpansions(gameDir, gameSlug, meta) {
  const overrides = meta.expansions && typeof meta.expansions === "object" ? meta.expansions : {};

  return listDir(gameDir)
    .filter((entry) => entry.isDirectory() && !NON_CONTENT_DIRS.has(entry.name))
    .map((entry) => {
      const slug = slugify(entry.name);
      const dir = join(gameDir, entry.name);
      const urlBase = `/games/${gameSlug}/${slug}/`;
      const contentTypes = readContentTypes({
        dir,
        urlBase,
        scope: "expansion",
        expansionSlug: slug,
      });
      const override = overrides[entry.name] || overrides[slug] || {};
      const title = String(override.title || titleFromSlug(slug));

      /*
       * An expansion of one document *is* that document.
       *
       * The Blighted Reach is a rulebook and nothing else, so a page titled
       * "Rulebook" under a breadcrumb reading The Blighted Reach, in a nav
       * where "Rulebook" sits under a heading reading The Blighted Reach, is
       * the expansion's name said three times to introduce a page that never
       * had a name of its own. The document takes the expansion's name and the
       * surfaces that would then repeat it drop their copy.
       *
       * Decided here rather than in each template so they cannot disagree
       * about it, and by counting rather than by a flag in `game.json`: an
       * expansion that grows a second document stops being one thing on the
       * build that adds it, with nothing to remember to change.
       */
      const single = contentTypes.length === 1;
      if (single) contentTypes[0] = { ...contentTypes[0], label: title, title };

      return {
        slug,
        dirName: entry.name,
        title,
        released: String(override.released || ""),
        url: urlBase,
        single,
        contentTypes,
      };
    })
    .filter((expansion) => expansion.contentTypes.length > 0)
    .sort((a, b) => String(a.released).localeCompare(String(b.released)) || a.title.localeCompare(b.title));
}

function buildGame(gameSlug, gameDir) {
  const meta = readJson(join(gameDir, "game.json")) || readJson(join(gameDir, "game.yml"));
  if (!meta) return null;

  meta.tags = normalizeTags(meta.tags);

  /*
   * Credits as data, beside the credits as prose. `designer` and `publisher`
   * are authored as sentences and rendered as sentences; these are the same
   * names split into comparable slugs, which is what the related-games row on
   * every overview ranks by. Nothing renders them and `game.json` never
   * carries them — see `lib/related.js`.
   */
  meta.designers = parseCredits(meta.designer);
  meta.publishers = parseCredits(meta.publisher);

  const url = `/games/${gameSlug}/`;
  const contentTypes = readContentTypes({ dir: gameDir, urlBase: url, scope: "base" });
  const downloads = normalizeDownloads(meta.downloads, { gameSlug, gameDir });
  const expansions = readExpansions(gameDir, gameSlug, meta);

  /*
   * My Reference is synthesised, not authored. A file per game would be
   * eighteen files that say nothing, and `sync-content.mjs` rewrites game
   * directories wholesale from upstream — so it would have to learn to preserve
   * them, and would eventually fail to. Nothing to maintain this way.
   */
  contentTypes.unshift(myReferenceType(url));

  const glossaryType = contentTypes.find((type) => type.slug === "glossary");
  const rulebookType = contentTypes.find((type) => type.slug === "rulebook");

  const allContentTypes = [
    ...contentTypes,
    ...expansions.flatMap((expansion) => expansion.contentTypes),
  ];

  return {
    slug: gameSlug,
    url,
    meta,
    title: String(meta.title || titleFromSlug(gameSlug)),
    visibility: visibilityOf(meta),
    contentTypes,
    expansions,
    allContentTypes,
    /*
     * Files rather than pages, so they sit beside `contentTypes` rather than
     * in it: nothing navigates to a download, nothing bookmarks one, and the
     * palette has nothing to index. The overview page is the only thing that
     * reads this.
     */
    downloads,
    // `{% term %}` and `{% rule %}` resolve against the base game's glossary
    // and rulebook, so they are hoisted for cheap lookup. `rules` carries every
    // heading — a cross-reference is often to a sub-section — while `sections`
    // stays H2-only, because that is what drives TOCs, bookmarks and prev/next.
    glossary: glossaryType ? glossaryType.glossary : [],
    rules: rulebookType ? rulebookType.headings : [],
    ruleSections: rulebookType ? rulebookType.sections : [],
    hasGlossary: Boolean(glossaryType),
    hasRulebook: Boolean(rulebookType),
  };
}

/** Builds the whole game registry by scanning `src/games/`. */
/**
 * How much of the site a game appears in, from its `site_visibility`.
 *
 *   listed     the default — on the shelf and everywhere else
 *   unlisted   its pages build and its URLs work, but it is off the shelf
 *   hidden     not built at all
 *
 * Two different reasons to hold a game back, and collapsing them would serve
 * neither: a game whose rules are still being written should have no pages at
 * all, while one that is finished but not ready to announce needs working URLs
 * to share.
 */
export function visibilityOf(meta) {
  const value = String(meta?.site_visibility || "listed").toLowerCase();
  return ["listed", "unlisted", "hidden"].includes(value) ? value : "listed";
}

export function buildGames() {
  const games = {};
  for (const entry of listDir(GAMES_DIR)) {
    if (!entry.isDirectory()) continue;
    const gameDir = join(GAMES_DIR, entry.name);
    if (!statSync(gameDir).isDirectory()) continue;
    const gameSlug = slugify(entry.name);
    const game = buildGame(gameSlug, gameDir);
    if (!game) continue;
    // Hidden games are dropped here rather than filtered later, so nothing
    // downstream — pages, nav, the palette index, the link checker — has to
    // remember they exist.
    if (game.visibility === "hidden") continue;
    games[gameSlug] = game;
  }
  return games;
}

/** The games the shelf shows: everything the reader is meant to browse to. */
export function listedGames(games = buildGames()) {
  return Object.fromEntries(
    Object.entries(games).filter(([, game]) => game.visibility === "listed"),
  );
}

/** Flattens every glossary term across every game, for term-page pagination. */
export function allGlossaryTerms(games) {
  const out = [];
  for (const game of Object.values(games)) {
    for (const term of game.glossary) {
      out.push({
        ...term,
        gameSlug: game.slug,
        gameTitle: game.title,
        url: `${game.url}glossary/${term.slug}/`,
      });
    }
  }
  return out;
}
