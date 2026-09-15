/**
 * Back-fills the content state block into every content file.
 *
 * One time, and safe to run again. State lives in frontmatter and nowhere else
 * (see `docs/CONTENT-STATES.md`), so this exists to write the first honest
 * scores rather than to keep them: after this, a file's state changes because
 * somebody worked on the file.
 *
 * Every score here is inferred from what is observably true in the file, and
 * always downward when a signal is ambiguous. T3, T4, L3 and L4 are never
 * written: word for word verification and inbound coverage are human acts, and
 * nothing in a file reveals either. `stage` is always `audit`, and `audited` is
 * left out, because a date written by a script would be a claim that somebody
 * read the file.
 *
 *   node scripts/content-state.mjs           fill files that have no block yet
 *   node scripts/content-state.mjs --force   rescore every file
 *   node scripts/content-state.mjs --dry     print the summary, write nothing
 *
 * `--force` rewrites the five scored fields and leaves `audited` and
 * `blocked_by` alone: those are human work, and a rescore is not a reason to
 * throw them away.
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const CONTENT = join(ROOT, "src/games");
const SKIP_DIRS = new Set(["_source", "_working", "downloads", "images"]);

/*
 * Games whose publisher has given permission. Everything else reproduced from
 * a publisher stays at `requested`, which is the truth until somebody says
 * otherwise. Add a slug here and run again with --force.
 */
const GRANTED = new Set([]);

const SCORED = ["stage", "text", "images", "links", "rights"];

/* ------------------------------------------------------------- reading */

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      out.push(...walk(join(dir, entry.name)));
    } else if (entry.name.endsWith(".md")) {
      out.push(join(dir, entry.name));
    }
  }
  return out;
}

/** Splits a file into its frontmatter lines and everything after them. */
function split(source) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(source);
  if (!match) return null;
  return {
    frontmatter: match[1].split("\n"),
    body: source.slice(match[0].length),
    end: match[0].length,
  };
}

/** Top-level keys, in order, with the line each starts on. */
function keysOf(lines) {
  const keys = [];
  lines.forEach((line, index) => {
    const found = /^([A-Za-z_][\w-]*):(.*)$/.exec(line);
    if (found) keys.push({ key: found[1], value: found[2].trim(), index });
  });
  return keys;
}

const has = (keys, name) => keys.some((entry) => entry.key === name);

/* ------------------------------------------------------------- scoring */

const withoutComments = (body) => body.replace(/<!--[\s\S]*?-->/g, "");

/** The H2s, and whether each carries a manually set anchor. */
function headings(body) {
  const lines = body.split("\n").filter((line) => /^##\s+\S/.test(line));
  return {
    count: lines.length,
    anchored: lines.filter((line) => /\{:\s*#[a-z0-9-]+\s*\}\s*$/.test(line)).length,
  };
}

/**
 * How many entries a data-shaped file carries, and how many are more than a
 * bare term.
 *
 * A glossary and an index keep their substance in frontmatter rather than in
 * the body, so scoring their prose would score a one-line introduction. The
 * list is the content; this counts it.
 */
function dataEntries(lines) {
  const keys = keysOf(lines);
  const listKey = keys.find((entry) => (entry.key === "terms" || entry.key === "entries") && !entry.value);
  if (!listKey) return null;

  const next = keys.find((entry) => entry.index > listKey.index);
  const block = lines.slice(listKey.index + 1, next ? next.index : lines.length);

  let total = 0;
  let detailed = 0;
  let sawDetail = false;
  for (const line of block) {
    if (/^\s+-\s/.test(line)) {
      if (sawDetail) detailed += 1;
      sawDetail = false;
      total += 1;
      // A list item that already carries more than `term:` on its own line.
      if (!/^\s+-\s*term:/.test(line)) sawDetail = true;
    } else if (total && /^\s+\S/.test(line)) {
      sawDetail = true;
    }
  }
  if (sawDetail) detailed += 1;

  return { total, detailed };
}

function scoreText(body, lines) {
  const data = dataEntries(lines);
  if (data) {
    if (!data.total) return { level: "T0", why: "no entries" };
    if (data.detailed < data.total) return { level: "T1", why: "entries are bare terms" };
    return { level: "T2", why: `${data.total} structured entries` };
  }

  const prose = withoutComments(body).trim();
  if (!prose) return { level: "T0", why: "empty body" };

  const h2 = headings(body);
  if (!h2.count) return { level: "T1", why: "prose, no H2 structure" };
  if (!/\{%\s*\w/.test(body)) return { level: "T1", why: "H2 structure, no shortcodes" };
  return { level: "T2", why: `${h2.count} H2 sections, shortcodes present` };
}

function scoreImages(body, dir) {
  const referenced = /!\[|<img\b|\{%\s*figure/.test(body);
  if (referenced) {
    /*
     * Capped at I2. Whether an asset is cropped, named to convention and
     * rendering with alt text is a build's answer and a person's, not a
     * regular expression's.
     */
    return { level: "I2", why: "assets referenced in the body" };
  }

  const annotated = /<!--[^>]*\bimage\b/i.test(body);
  if (annotated) return { level: "I1", why: "image annotations present" };
  return { level: "I0", why: "no images, no annotations" };
}

function scoreLinks(body) {
  const h2 = headings(body);
  if (!h2.count) return { level: "L0", why: "no H2 sections" };
  if (h2.anchored < h2.count) {
    return { level: "L0", why: `${h2.count - h2.anchored} of ${h2.count} H2s without an anchor` };
  }

  const outbound = /\{%\s*(term|rule)\b/.test(body) || /\]\(\/games\//.test(body);
  if (!outbound) return { level: "L1", why: "anchored, no outbound links" };
  return { level: "L2", why: "anchored, outbound links present" };
}

function scoreRights(lines, gameSlug) {
  const keys = keysOf(lines);
  const official = keys.find((entry) => entry.key === "official");
  if (!official || !/^true\b/.test(official.value)) {
    return { level: "n/a", why: "written for this site" };
  }
  if (GRANTED.has(gameSlug)) return { level: "granted", why: "permission secured" };
  return { level: "requested", why: "publisher's text, no answer yet" };
}

/* ------------------------------------------------------------- writing */

/**
 * Where the block goes: above the first key whose value is a block.
 *
 * A rulebook is all scalars and the state lands under them. A glossary carries
 * three hundred lines of terms, and appending after them would put the file's
 * state where nobody scrolls. Either way it is near the top, in the same place
 * in every file.
 */
function insertionPoint(lines) {
  const keys = keysOf(lines);
  const block = keys.find((entry) => !entry.value);
  return block ? block.index : lines.length;
}

function stripExisting(lines) {
  const keys = keysOf(lines);
  const drop = new Set();

  for (const entry of keys) {
    if (!SCORED.includes(entry.key)) continue;
    drop.add(entry.index);
  }

  return lines.filter((_, index) => !drop.has(index));
}

function blockFor(scores) {
  return [
    `stage: audit`,
    `text: ${scores.text.level}`,
    `images: ${scores.images.level}`,
    `links: ${scores.links.level}`,
    `rights: ${scores.rights.level}`,
  ];
}

/* ---------------------------------------------------------------- main */

const args = new Set(process.argv.slice(2));
const force = args.has("--force");
const dry = args.has("--dry");

const files = walk(CONTENT).sort();
const counts = { text: {}, images: {}, links: {}, rights: {} };
const reasons = new Map();
const held = [];
let written = 0;
let skipped = 0;

for (const file of files) {
  const source = readFileSync(file, "utf8");
  const parts = split(source);
  const path = relative(ROOT, file);

  if (!parts) {
    console.warn(`  skipped  ${path} — no frontmatter`);
    skipped += 1;
    continue;
  }

  const already = has(keysOf(parts.frontmatter), "stage");
  if (already && !force) {
    skipped += 1;
    continue;
  }

  const gameSlug = relative(CONTENT, file).split("/")[0];
  const scores = {
    text: scoreText(parts.body, parts.frontmatter),
    images: scoreImages(parts.body, file),
    links: scoreLinks(parts.body),
    rights: scoreRights(parts.frontmatter, gameSlug),
  };

  for (const axis of Object.keys(counts)) {
    const level = scores[axis].level;
    counts[axis][level] = (counts[axis][level] || 0) + 1;
  }
  if (scores.text.why === "H2 structure, no shortcodes") held.push(path);

  /* Why a file landed where it did, which is the half a tally cannot show. */
  const reason = `${scores.text.level}  ${scores.text.why.replace(/^\d+/, "n")}`;
  reasons.set(reason, (reasons.get(reason) || 0) + 1);

  const lines = stripExisting(parts.frontmatter);
  const at = insertionPoint(lines);
  lines.splice(at, 0, ...blockFor(scores));

  const next = `---\n${lines.join("\n")}\n---\n${parts.body}`;
  if (!dry) writeFileSync(file, next);
  written += 1;
  console.log(
    `  ${already ? "rescored" : "  filled"}  ${path}\n` +
      `            ${scores.text.level} ${scores.images.level} ${scores.links.level} ` +
      `${scores.rights.level}  (${scores.text.why})`,
  );
}

const tally = (axis) =>
  Object.entries(counts[axis])
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([level, n]) => `${level}:${n}`)
    .join("  ") || "none";

console.log(`\n${dry ? "Would write" : "Wrote"} ${written} file${written === 1 ? "" : "s"}, skipped ${skipped}.`);
console.log(`  stage    audit:${written}`);
console.log(`  text     ${tally("text")}`);
console.log(`  images   ${tally("images")}`);
console.log(`  links    ${tally("links")}`);
console.log(`  rights   ${tally("rights")}`);
console.log(`  audited  omitted on every file. Absent means never audited.`);

console.log(`\nWhy the text scores landed where they did:`);
for (const [reason, n] of [...reasons].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(3)}  ${reason}`);
}

if (held.length) {
  console.log(
    `\nHeld at T1 for want of a shortcode, though the H2 structure is there.\n` +
      `These are the ones to look at first if T1 reads unfairly:`,
  );
  for (const path of held) console.log(`  ${path}`);
}

if (!GRANTED.size) {
  console.log(
    `\nNo games are listed as having permission, so every official document is\n` +
      `at "requested". Add slugs to GRANTED in this script and run with --force.`,
  );
}
