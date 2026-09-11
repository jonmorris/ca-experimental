import { buildGames } from "../../lib/registry.js";
import { withBasePath } from "../../lib/base-path.js";

/**
 * The command palette's index, embedded in every page at build time.
 *
 * Deliberately not fetched: at a table on bad wifi the palette has to open and
 * answer instantly, and this is small enough to inline. It carries navigation
 * targets only — pages, sections and glossary terms — while full-text search
 * stays with Pagefind, which is what it is good at.
 *
 * Every URL here is written through `withBasePath`. This index reaches the
 * client as JSON inside a script tag, and `HtmlBasePlugin` rewrites href and
 * src attributes only — so a URL that travels as data has to carry the deploy
 * prefix itself or every result 404s on a subpath host.
 */
export default function () {
  const entries = [];

  for (const game of Object.values(buildGames())) {
    entries.push({
      label: game.title,
      detail: "Overview",
      url: withBasePath(game.url),
      gameSlug: game.slug,
      gameTitle: game.title,
      group: "Pages",
    });

    for (const type of game.allContentTypes) {
      const expansion = game.expansions.find((e) => e.slug === type.expansionSlug);
      entries.push({
        label: expansion ? `${expansion.title}: ${type.label}` : type.label,
        detail: type.subhead || "",
        url: withBasePath(type.url),
        gameSlug: game.slug,
        gameTitle: game.title,
        group: "Pages",
      });

      // Sections of every content type, so a rule is reachable from anywhere
      // in the game, not only from the page it lives on.
      for (const section of type.sections) {
        entries.push({
          label: section.title,
          detail: expansion ? `${expansion.title} · ${type.label}` : type.label,
          url: `${withBasePath(type.url)}#${section.slug}`,
          gameSlug: game.slug,
          gameTitle: game.title,
          group: "Sections",
        });
      }
    }

    for (const term of game.glossary) {
      entries.push({
        label: term.term,
        detail: term.short,
        url: withBasePath(`${game.url}glossary/${term.slug}/`),
        gameSlug: game.slug,
        gameTitle: game.title,
        group: "Glossary",
      });
    }
  }

  return entries;
}
