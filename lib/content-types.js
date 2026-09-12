import { titleFromSlug } from "./slugify.js";

/**
 * The content-type registry.
 *
 * A content type is a file at a game root (or expansion root). The filename is
 * the type slug and the URL segment. This table only supplies presentation
 * defaults — label, layout and nav order. It is deliberately not a whitelist:
 * a game-specific type (`strategy-primer.md`, `scenario-guide.md`) that is not
 * listed here still builds, using the generic article layout, so adding one
 * never requires a code change.
 *
 * Sections are bookmarkable everywhere by default. It was the rulebook alone
 * at first, which assumed the rulebook is where you look things up — but a
 * summary's phase order or an FAQ's one awkward ruling is exactly as worth
 * saving, and a reader who has bookmarked a rulebook section does not expect
 * the same control to be missing one page over. A type opts out by setting
 * `bookmarkable: false`, which is for pages with nothing durable to point at
 * rather than a judgement about how useful the content is.
 */
export const CONTENT_TYPES = {
  /*
   * The one content type with no file behind it. Every game has it, it is
   * synthesised by the registry rather than authored, and what it contains is
   * assembled in the browser from the reader's own bookmarks — so there is
   * nothing here to bookmark, and order 5 puts it directly after Overview.
   */
  "my-reference": {
    label: "My Reference",
    layout: "layouts/game.njk",
    order: 5,
    bookmarkable: false,
  },
  rulebook: {
    label: "Rulebook",
    layout: "layouts/rulebook.njk",
    order: 10,
  },
  summary: {
    label: "Summary",
    layout: "layouts/article.njk",
    order: 20,
  },
  glossary: {
    label: "Glossary",
    layout: "layouts/glossary.njk",
    order: 30,
  },
  /*
   * The index opts out. Every entry on it is already a pointer to a rulebook
   * section, so a bookmark here would save a signpost rather than the thing it
   * points at — and the reader ends up with two entries meaning one place.
   */
  index: {
    label: "Index",
    layout: "layouts/index-page.njk",
    order: 40,
    bookmarkable: false,
  },
};

/** Applied to any content type not named above. */
export const GENERIC_CONTENT_TYPE = {
  layout: "layouts/article.njk",
  order: 100,
  bookmarkable: true,
};

/** Directories inside a game that are never content. */
export const NON_CONTENT_DIRS = new Set(["_source", "_working", "images", "downloads"]);

export function contentTypeDefaults(typeSlug) {
  const known = CONTENT_TYPES[typeSlug];
  return {
    label: known?.label ?? titleFromSlug(typeSlug),
    layout: known?.layout ?? GENERIC_CONTENT_TYPE.layout,
    order: known?.order ?? GENERIC_CONTENT_TYPE.order,
    bookmarkable: known?.bookmarkable ?? GENERIC_CONTENT_TYPE.bookmarkable,
  };
}
