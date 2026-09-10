/**
 * Post-processes rendered content HTML to attach per-heading UI.
 *
 * Two jobs:
 *
 * 1. **Anchor aliases.** Section anchors are permanent. When a section is
 *    renamed its old anchor is declared in the file's `anchorAliases`
 *    frontmatter and an empty target is emitted just before the heading, so
 *    old bookmarks and inbound links still land in the right place.
 *
 * 2. **Heading tools.** A permalink and — on bookmarkable content types — a
 *    bookmark toggle, rendered next to every H2. The toggle ships in the
 *    markup so print styles and the tab order see it, but starts `hidden`
 *    and is revealed by `bookmarks-ui.js`; without JS there is no dead button.
 */

const H2_RE = /<h2 id="([^"]+)"([^>]*)>([\s\S]*?)<\/h2>/g;

function escapeAttr(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripTags(value) {
  return String(value ?? "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function aliasTargets(anchor, aliases) {
  return aliases
    .filter((alias) => alias.to === anchor)
    .map(
      (alias) =>
        `<span class="anchor-alias" id="${escapeAttr(alias.from)}" aria-hidden="true"></span>`,
    )
    .join("");
}

function bookmarkButton({ anchor, title, pageUrl, basePath }) {
  // `HtmlBasePlugin` rewrites href/src but not data attributes, so the one URL
  // that reaches the client through data has to carry the prefix itself.
  const url = basePath && basePath !== "/" && pageUrl.startsWith("/")
    ? `${basePath}${pageUrl.slice(1)}`
    : pageUrl;
  return [
    `<button type="button" class="bookmark-toggle" hidden`,
    ` data-bookmark-anchor="${escapeAttr(anchor)}"`,
    ` data-bookmark-title="${escapeAttr(title)}"`,
    ` data-bookmark-url="${escapeAttr(`${url}#${anchor}`)}"`,
    ` aria-pressed="false"`,
    ` aria-label="Bookmark section: ${escapeAttr(title)}">`,
    `<svg class="bookmark-toggle__icon" viewBox="0 0 16 20" width="16" height="20" aria-hidden="true" focusable="false">`,
    `<path d="M2.5 1.5h11a1 1 0 0 1 1 1v15.2a.6.6 0 0 1-.94.49L8 14.2l-5.56 4a.6.6 0 0 1-.94-.5V2.5a1 1 0 0 1 1-1Z"/>`,
    `</svg>`,
    `<span class="bookmark-toggle__label">Bookmark</span>`,
    `</button>`,
  ].join("");
}

function permalinkAnchor({ anchor, title }) {
  return [
    `<a class="heading-permalink" href="#${escapeAttr(anchor)}"`,
    ` aria-label="Permalink to section: ${escapeAttr(title)}">`,
    `<span aria-hidden="true">#</span>`,
    `</a>`,
  ].join("");
}

export function enhanceHeadings(content, options = {}) {
  const html = String(content || "");
  const { bookmarkable = false, pageUrl = "", anchorAliases = [], basePath = "/" } = options;
  const aliases = Array.isArray(anchorAliases) ? anchorAliases : [];

  return html.replace(H2_RE, (_match, anchor, attrs, inner) => {
    const title = stripTags(inner);
    const tools = [
      permalinkAnchor({ anchor, title }),
      bookmarkable ? bookmarkButton({ anchor, title, pageUrl, basePath }) : "",
    ].join("");

    return [
      aliasTargets(anchor, aliases),
      `<div class="section-heading${bookmarkable ? " section-heading--bookmarkable" : ""}">`,
      `<h2 id="${escapeAttr(anchor)}"${attrs}>${inner}</h2>`,
      `<span class="heading-tools">${tools}</span>`,
      `</div>`,
    ].join("");
  });
}
