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
 */
export const CONTENT_TYPES = {
  rulebook: {
    label: "Rulebook",
    layout: "layouts/rulebook.njk",
    order: 10,
    bookmarkable: true,
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
  index: {
    label: "Index",
    layout: "layouts/index-page.njk",
    order: 40,
  },
};

/** Applied to any content type not named above. */
export const GENERIC_CONTENT_TYPE = {
  layout: "layouts/article.njk",
  order: 100,
  bookmarkable: false,
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
