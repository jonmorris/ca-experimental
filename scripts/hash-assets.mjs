#!/usr/bin/env node
/**
 * Stamps every stylesheet, script and font with a hash of its own contents,
 * and rewrites each reference to match.
 *
 * A browser decides whether to reuse its cached copy of a file by that file's
 * URL. Ours never changed between deploys — `assets/js/preferences.js` was the
 * same address before and after any edit — so a returning reader kept running
 * whatever they had. Worse than stale, it went stale unevenly: the browser
 * makes that choice per file, so a reader could hold a new stylesheet against
 * old JavaScript, and a control drawn by one half would be wired to a setting
 * the other half had stopped writing.
 *
 * Renaming the file to `preferences.9f2c1a04.js` makes the address a fact about
 * the contents. Change the contents and the address changes, so there is
 * nothing cached to reuse; leave them alone and it stays put, so the cache
 * still does its job.
 *
 * Adding `?v=` to the page's one <script> tag does not do this. That script is
 * a loader: the code lives in sixteen modules it pulls in by relative name, and
 * those names would carry no version. The browser would fetch a fresh loader
 * and reuse stale copies of everything that matters. Every file in the graph
 * has to be named for its own contents, which is why this walks dependencies
 * first and works outward.
 *
 * Usage: npm run hash:assets  (after npm run build:site, before build:search)
 */

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync, renameSync, rmSync, existsSync } from "node:fs";
import { join, relative, dirname, basename, extname, resolve } from "node:path";

import { basePath } from "../lib/base-path.js";

const SITE_DIR = join(process.cwd(), "_site");
const ASSET_DIR = join(SITE_DIR, "assets");
const PREFIX = basePath();

/** Extensions worth stamping: the code, and what the code pulls in. */
const HASHED = new Set([".css", ".js", ".woff2"]);

/** A name this script has already produced, e.g. `tokens.9f2c1a04.css`. */
const ALREADY_HASHED = /\.[0-9a-f]{8}(\.[a-z0-9]+)$/;

function walk(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(path));
    else out.push(path);
  }
  return out;
}

function hashOf(buffer) {
  return createHash("sha256").update(buffer).digest("hex").slice(0, 8);
}

function hashedName(path, hash) {
  const ext = extname(path);
  return join(dirname(path), `${basename(path, ext)}.${hash}${ext}`);
}

/**
 * What a file points at, as [full match, referenced path] pairs.
 *
 * Only relative references: a stylesheet's `url()` and a module's import
 * specifier. Anything root-absolute is either outside the asset tree or, in
 * CSS, a mistake `verify:links` already rejects.
 */
function referencesIn(path, text) {
  const ext = extname(path);
  if (ext === ".css") {
    return [...text.matchAll(/url\(\s*["']?(\.[^"')]+)["']?\s*\)/g)];
  }
  if (ext === ".js") {
    return [
      ...text.matchAll(/(?:from|import)\s*\(?\s*["'](\.[^"']+)["']/g),
      ...text.matchAll(/export\s+(?:\*|\{[^}]*\})\s*from\s*["'](\.[^"']+)["']/g),
    ];
  }
  return [];
}

function main() {
  if (!existsSync(ASSET_DIR)) {
    console.error("No _site/assets/. Run `npm run build:site` first.");
    process.exit(1);
  }

  /*
   * Clear out anything a previous run produced. Eleventy copies the originals
   * back on every build but does not remove what it did not write, so without
   * this the directory accumulates a stamped copy of every asset that has ever
   * been built and ships them all.
   */
  for (const path of walk(ASSET_DIR)) {
    if (ALREADY_HASHED.test(path)) rmSync(path);
  }

  const assets = walk(ASSET_DIR).filter((path) => HASHED.has(extname(path)));

  /*
   * Dependency order, so a file is stamped only once everything it points at
   * has been. Its final hash has to cover the rewritten references, or the
   * name would stop describing the contents the moment a dependency changed.
   */
  const order = [];
  const state = new Map();

  function visit(path) {
    if (state.get(path) === "done") return;
    if (state.get(path) === "open") {
      // Content hashing has no answer for a cycle: each name would depend on
      // the other's. The module graph has none; fail loudly if that changes.
      console.error(`Circular reference through ${relative(SITE_DIR, path)}.`);
      process.exit(1);
    }
    state.set(path, "open");
    const text = readFileSync(path, "utf8");
    for (const [, reference] of referencesIn(path, text)) {
      const target = resolve(dirname(path), reference);
      if (assets.includes(target)) visit(target);
    }
    state.set(path, "done");
    order.push(path);
  }

  for (const path of assets) visit(path);

  /** Original absolute path → stamped absolute path. */
  const renamed = new Map();

  for (const path of order) {
    const binary = extname(path) === ".woff2";
    let contents = readFileSync(path);

    if (!binary) {
      let text = contents.toString("utf8");
      for (const [match, reference] of referencesIn(path, text)) {
        const target = renamed.get(resolve(dirname(path), reference));
        if (!target) continue;
        const next = relative(dirname(path), target).split("\\").join("/");
        text = text.replace(
          match,
          match.replace(reference, next.startsWith(".") ? next : `./${next}`),
        );
      }
      contents = Buffer.from(text, "utf8");
    }

    const target = hashedName(path, hashOf(contents));
    if (!binary) writeFileSync(path, contents);
    renameSync(path, target);
    renamed.set(path, target);
  }

  /*
   * Pages reference assets by site URL, carrying the deploy prefix. Mapping
   * back through the prefix keeps this working whether the site is served from
   * a root domain or a subpath.
   */
  const urlFor = (path) => {
    const rel = relative(SITE_DIR, path).split("\\").join("/");
    return PREFIX === "/" ? `/${rel}` : `${PREFIX}${rel}`;
  };
  const byUrl = new Map([...renamed].map(([from, to]) => [urlFor(from), urlFor(to)]));

  let rewritten = 0;
  for (const path of walk(SITE_DIR)) {
    if (extname(path) !== ".html") continue;
    const before = readFileSync(path, "utf8");
    let after = before;
    for (const [from, to] of byUrl) {
      // Bounded by the quote so `base.css` cannot match inside `database.css`.
      after = after.split(`"${from}"`).join(`"${to}"`);
    }
    if (after !== before) {
      writeFileSync(path, after);
      rewritten += 1;
    }
  }

  console.log(`Stamped ${renamed.size} assets and rewrote ${rewritten} pages.`);
}

main();
