#!/usr/bin/env node
/**
 * Fetches the site's webfonts and commits them locally.
 *
 * Fonts are self-hosted rather than linked from a CDN: no third-party request
 * on page load, nothing to fail on a bad connection at a table, no flash of
 * fallback text, and print gets the real faces. The trade is binaries in the
 * repository, so this script records exactly where each one came from and
 * fetches the OFL licence alongside it.
 *
 * Only the latin subset is kept — the full set carries Cyrillic, Greek,
 * Vietnamese and latin-ext that this site has no use for, at several times
 * the weight.
 *
 * Usage: node scripts/fetch-fonts.mjs
 * Re-run only to add a face or take one up a version; the output is committed.
 */

import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";

const FONTS_DIR = join(process.cwd(), "src", "assets", "fonts");
const CSS_PATH = join(process.cwd(), "src", "assets", "css", "fonts.css");

// A modern UA is required or Google serves legacy TTF instead of woff2.
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// Latin only. The rules text this site carries is English; latin-ext adds
// roughly 40% weight for characters nothing here uses. Revisit if a game's
// content ever needs them.
const KEEP_SUBSETS = new Set(["latin"]);

/**
 * The faces the site uses.
 *
 * `family` is the Google Fonts query; `dir` is where the files land; `licence`
 * is the path to the family's OFL in the google/fonts repository.
 */
const FAMILIES = [
  {
    name: "Literata",
    dir: "literata",
    query: "Literata:ital,opsz,wght@0,7..72,400..700;1,7..72,400..700",
    licence: "ofl/literata/OFL.txt",
    note: "Editorial body text — designed for long-form reading on screen.",
  },
  {
    name: "Fraunces",
    dir: "fraunces",
    query: "Fraunces:opsz,wght@9..144,500..800",
    licence: "ofl/fraunces/OFL.txt",
    note: "Editorial display — page titles and section headings only.",
  },
  {
    name: "Public Sans",
    dir: "public-sans",
    query: "Public+Sans:ital,wght@0,400..700;1,400",
    licence: "ofl/publicsans/OFL.txt",
    note: "Editorial UI — navigation, labels, controls.",
  },
  {
    name: "IBM Plex Sans",
    dir: "ibm-plex-sans",
    // Plex Sans has a variable face; Serif and Mono are still static weights.
    query: "IBM+Plex+Sans:ital,wght@0,400..700;1,400..600",
    licence: "ofl/ibmplexsans/OFL.txt",
    note: "Precision UI and body sans.",
  },
  {
    name: "IBM Plex Serif",
    dir: "ibm-plex-serif",
    query: "IBM+Plex+Serif:ital,wght@0,400;0,600;1,400",
    licence: "ofl/ibmplexserif/OFL.txt",
    note: "Precision body serif — the serif option in reading preferences.",
  },
  {
    name: "IBM Plex Mono",
    dir: "ibm-plex-mono",
    query: "IBM+Plex+Mono:wght@400;600",
    licence: "ofl/ibmplexmono/OFL.txt",
    note: "Precision figures, rule numbers and anchors.",
  },
];

async function get(url, asText = true) {
  const response = await fetch(url, { headers: { "user-agent": UA } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
  return asText ? response.text() : Buffer.from(await response.arrayBuffer());
}

/**
 * Splits the Google Fonts stylesheet into blocks, each preceded by a comment
 * naming its subset, and keeps the ones worth shipping.
 */
function parseFaces(css) {
  const faces = [];
  const blockRe = /\/\*\s*([a-z-]+)\s*\*\/\s*@font-face\s*\{([^}]+)\}/g;

  for (const match of css.matchAll(blockRe)) {
    const subset = match[1];
    if (!KEEP_SUBSETS.has(subset)) continue;

    const body = match[2];
    const field = (name) => body.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1]?.trim();
    const url = body.match(/url\(([^)]+)\)/)?.[1];
    if (!url) continue;

    faces.push({
      subset,
      url,
      style: field("font-style") || "normal",
      weight: field("font-weight") || "400",
      unicodeRange: field("unicode-range") || "",
    });
  }

  return faces;
}

function fileNameFor(family, face) {
  const weight = face.weight.replace(/\s+/g, "-");
  return `${family.dir}-${face.style}-${weight}-${face.subset}.woff2`;
}

async function main() {
  await rm(FONTS_DIR, { recursive: true, force: true });
  await mkdir(FONTS_DIR, { recursive: true });

  const blocks = [];
  let total = 0;

  for (const family of FAMILIES) {
    const dir = join(FONTS_DIR, family.dir);
    await mkdir(dir, { recursive: true });

    const css = await get(
      `https://fonts.googleapis.com/css2?family=${family.query}&display=swap`,
    );
    const faces = parseFaces(css);
    if (!faces.length) throw new Error(`No latin faces found for ${family.name}`);

    blocks.push(`/* ${family.name} — ${family.note} */`);

    for (const face of faces) {
      const bytes = await get(face.url, false);
      const fileName = fileNameFor(family, face);
      await writeFile(join(dir, fileName), bytes);
      total += bytes.length;

      blocks.push(
        [
          "@font-face {",
          `  font-family: "${family.name}";`,
          `  font-style: ${face.style};`,
          `  font-weight: ${face.weight};`,
          "  font-display: swap;",
          // Relative to this stylesheet, not root-absolute: `HtmlBasePlugin`
          // rewrites href and src in markup but never looks inside CSS, so a
          // root-absolute font URL misses the deploy prefix and every face
          // 404s on a subpath host. `../fonts/` resolves correctly from
          // /assets/css/ under any prefix, including none.
          `  src: url("../fonts/${family.dir}/${fileName}") format("woff2");`,
          `  unicode-range: ${face.unicodeRange};`,
          "}",
        ].join("\n"),
      );

      console.log(
        `  ${family.name} ${face.style} ${face.weight} ${face.subset} — ${(bytes.length / 1024).toFixed(1)}KB`,
      );
    }

    const licence = await get(
      `https://raw.githubusercontent.com/google/fonts/main/${family.licence}`,
    );
    await writeFile(join(dir, "OFL.txt"), licence);
  }

  const header = [
    "/*",
    " * Self-hosted webfaces. Generated by scripts/fetch-fonts.mjs — do not edit.",
    " *",
    " * All families are licensed under the SIL Open Font License; each family's",
    " * directory carries its OFL.txt. Only the latin subset is shipped.",
    " */",
    "",
  ].join("\n");

  await writeFile(CSS_PATH, `${header}${blocks.join("\n\n")}\n`);
  console.log(`\n${(total / 1024).toFixed(0)}KB of woff2 across ${FAMILIES.length} families.`);
  console.log(`Wrote ${CSS_PATH}`);
}

await main();
