#!/usr/bin/env node
/**
 * Checks the URL contract and every internal link in the built site.
 *
 * URLs are permanent, so a link that has quietly stopped resolving is a real
 * defect rather than cosmetic drift. This runs against `_site/`, after a build,
 * and reports:
 *
 *   - pages whose URL does not match the contract in the requirements
 *   - internal links pointing at a page that was not built
 *   - `#fragment` links pointing at an ID that does not exist on the target
 *   - duplicate IDs on a page, which make an anchor ambiguous
 *   - anchor aliases that no longer point at a live heading
 *
 * Usage: npm run verify:links  (after npm run build:site)
 */

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

import { buildGames } from "../lib/registry.js";

const SITE_DIR = join(process.cwd(), "_site");

/**
 * The URL contract. Anything published under /games/ must match one of these.
 */
const URL_PATTERNS = [
  { name: "homepage", re: /^\/$/ },
  { name: "site page", re: /^\/(about)\/$/ },
  { name: "game landing", re: /^\/games\/[a-z0-9-]+\/$/ },
  { name: "glossary term", re: /^\/games\/[a-z0-9-]+\/glossary\/[a-z0-9-]+\/$/ },
  { name: "game content type", re: /^\/games\/[a-z0-9-]+\/[a-z0-9-]+\/$/ },
  { name: "expansion content type", re: /^\/games\/[a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9-]+\/$/ },
];

const problems = [];
const fail = (message) => problems.push(message);

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(path));
    else if (entry.name.endsWith(".html")) out.push(path);
  }
  return out;
}

function urlFor(file) {
  const rel = relative(SITE_DIR, file).split("\\").join("/");
  if (rel === "404.html") return "/404.html";
  return `/${rel.replace(/index\.html$/, "")}`;
}

/** IDs a page exposes as link targets, including anchor aliases. */
function idsIn(html) {
  const ids = [];
  for (const match of html.matchAll(/\sid="([^"]+)"/g)) ids.push(match[1]);
  return ids;
}

function linksIn(html) {
  return [...html.matchAll(/<a\b[^>]*\shref="([^"]+)"/g)].map((m) => m[1]);
}

function main() {
  if (!existsSync(SITE_DIR) || !statSync(SITE_DIR).isDirectory()) {
    console.error("No _site/ directory. Run `npm run build:site` first.");
    process.exit(1);
  }

  const files = walk(SITE_DIR);
  const pages = new Map();

  for (const file of files) {
    const html = readFileSync(file, "utf8");
    const url = urlFor(file);
    const ids = idsIn(html);

    const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
    for (const id of new Set(duplicates)) {
      fail(`${url} — duplicate id "#${id}"; an anchor must identify exactly one place`);
    }

    pages.set(url, { ids: new Set(ids), links: linksIn(html) });
  }

  // --- URL contract -------------------------------------------------------
  for (const url of pages.keys()) {
    if (url === "/404.html") continue;
    if (!URL_PATTERNS.some((pattern) => pattern.re.test(url))) {
      fail(`${url} — does not match any URL in the contract`);
    }
  }

  // --- internal links -----------------------------------------------------
  for (const [url, page] of pages) {
    for (const href of page.links) {
      if (!href.startsWith("/")) continue; // external, mailto, or in-page below

      const [path, fragment] = href.split("#");
      const targetUrl = path || url;
      const target = pages.get(targetUrl);

      if (!target) {
        // Assets are copied, not built as pages.
        if (/\.(css|js|svg|png|jpe?g|webp|pdf|xml|txt|json)$/.test(targetUrl)) continue;
        if (targetUrl.startsWith("/pagefind/")) continue;
        fail(`${url} — links to ${targetUrl}, which was not built`);
        continue;
      }

      if (fragment && !target.ids.has(fragment)) {
        fail(`${url} — links to ${targetUrl}#${fragment}, but that page has no such anchor`);
      }
    }

    // In-page links, written as bare fragments.
    for (const href of page.links) {
      if (!href.startsWith("#") || href === "#") continue;
      const fragment = href.slice(1);
      if (!page.ids.has(fragment)) {
        fail(`${url} — links to ${href}, but the page has no such anchor`);
      }
    }
  }

  // --- anchor aliases -----------------------------------------------------
  for (const game of Object.values(buildGames())) {
    for (const type of game.allContentTypes) {
      const anchors = new Set(type.headings.map((h) => h.slug));
      for (const alias of type.anchorAliases) {
        if (!anchors.has(alias.to)) {
          fail(`${type.url} — anchor alias "${alias.from}" points at "${alias.to}", which is not a heading here`);
        }
        if (anchors.has(alias.from)) {
          fail(`${type.url} — anchor alias "${alias.from}" collides with a live heading of the same id`);
        }
      }
    }
  }

  const pageCount = pages.size;
  const linkCount = [...pages.values()].reduce((n, page) => n + page.links.length, 0);
  console.log(`Checked ${linkCount} links across ${pageCount} pages.`);

  if (problems.length) {
    console.error(`\n${problems.length} problem${problems.length === 1 ? "" : "s"}:`);
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }

  console.log("URL contract and all internal links are intact.");
}

main();
