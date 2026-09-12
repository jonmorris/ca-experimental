/**
 * Template data for the synthesised My Reference page.
 *
 * These have to be computed in JavaScript rather than in frontmatter: `game`
 * and `contentType` are objects the layouts walk, and a frontmatter
 * `eleventyComputed` entry can only interpolate a string — which is how the
 * page first shipped with `data-game="[object Object]"` and a reference page
 * that could never find its own bookmarks.
 */
export default {
  eleventyComputed: {
    game: (data) => data.refGame || null,
    contentType: (data) =>
      data.refGame?.contentTypes.find((type) => type.slug === "my-reference") || null,
  },
};
