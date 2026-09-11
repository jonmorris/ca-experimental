#!/usr/bin/env node
/**
 * Renders links that lead nowhere as plain text.
 *
 * Upstream content cross-references rules by number — `[**1A2b**](#1a2b)` —
 * against anchors that were never created. High Frontier's rulebook alone has
 * 337 distinct fragment targets of which one resolves, and hundreds of links
 * point at a placeholder `/games/test/` game. None of that is caused by the
 * sync; it is how the source is written today.
 *
 * This repo already answers a missing cross-link by rendering its label and
 * warning rather than failing the build, so dead links get the same treatment:
 * the visible text stays and the broken href goes. Nothing a reader sees is
 * lost — "1A2b" still reads as a rule number — and when upstream gives those
 * rules anchors, the next sync brings the links back.
 *
 *   npm run build && npm run sync:links && npm run build
 *
 * Run after a build, because it asks `verify:links` what is actually broken in
 * the built HTML rather than re-deriving which anchors exist. An earlier
 * version did re-derive them, was stricter than the real pipeline, and stripped
 * fifteen working links in Arcs. The verifier reads ids out of the output, so
 * it is the only thing that knows the answer.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const GAMES = resolve("src/games");

let report = "";
try {
  report = execFileSync("node", ["scripts/verify-links.mjs"], { encoding: "utf8" });
} catch (error) {
  // A non-zero exit is the normal case here: it means there is work to do.
  report = `${error.stdout || ""}${error.stderr || ""}`;
}

/** Page URL → the link targets the verifier called broken on it. */
const broken = new Map();
for (const line of report.split("\n")) {
  // Two wordings: "…, but the page has no such anchor" and "…, which was not built".
  const m = line.match(/^\s+- (\/games\/\S+?) — links to (\S+?)(?:, but|, which was not built)/);
  if (!m) continue;
  const [, page, target] = m;
  if (!broken.has(page)) broken.set(page, new Set());
  broken.get(page).add(target);
}

/** Source file behind a built page URL: /games/x/y/ → src/games/x/y.md */
function sourceFor(url) {
  const parts = url.replace(/^\/games\//, "").replace(/\/$/, "").split("/");
  const file = `${parts.pop()}.md`;
  return join(GAMES, ...parts, file);
}

let total = 0;
const perGame = new Map();

for (const [page, targets] of broken) {
  const file = sourceFor(page);
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue; // a generated page with no markdown behind it
  }

  let count = 0;
  /*
   * One level of nesting inside the label. Upstream writes rule references as
   * `[**[(B2b)]**](…)`, and a `[^\]]+` label stops at the inner bracket and
   * never matches the link at all — which is how 289 dead links survived an
   * earlier pass.
   */
  const next = text.replace(/\[((?:[^[\]]|\[[^\]]*\])*)\]\(([^)]+)\)/g, (whole, label, href) => {
    const full = href.startsWith("#") ? `${page}${href}` : href;
    if (!targets.has(href) && !targets.has(full) && !targets.has(href.split("#")[0])) return whole;
    count += 1;
    return label;
  });

  if (count) {
    writeFileSync(file, next);
    total += count;
    const game = page.split("/")[2];
    perGame.set(game, (perGame.get(game) || 0) + count);
  }
}

if (!total) {
  console.log("No dead links reported.");
} else {
  console.log(`Rendered ${total} dead links as plain text:`);
  for (const [game, n] of [...perGame].sort((a, b) => b[1] - a[1])) console.log(`  ${game}: ${n}`);
  console.log("\nRebuild and run again — neutralising a link can reveal another.");
}
