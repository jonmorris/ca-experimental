import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";

import { slugify, titleFromSlug } from "./slugify.js";
import { contentTypeDefaults, NON_CONTENT_DIRS } from "./content-types.js";
import { parseHeadings } from "./headings.js";

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
      return {
        slug,
        dirName: entry.name,
        title: String(override.title || titleFromSlug(slug)),
        released: String(override.released || ""),
        url: urlBase,
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

  const url = `/games/${gameSlug}/`;
  const contentTypes = readContentTypes({ dir: gameDir, urlBase: url, scope: "base" });
  const expansions = readExpansions(gameDir, gameSlug, meta);

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
    contentTypes,
    expansions,
    allContentTypes,
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
export function buildGames() {
  const games = {};
  for (const entry of listDir(GAMES_DIR)) {
    if (!entry.isDirectory()) continue;
    const gameDir = join(GAMES_DIR, entry.name);
    if (!statSync(gameDir).isDirectory()) continue;
    const gameSlug = slugify(entry.name);
    const game = buildGame(gameSlug, gameDir);
    if (game) games[gameSlug] = game;
  }
  return games;
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
