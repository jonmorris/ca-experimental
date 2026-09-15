#!/usr/bin/env node
/**
 * Checks the URL contract and every internal link in the built site.
 *
 * URLs are permanent, so a link that has quietly stopped resolving is a real
 * defect rather than cosmetic drift. This runs against `_site/`, after a build,
 * and reports:
 *
 *   - pages whose URL does not match the contract in the requirements
 *   - internal links pointing at a page or file that was not built
 *   - command-palette targets pointing at a page or anchor that was not built
 *   - assets a stylesheet references that are not where it says they are
 *   - `#fragment` links pointing at an ID that does not exist on the target
 *   - duplicate IDs on a page, which make an anchor ambiguous
 *   - anchor aliases that no longer point at a live heading
 *
 * Usage: npm run verify:links  (after npm run build:site)
 */

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative, resolve, dirname } from "node:path";

import { buildGames } from "../lib/registry.js";
import { basePath } from "../lib/base-path.js";
import site from "../src/_data/site.json" with { type: "json" };

const SITE_DIR = join(process.cwd(), "_site");

/*
 * When the site is built for a subpath, every URL in the output carries that
 * prefix. The contract is checked against the URL underneath it, so the same
 * patterns hold whether the site is hosted at a root domain or under /repo/.
 */
const PREFIX = basePath();

function stripPrefix(url) {
  if (PREFIX === "/" || !url.startsWith(PREFIX)) return url;
  return `/${url.slice(PREFIX.length)}`;
}

/**
 * The URL contract. Anything published under /games/ must match one of these.
 */
const URL_PATTERNS = [
  { name: "homepage", re: /^\/$/ },
  { name: "site page", re: /^\/(about|accounts)\/$/ },
  // Temporary: the iOS bottom-bar diagnostic. Goes with src/viewport-probe.njk.
  { name: "viewport probe", re: /^\/viewport-probe\/$/ },
  { name: "game landing", re: /^\/games\/[a-z0-9-]+\/$/ },
  { name: "glossary term", re: /^\/games\/[a-z0-9-]+\/glossary\/[a-z0-9-]+\/$/ },
  { name: "game content type", re: /^\/games\/[a-z0-9-]+\/[a-z0-9-]+\/$/ },
  { name: "expansion content type", re: /^\/games\/[a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9-]+\/$/ },
];

let sitemapCount = 0;
const problems = [];
const fail = (message) => problems.push(message);

function walk(dir, extension = ".html") {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(path, extension));
    else if (entry.name.endsWith(extension)) out.push(path);
  }
  return out;
}

/**
 * Assets referenced from inside stylesheets.
 *
 * `HtmlBasePlugin` rewrites markup and never looks inside CSS, so a
 * root-absolute `url()` silently misses the deploy prefix — which is how every
 * self-hosted webface once 404'd on the subpath host while the page around
 * them rendered perfectly, in system fonts, with nothing failing the build.
 * Resolving each one against the stylesheet that declares it catches both that
 * and an ordinary missing file.
 */
function checkStylesheetAssets() {
  let checked = 0;

  for (const file of walk(SITE_DIR, ".css")) {
    const css = readFileSync(file, "utf8");
    const from = `/${relative(SITE_DIR, file).split("\\").join("/")}`;

    for (const match of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
      const reference = match[1].trim();
      if (/^(https?:|data:|#)/.test(reference)) continue;
      checked += 1;

      /*
       * Root-absolute is the failure mode itself, not merely a style to
       * discourage: it happens to work at a root domain and breaks silently
       * everywhere else, so it is rejected in every build rather than only in
       * the one that would have exposed it.
       */
      if (reference.startsWith("/")) {
        fail(
          `${from} — references ${reference} root-absolutely; CSS is never ` +
            "rewritten for the deploy prefix, so write it relative to the stylesheet",
        );
        continue;
      }

      if (!existsSync(resolve(dirname(file), reference))) {
        fail(`${from} — references ${reference}, which is not there`);
      }
    }
  }

  return checked;
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

/**
 * URLs the command palette navigates to.
 *
 * These travel to the client as JSON rather than as href attributes, so they
 * are invisible to every check that reads markup — which is exactly how a
 * palette full of unprefixed URLs once shipped, resolving to 404 on a subpath
 * host while every rendered link on the same page was fine. Anything that can
 * be clicked has to be checked, whatever shape it arrives in.
 */
function paletteUrlsIn(html) {
  const match = html.match(
    /<script type="application\/json" data-palette-index[^>]*>([\s\S]*?)<\/script>/,
  );
  if (!match) return [];
  try {
    const entries = JSON.parse(match[1]);
    return Array.isArray(entries) ? entries.map((entry) => entry.url).filter(Boolean) : [];
  } catch {
    fail("the embedded command-palette index is not valid JSON");
    return [];
  }
}

function main() {
  if (!existsSync(SITE_DIR) || !statSync(SITE_DIR).isDirectory()) {
    console.error("No _site/ directory. Run `npm run build:site` first.");
    process.exit(1);
  }

  const files = walk(SITE_DIR);
  const pages = new Map();
  // The palette index is identical on every page, so it is checked once rather
  // than reported 58 times over.
  const paletteUrls = new Set();

  for (const file of files) {
    const html = readFileSync(file, "utf8");
    const url = urlFor(file);
    const ids = idsIn(html);

    const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
    for (const id of new Set(duplicates)) {
      fail(`${url} — duplicate id "#${id}"; an anchor must identify exactly one place`);
    }

    pages.set(url, {
      ids: new Set(ids),
      links: linksIn(html),
      noIndex: /<meta[^>]+name="robots"[^>]+noindex/i.test(html),
    });
    for (const paletteUrl of paletteUrlsIn(html)) paletteUrls.add(paletteUrl);
  }

  // --- URL contract -------------------------------------------------------
  for (const url of pages.keys()) {
    if (url === "/404.html") continue;
    if (!URL_PATTERNS.some((pattern) => pattern.re.test(stripPrefix(url)))) {
      fail(`${url} — does not match any URL in the contract`);
    }
  }

  // --- internal links -----------------------------------------------------
  for (const [url, page] of pages) {
    for (const href of page.links) {
      if (!href.startsWith("/")) continue; // external, mailto, or in-page below

      const [path, fragment] = href.split("#");
      // Links carry the deploy prefix; the page map is keyed by output path,
      // which is what the prefix resolves to on the host.
      const targetUrl = path ? stripPrefix(path) : url;
      const target = pages.get(targetUrl);

      if (!target) {
        /*
         * Assets are copied, not built as pages — so they are not in the page
         * map, but they are still on disk and can still be missing. Checked
         * rather than skipped: a game's downloads are ordinary links to
         * ordinary files, and the whole point of offering one is that it is
         * there. The old blanket skip meant a PDF that never got committed
         * produced a download button leading to a 404 and a clean report.
         */
        if (/\.[a-z0-9]+$/i.test(targetUrl)) {
          if (targetUrl.startsWith("/pagefind/")) continue;
          if (!existsSync(join(SITE_DIR, targetUrl.replace(/^\//, "")))) {
            fail(`${url} — links to ${targetUrl}, which is not in the build`);
          }
          continue;
        }
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

  // --- command-palette targets --------------------------------------------
  for (const href of paletteUrls) {
    if (!href.startsWith("/")) {
      fail(`command palette — "${href}" is not a root-absolute URL`);
      continue;
    }
    if (PREFIX !== "/" && !href.startsWith(PREFIX)) {
      fail(`command palette — ${href} is missing the ${PREFIX} deploy prefix`);
      continue;
    }

    const [path, fragment] = href.split("#");
    const target = pages.get(stripPrefix(path));
    if (!target) {
      fail(`command palette — points at ${stripPrefix(path)}, which was not built`);
      continue;
    }
    if (fragment && !target.ids.has(fragment)) {
      fail(`command palette — points at ${stripPrefix(path)}#${fragment}, but that page has no such anchor`);
    }
  }

  // --- stylesheet assets ---------------------------------------------------
  const assetCount = checkStylesheetAssets();

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

  // --- the sitemap --------------------------------------------------------
  /*
   * A sitemap is a list of promises to a crawler, and every one of them is an
   * absolute URL that nothing else on the site links to — so a page that moved
   * or stopped being built leaves an entry here that no other check in this
   * script would ever look at. Both directions are worth failing on: an entry
   * for a page that does not exist advertises a 404, and a page marked
   * `noindex` that is listed anyway is the unlisting quietly undone.
   */
  const sitemapPath = join(SITE_DIR, "sitemap.xml");
  if (!existsSync(sitemapPath)) {
    fail("sitemap.xml — not built");
  } else {
    const xml = readFileSync(sitemapPath, "utf8");
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

    if (!locs.length) fail("sitemap.xml — lists no pages at all");

    const seen = new Set();
    for (const loc of locs) {
      if (!loc.startsWith(site.url)) {
        fail(`sitemap.xml — ${loc} is not under ${site.url}`);
        continue;
      }
      if (seen.has(loc)) fail(`sitemap.xml — ${loc} is listed twice`);
      seen.add(loc);

      const url = stripPrefix(loc.slice(site.url.length)) || "/";
      const page = pages.get(url);
      if (!page) {
        fail(`sitemap.xml — ${url} is listed but was not built`);
      } else if (page.noIndex) {
        fail(`sitemap.xml — ${url} is listed but carries a noindex tag`);
      }
    }
    sitemapCount = seen.size;
  }

  const pageCount = pages.size;
  const linkCount = [...pages.values()].reduce((n, page) => n + page.links.length, 0);
  console.log(
    `Checked ${linkCount} links across ${pageCount} pages, ` +
      `${paletteUrls.size} command-palette targets, ${assetCount} stylesheet assets ` +
      `and ${sitemapCount} sitemap entries.`,
  );

  if (problems.length) {
    console.error(`\n${problems.length} problem${problems.length === 1 ? "" : "s"}:`);
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }

  console.log("URL contract and all internal links are intact.");
}

main();
