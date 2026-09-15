/**
 * A reference, in a link.
 *
 * Somebody who has read a rulebook and bookmarked the eight sections their
 * group will actually stop to look up has done work worth handing round. This
 * is how it travels: the sections are written into the URL's fragment, and the
 * page at the other end renders them.
 *
 * In the fragment, which is the whole reason this can exist on a site with no
 * server. A fragment is never sent in the request — it does not reach a host,
 * a log or a referrer — so a shared reference is carried by the people passing
 * it around and stored nowhere.
 *
 *   #shared=rulebook~setup,faq~errata,the-blighted-reach~rulebook~act-i-setup
 *
 * Slugs only, and never any text. The link names sections; every word the page
 * then shows — the titles, the rules themselves — comes from the build. So a
 * link cannot put words in the site's mouth: the worst a mangled one can do is
 * name sections that do not exist, which are dropped.
 *
 * Readable rather than packed. Base64 of JSON would be shorter and would make
 * the link an opaque blob that nobody can sanity-check before pasting it into
 * a group chat, and the thing being shared here is a list of section names.
 */

export const SHARE_KEY = "shared";

/* What a slug can contain. Anything else in a link is somebody else's idea. */
const SLUG = /^[a-z0-9][a-z0-9._-]*$/;

/** `expansion::rule::anchor` — the key `my-reference.js` builds sections with. */
function toKey(expansion, rule, anchor) {
  return `${expansion}::${rule}::${anchor}`;
}

/**
 * Keys → the fragment's value.
 *
 * The order is the link's order: a reference somebody has arranged travels
 * arranged, and the sequence is the one thing a list of keys can carry for
 * free.
 */
export function encodeShare(keys) {
  const parts = [];
  for (const key of keys || []) {
    const [expansion, rule, anchor] = String(key).split("::");
    if (!rule || !anchor) continue;
    parts.push(expansion ? `${expansion}~${rule}~${anchor}` : `${rule}~${anchor}`);
  }
  return parts.join(",");
}

/**
 * A fragment → keys, or null when there is no share in it.
 *
 * Null and empty are different answers: a link with no `shared` is an ordinary
 * visit to somebody's own page, and a link whose sections were all rubbish is a
 * share that turned out to be empty — which the page says out loud rather than
 * silently showing the reader their own reference instead.
 */
export function decodeShare(hash) {
  const raw = String(hash || "").replace(/^#/, "");
  if (!raw) return null;

  const params = new URLSearchParams(raw);
  const value = params.get(SHARE_KEY);
  if (value === null) return null;

  const keys = [];
  const seen = new Set();
  for (const part of value.split(",")) {
    const pieces = part.split("~").map((piece) => piece.trim());
    if (pieces.length < 2 || pieces.length > 3) continue;
    if (!pieces.every((piece) => SLUG.test(piece))) continue;

    const [expansion, rule, anchor] = pieces.length === 3 ? pieces : ["", ...pieces];
    const key = toKey(expansion, rule, anchor);
    if (seen.has(key)) continue;
    seen.add(key);
    keys.push(key);
  }

  return keys;
}

/** The link to hand somebody, for this page and these sections. */
export function shareUrl(keys) {
  const encoded = encodeShare(keys);
  if (!encoded) return "";
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#${SHARE_KEY}=${encoded}`;
}
