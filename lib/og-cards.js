import { existsSync, mkdirSync, statSync } from "node:fs";
import { join } from "node:path";

import sharp from "sharp";

/**
 * The image a link to this site unfurls into, drawn at build time.
 *
 * A shared link is the first thing most people will ever see of a page here,
 * and without one of these it is a bare URL — no title, no picture, nothing to
 * say what it leads to. Every platform that draws a card wants the same thing:
 * one landscape image at a fixed size, fetched from an absolute URL.
 *
 * Box art cannot be that image as it stands. It arrives at whatever
 * proportions the publisher used, and a card is 1.91:1 — so a portrait cover
 * handed over raw is either cropped through the middle or pillarboxed against
 * whatever grey the platform paints. Each one is composited onto a card-shaped
 * ground here instead, which is the same treatment the shelf and the overview
 * give it: the art contained whole, centred, on a quiet surface.
 *
 * There is no text on the card. Every platform draws the title and description
 * from the page's own tags right beside the image, so text here would be a
 * second copy at a size nobody chose — and drawing it would mean shipping a
 * font to the rasteriser and matching what the site does with it. The card is
 * the picture; the words are the words.
 */

/* The editorial design's sunken surface, which is what the art sits on in the
 * shelf and on an overview. Written out rather than read from the stylesheet:
 * this is a raster, and it cannot resolve a custom property. */
const GROUND = { r: 242, g: 237, b: 225, alpha: 1 };

const WIDTH = 1200;
const HEIGHT = 630;

/* The art's room inside the card. The margin is wide enough that a platform
 * cropping a little off each edge — several do, at several ratios — takes
 * ground rather than artwork. */
const MAX_ART_WIDTH = 740;
const MAX_ART_HEIGHT = 450;

/** The mark, for every page that is not about one game. */
const DEFAULT_MARK_SIZE = 280;

/**
 * A soft shadow under the art, so it reads as an object on a surface rather
 * than a picture pasted onto a colour. Drawn as a blurred rectangle the size of
 * the art and composited behind it, which is the raster equivalent of the
 * `drop-shadow` the pages use.
 */
async function shadowFor(width, height) {
  const pad = 60;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width + pad * 2}" height="${height + pad * 2}">
    <rect x="${pad}" y="${pad}" width="${width}" height="${height}" rx="3" fill="rgb(40,33,20)" opacity="0.30"/>
  </svg>`;
  return sharp(Buffer.from(svg)).blur(22).png().toBuffer();
}

/** Scales to fit inside the art box without ever scaling up. */
function containedSize({ width, height }) {
  const scale = Math.min(MAX_ART_WIDTH / width, MAX_ART_HEIGHT / height, 1);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

async function composeCard(artBuffer, artSize, outPath) {
  const { width, height } = containedSize(artSize);
  const art = await sharp(artBuffer).resize(width, height, { fit: "inside" }).png().toBuffer();

  const left = Math.round((WIDTH - width) / 2);
  const top = Math.round((HEIGHT - height) / 2);

  const pad = 60;
  const shadow = await shadowFor(width, height);

  await sharp({ create: { width: WIDTH, height: HEIGHT, channels: 4, background: GROUND } })
    .composite([
      // Offset down a few pixels, the way a shadow falls on every other
      // surface on the site.
      { input: shadow, left: left - pad, top: top - pad + 8 },
      { input: art, left, top },
    ])
    /*
     * JPEG, not PNG. These are photographs of printed boxes, which is what
     * JPEG is for — the same card comes out around a tenth of the weight, and
     * a platform fetching it on a scrape has no patience for half a megabyte.
     */
    .jpeg({ quality: 88, mozjpeg: true, chromaSubsampling: "4:4:4" })
    .toFile(outPath);
}

/** Skips a card whose source has not changed since it was drawn. */
function isFresh(outPath, sourcePath) {
  if (!existsSync(outPath)) return false;
  try {
    return statSync(outPath).mtimeMs >= statSync(sourcePath).mtimeMs;
  } catch {
    return false;
  }
}

/**
 * The source file behind a game's card, or null where there is none.
 *
 * `box_art` is a site path — /games/{slug}/images/x.png — and the file it names
 * sits at the same shape in the source tree.
 */
function artSourceFor(game) {
  const boxArt = game?.meta?.box_art;
  if (!boxArt) return null;
  const sourcePath = join("src", boxArt.replace(/^\/+/, ""));
  return existsSync(sourcePath) ? sourcePath : null;
}

/**
 * Which games will have a card, worked out without drawing one.
 *
 * The templates need this answer before the cards exist: pages render first and
 * the images are composited after the build has written them, so a set filled
 * in by the drawing step is always one build too late — every page would name
 * the default card, on every build, and the per-game cards would sit there
 * unreferenced. It is the same test the drawing loop uses, so the two cannot
 * drift: a game has a card exactly when there is art on disk to draw it from.
 */
export function cardSlugs(games) {
  return new Set(
    Object.entries(games || {})
      .filter(([, game]) => artSourceFor(game))
      .map(([slug]) => slug),
  );
}

/** Draws a card for every game with box art, plus the default. */
export async function buildOgCards({ games, outDir, markPath }) {
  mkdirSync(outDir, { recursive: true });

  const drawn = cardSlugs(games);

  for (const slug of drawn) {
    const sourcePath = artSourceFor(games[slug]);
    const outPath = join(outDir, `${slug}.jpg`);
    if (isFresh(outPath, sourcePath)) continue;

    const image = sharp(sourcePath);
    const metadata = await image.metadata();
    await composeCard(await image.png().toBuffer(), metadata, outPath);
  }

  const defaultOut = join(outDir, "default.jpg");
  if (!isFresh(defaultOut, markPath)) {
    // Rasterised well above its drawn size: the mark is a 32-unit viewBox, and
    // asking for it at 280px from that is how it comes out crisp.
    const mark = await sharp(markPath, { density: 1200 })
      .resize(DEFAULT_MARK_SIZE, DEFAULT_MARK_SIZE, { fit: "inside" })
      .png()
      .toBuffer();
    await composeCard(mark, { width: DEFAULT_MARK_SIZE, height: DEFAULT_MARK_SIZE }, defaultOut);
  }

  return drawn;
}
