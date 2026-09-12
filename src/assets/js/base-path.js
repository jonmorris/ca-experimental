/**
 * Where the site is served from, as handed to the client by the build.
 *
 * `HtmlBasePlugin` rewrites href and src in the markup, but these modules
 * construct a few URLs at runtime — the Pagefind bundle, the URLs Pagefind
 * returns, and stored bookmark links — and those have to be prefixed here.
 */
export const BASE_PATH = document.body?.dataset.basePath || "/";

/**
 * Removes the prefix from a path that carries it.
 *
 * Anything written to storage should be stored without it. `location.pathname`
 * arrives prefixed, and a URL saved that way is a record of where the site was
 * deployed when it was saved, not of what it points at — move the site to a
 * different prefix and every stored link breaks. Strip on the way in, prefix
 * on the way out.
 */
export function stripBasePath(path) {
  const value = String(path ?? "");
  if (BASE_PATH === "/" || !value.startsWith(BASE_PATH)) return value;
  return `/${value.slice(BASE_PATH.length)}`.replace(/^\/+/, "/");
}

/** Prefixes a root-absolute site path. Leaves anything else alone. */
export function withBasePath(path) {
  const value = String(path ?? "");
  if (BASE_PATH === "/" || !value.startsWith("/")) return value;
  if (value.startsWith(BASE_PATH)) return value;
  return `${BASE_PATH}${value.slice(1)}`;
}
