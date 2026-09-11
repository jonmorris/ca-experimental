#!/usr/bin/env node
/**
 * Pulls game content across from the original Cardboard Appendix repository.
 *
 * That repository is where the rules are written; this one is the site built
 * from them. The two have different content formats — this build computes
 * permalinks, layouts and breadcrumbs from a file's own path, where the
 * original writes them into frontmatter — so a sync is a translation rather
 * than a copy.
 *
 * It overwrites, because upstream keeps revising games this repo already
 * carries. What it must not overwrite is the editorial work done here, which
 * is why the overrides below exist: every one of them records a decision that
 * a plain copy would silently undo. That is the whole reason this script is
 * committed rather than run once and thrown away.
 *
 *   UPSTREAM=../cardboard-appendix npm run sync
 *
 * Never runs in CI. It reads a sibling checkout, and its output is the content
 * commit a person reviews.
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from "node:fs";
import { join, basename, resolve } from "node:path";

import { slugify } from "../lib/slugify.js";

const UPSTREAM = resolve(process.env.UPSTREAM || "../cardboard-appendix");
const SOURCE = join(UPSTREAM, "src/games");
const TARGET = resolve("src/games");

if (!existsSync(SOURCE)) {
  console.error(
    `No games at ${SOURCE}.\n` +
      "Point UPSTREAM at a checkout of the cardboard-appendix repository, e.g.\n" +
      "  UPSTREAM=../cardboard-appendix npm run sync",
  );
  process.exit(1);
}

/* Frontmatter this build derives from a file's path, plus upstream's own
 * editorial bookkeeping, which nothing here reads. */
const DROP_FRONTMATTER = new Set([
  "layout", "permalink", "gameSection", "breadcrumb", "eleventyExcludeFromCollections",
  "status", "priority", "copyrightNotes", "lastUpdated",
]);

/* game.json keys the registry does not read. */
const DROP_META = new Set(["site_published", "sections", "downloads"]);

const NON_CONTENT = new Set(["_source", "_working", "images", "downloads"]);

/*
 * Not content here.
 *
 * `bookmarks.md` was a page listing saved rules; the drawer and the landing
 * panel replaced it. Every `rules-summary.md` upstream is an empty placeholder
 * except Indonesia's — a page with a title and nothing under it is worse than
 * no page, since the nav offers it and the palette indexes it. `content.md` in
 * Food Chain Magnate has no frontmatter and no place in upstream's navigation,
 * an orphan whose components list is already the rulebook's Contents section.
 * `landing.njk` exists in both, but upstream's carries only layout wiring while
 * this one holds an authored subhead.
 */
const SKIP_FILES = new Set(["bookmarks.md", "rules-summary.md", "content.md", "landing.njk"]);

/** Written here, with no upstream equivalent: a sync must not clear them. */
const LOCAL_ONLY = new Set(["glossary.md", "landing.njk", "arcs/index.md"]);

const RENAME = { "rules-summary.md": "summary.md" };

/**
 * Corrections to upstream metadata.
 *
 * Each is a decision that a straight copy would undo, so it is re-applied on
 * every sync. Fix one upstream and its entry here can go.
 */
const META_OVERRIDES = {
  arkwright: {
    /*
     * Upstream ships the newer edition's cover — the factory floor — against a
     * record that reads Spielworxx, 2014. This is the art for the edition
     * described. Lower resolution at 500x700, but larger than either surface
     * draws it.
     */
    box_art: "/games/arkwright/images/arkwright.png",
  },
  "greed-incorporated": {
    // Upstream's is an unterminated pull-quote, cut mid-sentence.
    description:
      "A game of corporate fraud: run your companies into crisis, collect the "
      + "severance bonus, and spend it on status symbols before someone else does.",
  },
  "john-company-second-edition": {
    // Upstream's carries a stray space where italics were stripped from a title.
    description:
      "Ambitious families using the British East India Company for personal gain, "
      + "negotiating over who gets which post and who carries the blame.",
  },
  "pax-pamir-second-edition": {
    description:
      "Nineteenth-century Afghan leaders forging a new state from the wreckage of "
      + "the Durrani Empire, backing whichever foreign power looks likeliest to win.",
  },
};

/** Expansion names an ampersand cannot survive in a directory slug. */
const EXPANSION_TITLES = {
  "food-chain-magnate": { "the-ketchup-mechanism-and-other-ideas": "The Ketchup Mechanism & Other Ideas" },
  "roads-and-boats": { "and-cetera": "&Cetera" },
};

/**
 * Subheads and nav order for pages that arrive without them.
 *
 * Upstream has dropped `subhead` from its frontmatter; this site shows one on
 * the page and on the landing card. An existing subhead is always kept, so
 * these apply only the first time a page appears.
 */
const NEW_PAGES = {
  "arkwright/rulebook.md": ["The full Water Frame rules, section by section.", 10],
  "arkwright/players-book.md": ["The board, the cards and the components, piece by piece.", 20],
  "pax-renaissance/rulebook.md": ["The complete first-edition rules.", 10],
  "pax-renaissance-second-edition/rulebook.md": ["The complete second-edition rules.", 10],
  "pax-renaissance-second-edition/players-guide.md": ["A guided playthrough, turn by turn.", 20],
  "high-frontier-4-all/read-me-first.md": ["Start here: what High Frontier is, and how to come at it.", 5],
  "high-frontier-4-all/rulebook.md": ["The core rules of exoglobalization, for 1 to 5 players.", 10],
  "high-frontier-4-all/appendix.md": ["Variants and scenarios for the core game.", 15],
  "high-frontier-4-all/space-diamonds.md": ["The introductory scenario, and a first game of High Frontier.", 20],
  "high-frontier-4-all/module-1-terawatt.md": ["Terawatt: module 1, for 1 to 5 players.", 30],
  "high-frontier-4-all/module-2-colonization.md": ["Colonization: module 2, for 1 to 5 players.", 31],
  "high-frontier-4-all/module-3-conflict.md": ["Conflict: module 3, for 1 to 6 players.", 32],
  "high-frontier-4-all/module-3-conflict-strategy.md": ["Strategy notes for the Conflict module.", 33],
  "high-frontier-4-all/module-4-exodus.md": ["Exodus: module 4, for 1 to 6 players.", 34],
  "high-frontier-4-all/race-for-glory.md": ["A standalone game of exoglobalization, for 2 to 5 players.", 40],
};

/** A landing page is one authored line; upstream's has none to take. */
const LANDING_SUBHEADS = {
  antiquity: "Build cities, choke on your own pollution, and outrun starvation.",
  arkwright: "Build mills, set wages, and float the shares that decide who wins.",
  bus: "Route the buses, carry the passengers, and bend time until it breaks.",
  "duck-dealer": "Intergalactic trade, planned several moves further ahead than feels comfortable.",
  "food-chain-magnate": "Hire, train and undercut your way to a fast food empire.",
  "greed-incorporated": "Run the company up, sell the shares, and leave someone else holding it.",
  "high-frontier-4-all": "Chart a rocket to the outer planets on a map of real orbital mechanics.",
  "horseless-carriage": "Design the car, build the factory, and reach the market before it moves.",
  "john-company": "Place your family inside the Company and get rich on its business.",
  "john-company-second-edition": "Ambitious families turning the British East India Company to private gain.",
  oath: "An ancient land, and the history one to six players write across it.",
  "pax-pamir-second-edition": "Afghan leaders forging a state from the wreckage of an empire.",
  "pax-renaissance": "Bankroll kings and republics, and decide which Europe emerges.",
  "pax-renaissance-second-edition": "Bankroll kings and republics, and decide which Europe emerges.",
  "roads-and-boats": "Lay roads, move goods, and mint more gold than anyone else on the island.",
  root: "Woodland factions at war, each playing an entirely different game.",
  "the-great-zimbabwe": "Trade routes, monuments and gods whose favour costs more each time.",
};

const log = [];

function splitFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  return m ? { front: m[1], body: m[2] } : { front: "", body: text };
}

/** A subhead may contain a colon, which breaks an unquoted YAML scalar. */
function yamlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function frontValue(front, key) {
  const m = front.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
  return m ? m[1].trim().replace(/^['"]|['"]$/g, "") : null;
}

/**
 * Writes the explicit anchor the conventions ask for onto every H2.
 *
 * The value is the slug the build derives anyway, so nothing moves; writing it
 * down is what stops a later rename moving it silently. Fenced code and
 * `{% raw %}` are left alone — a `##` in either is not a heading.
 */
function anchorHeadings(body) {
  const out = [];
  let fenced = false;
  let raw = false;
  let added = 0;

  for (const line of body.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
    if (/{%-?\s*raw\s*-?%}/.test(line)) raw = true;
    if (/{%-?\s*endraw\s*-?%}/.test(line)) raw = false;

    const heading = !fenced && !raw && line.match(/^##\s+(.+?)\s*$/);
    if (heading && !/\{:?\s*#[\w-]+\s*\}$/.test(line)) {
      const text = heading[1].replace(/\{%[\s\S]*?%\}/g, "").replace(/[*_`]/g, "").trim();
      out.push(`## ${heading[1]} {: #${slugify(text)}}`);
      added += 1;
      continue;
    }
    out.push(line);
  }

  return { body: out.join("\n"), added };
}

/** Upstream's `note` shortcodes are this repo's `callout`. */
function portShortcodes(body) {
  return body
    .replace(/{%-?\s*noteInline\s*-?%}/g, "{% callout inline=true %}")
    .replace(/{%-?\s*endnoteInline\s*-?%}/g, "{% endcallout %}")
    .replace(/{%-?\s*note\s*-?%}/g, "{% callout %}")
    .replace(/{%-?\s*endnote\s*-?%}/g, "{% endcallout %}");
}

function portFile(from, to, key) {
  const upstream = splitFrontmatter(readFileSync(from, "utf8"));
  if (!upstream.body.trim()) return "empty upstream, skipped";

  const existing = existsSync(to) ? splitFrontmatter(readFileSync(to, "utf8")) : null;
  const { body, added } = anchorHeadings(portShortcodes(upstream.body.trim()));
  if (existing && existing.body.trim() === body.trim()) return null;

  const [newSubhead, newOrder] = NEW_PAGES[key] || [];
  const subhead = (existing && frontValue(existing.front, "subhead")) || newSubhead;
  const title =
    (existing && frontValue(existing.front, "title")) || frontValue(upstream.front, "title") || "";
  const navLabel = existing && frontValue(existing.front, "navLabel");
  const navOrder = (existing && frontValue(existing.front, "navOrder")) || newOrder;

  const front = [
    title && `title: ${yamlString(title)}`,
    navLabel && `navLabel: ${yamlString(navLabel)}`,
    navOrder && `navOrder: ${navOrder}`,
    subhead && `subhead: ${yamlString(subhead)}`,
    // This repo's record of where renamed sections used to live. Never lose it.
    existing && /^anchorAliases:/m.test(existing.front)
      ? existing.front.match(/^anchorAliases:[\s\S]*?(?=\n[A-Za-z_]+:|$)/m)[0].trimEnd()
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  mkdirSync(join(to, ".."), { recursive: true });
  writeFileSync(to, `---\n${front}\n---\n\n${body}\n`);
  return `${existing ? "updated" : "added"}${added ? ` (${added} anchors)` : ""}`;
}

function portMeta(gameSlug, from, to) {
  const upstream = JSON.parse(readFileSync(from, "utf8"));
  const existing = existsSync(to) ? JSON.parse(readFileSync(to, "utf8")) : {};

  const out = {};
  for (const [key, value] of Object.entries(upstream)) {
    if (DROP_META.has(key) || value === "" || value === null) continue;
    out[key] = value;
  }

  // Tags are written here; upstream has none.
  if (existing.tags) out.tags = existing.tags;
  Object.assign(out, META_OVERRIDES[gameSlug] || {});
  if (EXPANSION_TITLES[gameSlug]) {
    out.expansions = Object.fromEntries(
      Object.entries(EXPANSION_TITLES[gameSlug]).map(([slug, title]) => [slug, { title }]),
    );
  }

  const next = `${JSON.stringify(out, null, 2)}\n`;
  const changed = !existsSync(to) || readFileSync(to, "utf8") !== next;
  if (!changed) return null;
  mkdirSync(join(to, ".."), { recursive: true });
  writeFileSync(to, next);
  return existing.title ? "updated" : "added";
}

function portDir(fromDir, toDir, prefix) {
  for (const name of readdirSync(fromDir).filter((n) => n.endsWith(".md"))) {
    if (SKIP_FILES.has(name)) continue;
    const key = `${prefix}${name}`;
    const target = RENAME[name] || name;
    if (LOCAL_ONLY.has(target) || LOCAL_ONLY.has(key)) continue;
    const result = portFile(join(fromDir, name), join(toDir, target), key);
    if (result) log.push(`    ${key}: ${result}`);
  }
}

for (const game of readdirSync(SOURCE, { withFileTypes: true }).filter((e) => e.isDirectory())) {
  const slug = game.name;
  const fromDir = join(SOURCE, slug);
  const toDir = join(TARGET, slug);
  const start = log.length;
  log.push(`  ${slug}`);

  mkdirSync(toDir, { recursive: true });
  const meta = portMeta(slug, join(fromDir, "game.json"), join(toDir, "game.json"));
  if (meta) log.push(`    game.json: ${meta}`);

  portDir(fromDir, toDir, `${slug}/`);

  for (const entry of readdirSync(fromDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || NON_CONTENT.has(entry.name)) continue;
    portDir(join(fromDir, entry.name), join(toDir, slugify(entry.name)), `${slug}/${entry.name}/`);
  }

  const landing = join(toDir, "landing.njk");
  if (!existsSync(landing) && LANDING_SUBHEADS[slug]) {
    writeFileSync(landing, `---\nsubhead: ${yamlString(LANDING_SUBHEADS[slug])}\n---\n`);
    log.push("    landing.njk: added");
  }

  /*
   * Box art, and anything the ported markdown points at. Only what is
   * referenced: upstream keeps images no page uses, and the build now resizes
   * whatever it finds, so copying the rest is work and weight for nothing.
   */
  const wanted = new Set();
  if (existsSync(join(toDir, "game.json"))) {
    const meta = JSON.parse(readFileSync(join(toDir, "game.json"), "utf8"));
    if (meta.box_art) wanted.add(basename(meta.box_art));
  }
  for (const file of readdirSync(toDir).filter((n) => n.endsWith(".md"))) {
    for (const m of readFileSync(join(toDir, file), "utf8").matchAll(/images\/([A-Za-z0-9._-]+)/g)) {
      wanted.add(m[1]);
    }
  }

  const imagesFrom = join(fromDir, "images");
  if (existsSync(imagesFrom)) {
    for (const name of readdirSync(imagesFrom)) {
      const target = join(toDir, "images", name);
      if (!wanted.has(name) || existsSync(target)) continue;
      mkdirSync(join(toDir, "images"), { recursive: true });
      copyFileSync(join(imagesFrom, name), target);
      log.push(`    images/${name}: added`);
    }
  }

  if (log.length === start + 1) log.pop();
}

console.log(log.length ? log.join("\n") : "Already in sync.");
console.log(
  "\nNow run `npm run build && npm run sync:links` — upstream content carries "
    + "links to anchors that do not exist, and they are neutralised against the built site.",
);
