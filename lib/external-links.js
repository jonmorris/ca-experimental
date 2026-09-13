/**
 * Sends every link that leaves the site to a new tab.
 *
 * A rule rather than a habit: applied to the built HTML, so it covers links
 * written in a template, links written in a rulebook's markdown, and links
 * added by whoever adds the next page — none of which have to remember it.
 *
 * Why a new tab at all, when the usual advice is to let the reader choose: a
 * reader here is mid-rulebook, often mid-game, and the state that makes this
 * site useful — how far down a long page they are, which section the bar is
 * tracking — is not in the URL. Following a publisher's link and coming back
 * with the back button lands them at the top of the rulebook, looking for
 * their place. Games are the one place that is expensive.
 *
 * `noopener` and `noreferrer` go with it. The first is what stops the opened
 * page from reaching back through `window.opener`; the second is the same
 * promise the site makes everywhere else about not narrating the reader.
 *
 * Internal is by host, not by shape: an absolute link to the site's own domain
 * is still internal, and a relative one is internal whatever the deployment
 * prefix does to it later. Anything that is not http(s) — `mailto:`, an
 * in-page `#anchor` — is left alone.
 */

const ANCHOR_RE = /<a\b([^>]*)>/gi;
const ABSOLUTE_RE = /^(?:https?:)?\/\//i;

function hostOf(url) {
  try {
    return new URL(url, "https://example.invalid").host.toLowerCase();
  } catch {
    return "";
  }
}

function isExternal(href, siteHost) {
  if (!ABSOLUTE_RE.test(href)) return false;
  const host = hostOf(href.startsWith("//") ? `https:${href}` : href);
  return Boolean(host) && host !== siteHost;
}

export function markExternalLinks(html, { siteUrl = "" } = {}) {
  if (!html || !html.includes("<a")) return html;
  const siteHost = hostOf(siteUrl);

  return html.replace(ANCHOR_RE, (tag, attrs) => {
    const href = /\shref="([^"]*)"/i.exec(attrs)?.[1];
    if (!href || !isExternal(href, siteHost)) return tag;

    // An explicit target is a decision someone already made. Leave it.
    if (/\starget\s*=/i.test(attrs)) return tag;

    const relMatch = /\srel="([^"]*)"/i.exec(attrs);
    const rel = new Set((relMatch?.[1] || "").split(/\s+/).filter(Boolean));
    rel.add("noopener");
    rel.add("noreferrer");

    const withRel = relMatch
      ? attrs.replace(relMatch[0], ` rel="${[...rel].join(" ")}"`)
      : `${attrs} rel="${[...rel].join(" ")}"`;

    return `<a${withRel} target="_blank">`;
  });
}
