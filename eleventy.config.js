import { HtmlBasePlugin } from "@11ty/eleventy";

import { slugify } from "./lib/slugify.js";
import { basePath, withBasePath } from "./lib/base-path.js";
import { buildGames } from "./lib/registry.js";
import { cleanHeadingText, explicitHeadingId } from "./lib/headings.js";
import { enhanceHeadings } from "./lib/heading-tools.js";

const GAME_URL_RE = /^\/games\/([^/]+)\//;

/** Lazily-built registry, used only when a shortcode has no data cascade. */
let fallbackGames = null;
function getFallbackGames() {
  if (!fallbackGames) fallbackGames = buildGames();
  return fallbackGames;
}

/**
 * Finds the game a shortcode is running inside.
 *
 * `gameSlug` is propagated to every in-game page by `games.11tydata.js`; the
 * URL is only parsed as a fallback for templates outside that cascade.
 */
function resolveGame(ctx = {}) {
  const slug = ctx.gameSlug || GAME_URL_RE.exec(ctx.page?.url || "")?.[1] || null;
  if (!slug) return { slug: null, game: null };
  const games = ctx.games || getFallbackGames();
  return { slug, game: games?.[slug] || null };
}

/** A cross-link miss is a content bug, not a build failure. */
function warnMiss(kind, label, gameSlug, page) {
  const where = page?.inputPath || page?.url || "unknown page";
  console.warn(
    `[${kind}] "${label}" has no match in ${gameSlug ? `game "${gameSlug}"` : "any game"} (${where}) — rendered as plain text`,
  );
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default function (eleventyConfig) {
  eleventyConfig.setTemplateFormats(["njk", "md"]);

  const prefix = basePath();

  /*
   * Rewrites every href/src in the output when the site is served from a
   * subpath. Authored URLs stay root-absolute either way, so nothing in a
   * template or a content file has to know where the site is hosted.
   */
  eleventyConfig.addPlugin(HtmlBasePlugin);

  // Exposed to templates and, via a body attribute, to the client modules that
  // build URLs themselves — those are out of the plugin's reach.
  eleventyConfig.addGlobalData("basePath", prefix);
  eleventyConfig.addFilter("basePath", (url) => withBasePath(url, prefix));

  // Raw source material and working drafts are never read as templates and
  // never published.
  eleventyConfig.ignores.add("src/games/**/_source/**");
  eleventyConfig.ignores.add("src/games/**/_working/**");

  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addPassthroughCopy("src/games/**/images/**/*");
  eleventyConfig.addPassthroughCopy({ "src/_redirects": "_redirects" });

  eleventyConfig.setServerOptions({ showAllHosts: true });

  // ---------------------------------------------------------------- filters

  eleventyConfig.addFilter("slug", slugify);

  eleventyConfig.addFilter("stripHtml", (content) =>
    String(content || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim(),
  );

  eleventyConfig.addFilter("excerpt", (content, length = 200) => {
    const text = String(content || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (text.length <= length) return text;
    return `${text.slice(0, length).replace(/\s+\S*$/, "")}…`;
  });

  eleventyConfig.addFilter("readableDate", (value) =>
    new Date(value).toLocaleDateString("en-GB", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
  );

  /** Groups an array of objects into `[{ key, items }]` by a leading letter. */
  eleventyConfig.addFilter("groupByInitial", (items, key = "term") => {
    const groups = new Map();
    for (const item of items || []) {
      const initial = String(item?.[key] || "#").charAt(0).toUpperCase();
      const bucket = /[A-Z]/.test(initial) ? initial : "#";
      if (!groups.has(bucket)) groups.set(bucket, []);
      groups.get(bucket).push(item);
    }
    return [...groups.entries()]
      .map(([letter, entries]) => ({ letter, items: entries }))
      .sort((a, b) => a.letter.localeCompare(b.letter));
  });

  /**
   * Attaches per-heading UI to rendered content and re-homes retired anchors.
   *
   * Rendering this here rather than in the markdown pipeline keeps the decision
   * with the layout that knows whether a page's headings are bookmarkable.
   */
  eleventyConfig.addFilter("enhanceHeadings", (content, options = {}) =>
    enhanceHeadings(content, { ...options, basePath: prefix }),
  );

  // ------------------------------------------------------------- shortcodes

  /**
   * `{% term "label" %}` / `{% term "labels", "label" %}`
   * Links a word in running text to its glossary entry in the current game.
   */
  eleventyConfig.addShortcode("term", function (label, explicitSlug) {
    const { slug: gameSlug, game } = resolveGame(this.ctx || {});
    const text = escapeHtml(label);
    if (!game) {
      warnMiss("term", label, gameSlug, this.page);
      return text;
    }
    const wanted = slugify(explicitSlug || label);
    const match = game.glossary.find(
      (entry) =>
        entry.slug === wanted ||
        slugify(entry.term) === wanted ||
        entry.aliases.includes(wanted),
    );
    if (!match) {
      warnMiss("term", label, gameSlug, this.page);
      return text;
    }
    return `<a class="term-link" href="/games/${gameSlug}/glossary/${match.slug}/">${text}</a>`;
  });

  /**
   * `{% rule "label" %}` / `{% rule "label", "section-slug" %}`
   * Links to a rulebook H2 anchor in the current game.
   */
  eleventyConfig.addShortcode("rule", function (label, explicitSlug) {
    const { slug: gameSlug, game } = resolveGame(this.ctx || {});
    const text = escapeHtml(label);
    if (!game) {
      warnMiss("rule", label, gameSlug, this.page);
      return text;
    }
    const wanted = slugify(explicitSlug || label);
    // Anchor first, then heading text. Shallower headings win a tie, so a
    // label that names both an H2 and one of its H3s lands on the section.
    const candidates = game.rules
      .filter((section) => section.slug === wanted || slugify(section.title) === wanted)
      .sort((a, b) => (a.slug === wanted ? -1 : 0) - (b.slug === wanted ? -1 : 0) || a.level - b.level);
    const match = candidates[0];
    if (!match) {
      warnMiss("rule", label, gameSlug, this.page);
      return text;
    }
    return `<a class="rule-link" href="/games/${gameSlug}/rulebook/#${match.slug}">${text}</a>`;
  });

  /** `{% figure "/path.jpg", "alt text", "caption" %}` */
  eleventyConfig.addShortcode("figure", function (src, alt, caption) {
    const figcaption = caption
      ? `\n  <figcaption>${escapeHtml(caption)}</figcaption>`
      : "";
    return `<figure class="figure">\n  <img src="${escapeHtml(src)}" alt="${escapeHtml(alt || "")}" loading="lazy">${figcaption}\n</figure>`;
  });

  /**
   * The one structured-content block. Everything that would otherwise reach for
   * custom markdown syntax — notes, asides, errata, examples — is this.
   *
   *   {% callout %}…{% endcallout %}              a plain aside
   *   {% callout "Errata" %}…{% endcallout %}     with a heading
   *   {% callout inline=true %}…{% endcallout %}  inside a paragraph or list item
   *
   * The body is left as markdown: the blank lines around it let markdown-it
   * pick it back up after the HTML block, so a callout can hold lists, emphasis
   * and cross-link shortcodes like any other content.
   */
  eleventyConfig.addPairedShortcode("callout", function (content, titleOrOptions, extra) {
    const isOptions = (value) => value && typeof value === "object";
    const options = isOptions(titleOrOptions) ? titleOrOptions : isOptions(extra) ? extra : {};
    const title = typeof titleOrOptions === "string" ? titleOrOptions : options.title || "";
    const body = String(content || "").trim();

    if (options.inline) {
      return `<span class="callout callout--inline">${body}</span>`;
    }

    const heading = title ? `<p class="callout__title">${escapeHtml(title)}</p>\n` : "";
    return `<aside class="callout">\n${heading}\n${body}\n\n</aside>`;
  });

  // --------------------------------------------------------------- markdown

  eleventyConfig.amendLibrary("md", (md) => {
    md.set({ html: true, typographer: true });

    const defaultRender = (tokens, idx, options, _env, self) =>
      self.renderToken(tokens, idx, options);

    /**
     * Assigns anchor IDs to H2–H6.
     *
     * Mirrors `lib/headings.js` exactly — the TOC, the `{% rule %}` shortcode
     * and the rendered anchors all have to agree on the same slug.
     */
    md.core.ruler.push("heading-anchors", (state) => {
      const seen = new Map();
      for (let i = 0; i < state.tokens.length; i += 1) {
        const token = state.tokens[i];
        if (token.type !== "heading_open" || !/^h[2-6]$/.test(token.tag)) continue;

        const inline = state.tokens[i + 1];
        const raw = inline?.content || "";
        const explicit = explicitHeadingId(raw);
        const title = cleanHeadingText(raw);
        const base = explicit ? slugify(explicit) : slugify(title) || "section";
        const count = seen.get(base) || 0;
        seen.set(base, count + 1);
        token.attrSet("id", count === 0 ? base : `${base}-${count + 1}`);

        // Strip the `{: #id}` marker out of the visible heading text.
        if (inline) {
          inline.content = cleanHeadingText(inline.content);
          if (Array.isArray(inline.children)) {
            for (let c = inline.children.length - 1; c >= 0; c -= 1) {
              const child = inline.children[c];
              if (child.type !== "text") continue;
              const stripped = child.content.replace(/\s*\{:?\s*#[A-Za-z0-9_-]+\s*\}\s*$/, "");
              if (stripped !== child.content) {
                child.content = stripped;
                break;
              }
            }
          }
        }
      }
    });

    md.renderer.rules.table_open = (tokens, idx, options, env, self) =>
      `<div class="table-scroll" tabindex="0" role="region" aria-label="Table">${defaultRender(tokens, idx, options, env, self)}`;

    md.renderer.rules.table_close = (tokens, idx, options, env, self) =>
      `${defaultRender(tokens, idx, options, env, self)}</div>`;
  });

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      data: "_data",
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    templateFormats: ["njk", "md"],
    pathPrefix: prefix,
  };
}
