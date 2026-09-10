/**
 * The single slug function for the whole project.
 *
 * Used for anchor IDs, glossary term slugs, URL segments and for matching
 * `{% term %}` / `{% rule %}` labels against their targets. Every one of those
 * must agree, so there is exactly one implementation and everything imports it.
 */
export function slugify(input) {
  return String(input ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/['\u2019]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Title-cases a slug for display when nothing better is available. */
export function titleFromSlug(slug) {
  return String(slug ?? "")
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
