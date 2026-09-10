/**
 * Where the site is served from, as handed to the client by the build.
 *
 * `HtmlBasePlugin` rewrites href and src in the markup, but these modules
 * construct a few URLs at runtime — the Pagefind bundle, the URLs Pagefind
 * returns, and stored bookmark links — and those have to be prefixed here.
 */
export const BASE_PATH = document.body?.dataset.basePath || "/";

/** Prefixes a root-absolute site path. Leaves anything else alone. */
export function withBasePath(path) {
  const value = String(path ?? "");
  if (BASE_PATH === "/" || !value.startsWith("/")) return value;
  if (value.startsWith(BASE_PATH)) return value;
  return `${BASE_PATH}${value.slice(1)}`;
}
