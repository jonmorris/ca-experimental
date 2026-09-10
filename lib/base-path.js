/**
 * The path the site is served from.
 *
 * Cloudflare Pages — the deploy target in the requirements — serves from a
 * root domain, so the default is `/` and every URL in the site is
 * root-absolute, exactly as the URL contract describes.
 *
 * A GitHub project Pages site is served from `/{repo}/` instead. Setting
 * `PATH_PREFIX` builds for that, without changing a single authored URL: the
 * prefix is applied to the output. The URL contract is unchanged — it just
 * hangs off a different root.
 */

/** Normalises any input to a leading-and-trailing-slashed prefix, or "/". */
export function normalizeBasePath(value) {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "/") return "/";
  return `/${raw.replace(/^\/+|\/+$/g, "")}/`;
}

export function basePath() {
  return normalizeBasePath(process.env.PATH_PREFIX);
}

/** Prefixes a root-absolute site URL. Leaves anything else alone. */
export function withBasePath(url, prefix = basePath()) {
  const path = String(url ?? "");
  if (prefix === "/" || !path.startsWith("/")) return path;
  if (path.startsWith(prefix)) return path;
  return `${prefix}${path.slice(1)}`;
}
