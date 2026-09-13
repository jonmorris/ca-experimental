/**
 * Builds a maximal Cardboard Appendix export: every game favourited, every
 * bookmarkable section bookmarked.
 *
 * Read out of the built site rather than the source data, so every record is
 * exactly what the page itself would have written — same anchors, same titles,
 * same unprefixed URLs. Build unprefixed first (`npm run build:site`): a
 * prefixed build would bake the deployment path into URLs that are stored
 * without one.
 *
 *   node scripts/make-max-export.mjs [outfile]
 *
 * The result imports through Reading preferences → Restore from a file, and is
 * for seeing what the site looks like at its limits — a Favorites row holding
 * every game, a My Reference page the length of a rulebook, the bookmark badge
 * in four figures.
 */
import { globSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SITE = fileURLToPath(new URL("../_site", import.meta.url));
const pages = globSync("**/index.html", { cwd: SITE });

const attr = (html, name) => {
  const m = html.match(new RegExp(`${name}="([^"]*)"`));
  return m ? m[1] : "";
};
const unescape = (s) =>
  s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
   .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'").replace(/&nbsp;/g, " ");

const bookmarks = [];
const favorites = new Map();
let stamp = Date.UTC(2026, 0, 1, 12, 0, 0);

for (const rel of pages.sort()) {
  const html = readFileSync(path.join(SITE, rel), "utf8");
  const body = html.slice(html.indexOf("<body"), html.indexOf(">", html.indexOf("<body")) + 1);
  const gameSlug = attr(body, "data-game");
  if (!gameSlug) continue;

  const gameTitle = unescape(attr(body, "data-game-title"));
  const gameUrl = attr(body, "data-game-url");
  if (gameUrl && !favorites.has(gameSlug)) {
    favorites.set(gameSlug, { gameSlug, gameTitle, gameUrl, addedAt: (stamp += 1000) });
  }

  /*
   * Stored URLs never carry the deployment prefix — `withBasePath` puts it on
   * at render time — so a prefixed build would bake it into every record and
   * the file would import as a set of dead links. Cheaper to refuse than to
   * discover it in the browser.
   */
  const basePath = attr(body, "data-base-path");
  if (basePath && basePath !== "/") {
    throw new Error(
      `${rel} was built with PATH_PREFIX=${basePath}. Run \`npm run build:site\` first.`,
    );
  }

  const ruleSlug = attr(body, "data-content-type");
  const expansionSlug = attr(body, "data-expansion");
  const expansionTitle = unescape(attr(body, "data-expansion-title"));
  const titleMatch = html.match(/<h1 class="page-title">([\s\S]*?)<\/h1>/);
  const ruleTitle = titleMatch ? unescape(titleMatch[1].replace(/<[^>]+>/g, "").trim()) : ruleSlug;
  const ruleUrl = `/${rel.replace(/index\.html$/, "")}`;

  for (const button of html.match(/<button[^>]*data-bookmark-anchor[^>]*>/g) || []) {
    bookmarks.push({
      gameSlug, gameTitle, expansionSlug, expansionTitle,
      ruleSlug, ruleTitle, ruleUrl,
      anchor: attr(button, "data-bookmark-anchor"),
      title: unescape(attr(button, "data-bookmark-title")),
      url: attr(button, "data-bookmark-url"),
      createdAt: (stamp += 1000),
    });
  }
}

const payload = {
  format: "cardboard-appendix",
  formatVersion: 1,
  exportedAt: new Date().toISOString(),
  bookmarks: { schemaVersion: 1, bookmarks },
  favorites: { schemaVersion: 1, games: [...favorites.values()] },
  history: { schemaVersion: 1, games: [] },
  preferences: {},
};

const out = process.argv[2] || fileURLToPath(new URL("../fixtures/cardboard-appendix-everything.json", import.meta.url));
writeFileSync(out, JSON.stringify(payload, null, 2) + "\n");

const perGame = {};
for (const b of bookmarks) perGame[b.gameSlug] = (perGame[b.gameSlug] || 0) + 1;
console.log(`games favourited: ${favorites.size}`);
console.log(`bookmarks: ${bookmarks.length}`);
console.log(`documents: ${new Set(bookmarks.map((b) => `${b.gameSlug}/${b.expansionSlug}/${b.ruleSlug}`)).size}`);
console.log("per game:", JSON.stringify(perGame, null, 0));
