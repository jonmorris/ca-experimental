import { slugify } from "./slugify.js";

const HEADING_RE = /^(#{2,6})\s+(.+?)\s*$/;
// Explicit anchors are written `## Setup {: #setup}`.
//
// The kramdown-style `{: ... }` form is used rather than the more common
// `{#...}` because Nunjucks — which renders markdown files before markdown-it
// sees them — reads `{#` as the start of a comment. `{#id}` is still accepted
// for content that arrives pre-escaped.
const EXPLICIT_ID_RE = /\s*\{:?\s*#([A-Za-z0-9_-]+)\s*\}\s*$/;
const FENCE_RE = /^\s*(```|~~~)/;

/**
 * Strips template syntax, inline markup and link wrappers out of heading text
 * so the TOC shows the same words a reader sees.
 */
export function cleanHeadingText(raw = "") {
  return String(raw)
    .replace(EXPLICIT_ID_RE, "")
    .replace(/\{%[-\s]*raw[-\s]*%\}|\{%[-\s]*endraw[-\s]*%\}/g, "")
    .replace(/\{%.*?%\}/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/[*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Reads the `{#explicit-id}` suffix off a heading, if present. */
export function explicitHeadingId(raw = "") {
  const match = EXPLICIT_ID_RE.exec(String(raw));
  return match ? match[1] : null;
}

/**
 * Resolves a heading's anchor. Explicit IDs win; otherwise the slugified
 * title is used. `seen` de-duplicates repeated titles within one document so
 * an anchor always points at exactly one heading.
 */
export function headingAnchor(raw, seen) {
  const explicit = explicitHeadingId(raw);
  const title = cleanHeadingText(raw);
  const base = explicit ? slugify(explicit) : slugify(title) || "section";
  if (!seen) return base;
  const count = seen.get(base) || 0;
  seen.set(base, count + 1);
  return count === 0 ? base : `${base}-${count + 1}`;
}

/**
 * Extracts the heading outline of a markdown document.
 *
 * Returns every H2–H6 with its resolved anchor. Fenced code blocks are
 * skipped so a `## ` inside an example never becomes a section.
 */
export function parseHeadings(markdown = "") {
  const lines = String(markdown).split(/\r?\n/);
  const seen = new Map();
  const headings = [];
  let fence = null;
  let commented = false;

  for (const line of lines) {
    const fenceMatch = FENCE_RE.exec(line);
    if (fenceMatch) {
      if (!fence) fence = fenceMatch[1];
      else if (line.trim().startsWith(fence)) fence = null;
      continue;
    }
    if (fence) continue;

    /*
     * A heading inside an HTML comment is not a heading. Markdown renders
     * nothing for it, so listing it puts a section in the table of contents,
     * the section bar and the command palette that leads to an anchor no page
     * has — which is exactly what a commented-out "Quick Reference" block in
     * the Xia rulebook did.
     */
    const opens = line.lastIndexOf("<!--");
    const closes = line.lastIndexOf("-->");
    if (commented) {
      if (closes > -1 && closes > opens) commented = false;
      continue;
    }
    if (opens > -1 && closes < opens) {
      commented = true;
      continue;
    }

    const match = HEADING_RE.exec(line);
    if (!match) continue;

    const title = cleanHeadingText(match[2]);
    if (!title) continue;

    headings.push({
      level: match[1].length,
      title,
      slug: headingAnchor(match[2], seen),
      explicit: Boolean(explicitHeadingId(match[2])),
    });
  }

  return headings;
}

/** The H2s of a document — the sections that drive TOCs and bookmarks. */
export function parseSections(markdown = "") {
  return parseHeadings(markdown).filter((h) => h.level === 2);
}
