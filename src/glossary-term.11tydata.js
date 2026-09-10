/**
 * Data for the paginated glossary term pages.
 *
 * Kept in JS rather than frontmatter because `game` has to resolve to the game
 * object itself — a frontmatter `eleventyComputed` string would stringify it.
 */
export default {
  eleventyComputed: {
    permalink: (data) => data.term?.url,
    title: (data) => data.term?.term,
    pageDescription: (data) => data.term?.short,
    gameSlug: (data) => data.term?.gameSlug || null,
    game: (data) => (data.term ? data.games?.[data.term.gameSlug] || null : null),
    contentTypeSlug: () => "glossary-term",
    breadcrumbSection: () => "Glossary",
    breadcrumbSectionUrl: (data) => (data.term ? `/games/${data.term.gameSlug}/glossary/` : null),
    eleventyExcludeFromCollections: () => true,
  },
};
