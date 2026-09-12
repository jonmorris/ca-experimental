#!/usr/bin/env python3
"""
Pulls the figures out of a rulebook PDF.

The hard part of porting a rulebook is not the text, it is the pictures: a
diagram of a turn, an annotated board corner, an example of a card being
played. Screenshotting them one at a time is slow, lossy and unrepeatable, and
`pdfimages` alone does not help — most rulebook diagrams are vector art drawn
in InDesign, so there is no embedded bitmap to extract, and the ones that are
bitmaps often arrive as a dozen separate pieces of one picture.

So this works the way a person does: it looks at each page, finds the regions
that are artwork rather than body text, and renders those regions at print
resolution. Vector or raster makes no difference, because it is rendering the
page rather than digging for files.

What comes out:

    images/            the crops, one PNG per figure, trimmed
    figures.json       page, position, caption guess, and the text above and
                       below each one — which is what lets a later pass put
                       them back into the markdown
    review.html        a contact sheet: every figure with its name, its page
                       and the sentence it sat next to

The contact sheet is the point. Detection will never be perfect on a rulebook
laid out by hand, so the job is not "extract perfectly", it is "extract, then
let a person fix the handful that are wrong in one pass instead of finding them
one at a time".

    pip install pymupdf pillow
    python3 scripts/extract-figures.py rules.pdf --slug indonesia

Requires PyMuPDF. It is not a build dependency: nothing in `npm run build`
touches this, it is an authoring tool run once per rulebook.
"""

import argparse
import html
import json
import re
import unicodedata
from pathlib import Path

import pymupdf

# --- what counts as a figure -------------------------------------------------

# Anything smaller than this, in points, is a bullet, a rule, an icon in a
# sentence — not a figure. A 72pt square is one inch.
MIN_SIDE = 54
MIN_AREA = 9000

# Two pieces of artwork closer than this belong to the same picture. Rulebook
# diagrams are routinely drawn as dozens of separate vector paths.
GAP = 14

# A caption is short, sits near the art, and is not a paragraph.
CAPTION_MAX_CHARS = 120
CAPTION_MAX_GAP = 26


def slugify(value, fallback="figure"):
    value = unicodedata.normalize("NFKD", value or "")
    value = value.encode("ascii", "ignore").decode("ascii").lower()
    value = re.sub(r"[^a-z0-9]+", "-", value).strip("-")
    return value[:48] or fallback


def merge(boxes, gap=GAP):
    """Unions overlapping or near-touching rectangles until nothing changes."""
    boxes = [pymupdf.Rect(b) for b in boxes]
    changed = True
    while changed:
        changed = False
        out = []
        while boxes:
            box = boxes.pop()
            grown = pymupdf.Rect(box) + (-gap, -gap, gap, gap)
            keep = []
            for other in boxes:
                if grown.intersects(other):
                    box |= other
                    changed = True
                else:
                    keep.append(other)
            boxes = keep
            out.append(box)
        boxes = out
    return boxes


def art_boxes(page):
    """Every rectangle on the page that holds a drawing or a raster image."""
    boxes = []
    for drawing in page.get_drawings():
        rect = pymupdf.Rect(drawing["rect"])
        if rect.is_empty or rect.is_infinite:
            continue
        boxes.append(rect)
    for info in page.get_image_info():
        boxes.append(pymupdf.Rect(info["bbox"]))
    return boxes


def text_blocks(page):
    out = []
    for block in page.get_text("blocks"):
        x0, y0, x1, y1, text, *_ = block
        text = " ".join(text.split())
        if text:
            out.append((pymupdf.Rect(x0, y0, x1, y1), text))
    return out


def is_page_furniture(rect, page_rect):
    """A full-bleed background or a header rule is not a figure."""
    covers_width = rect.width > page_rect.width * 0.92
    covers_height = rect.height > page_rect.height * 0.92
    if covers_width and covers_height:
        return True
    # A band the full width of the page but barely any height is a rule.
    return covers_width and rect.height < MIN_SIDE


def caption_for(rect, blocks):
    """The short line directly under the art, or directly over it."""
    best = None
    for block, text in blocks:
        if len(text) > CAPTION_MAX_CHARS:
            continue
        horizontally_near = block.x0 < rect.x1 and block.x1 > rect.x0
        if not horizontally_near:
            continue
        below = block.y0 - rect.y1
        above = rect.y0 - block.y1
        gap = below if 0 <= below <= CAPTION_MAX_GAP else (
            above if 0 <= above <= CAPTION_MAX_GAP else None
        )
        if gap is None:
            continue
        if best is None or gap < best[0]:
            best = (gap, text)
    return best[1] if best else ""


def neighbours(rect, blocks):
    """The last paragraph before the figure and the first one after it.

    This is what a later pass matches against the markdown to decide where the
    figure goes: the text either side of a picture is the same text either side
    of the place it belongs in the converted file.
    """
    before, after = "", ""
    for block, text in sorted(blocks, key=lambda b: (b[0].y0, b[0].x0)):
        if block.y1 <= rect.y0:
            before = text
        elif block.y0 >= rect.y1 and not after:
            after = text
    return before[-300:], after[:300]


def trim(pixmap, tolerance=6):
    """Crops uniform margin off a rendered region."""
    from PIL import Image, ImageChops

    image = Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)
    background = Image.new("RGB", image.size, image.getpixel((0, 0)))
    diff = ImageChops.difference(image, background).convert("L")
    box = diff.point(lambda value: 255 if value > tolerance else 0).getbbox()
    return image.crop(box) if box else image


def extract(pdf_path, out_dir, slug, dpi, first_page, last_page):
    document = pymupdf.open(pdf_path)
    images_dir = out_dir / "images"
    images_dir.mkdir(parents=True, exist_ok=True)

    figures = []
    for number in range(len(document)):
        page_number = number + 1
        if page_number < first_page or (last_page and page_number > last_page):
            continue

        page = document[number]
        page_rect = page.rect
        blocks = text_blocks(page)

        regions = []
        for rect in merge(art_boxes(page)):
            rect = rect & page_rect
            if rect.is_empty:
                continue
            if rect.width < MIN_SIDE or rect.height < MIN_SIDE:
                continue
            if rect.get_area() < MIN_AREA:
                continue
            if is_page_furniture(rect, page_rect):
                continue
            regions.append(rect)

        regions.sort(key=lambda r: (round(r.y0), r.x0))

        for index, rect in enumerate(regions, start=1):
            caption = caption_for(rect, blocks)
            before, after = neighbours(rect, blocks)
            name = f"p{page_number:03d}-{index}-{slugify(caption, 'figure')}.png"

            padded = pymupdf.Rect(rect) + (-6, -6, 6, 6)
            pixmap = page.get_pixmap(clip=padded & page_rect, dpi=dpi)
            trim(pixmap).save(images_dir / name)

            figures.append({
                "file": f"images/{name}",
                "path": f"/games/{slug}/images/{name}",
                "page": page_number,
                "caption": caption,
                "bbox": [round(v, 1) for v in rect],
                "textBefore": before,
                "textAfter": after,
            })

    (out_dir / "figures.json").write_text(json.dumps(figures, indent=2))
    write_review(out_dir, figures, pdf_path)
    return figures


def write_review(out_dir, figures, pdf_path):
    rows = []
    for index, figure in enumerate(figures):
        rows.append(f"""
<figure class="row" id="f{index}">
  <img src="{html.escape(figure['file'])}" alt="">
  <div class="meta">
    <p class="page">page {figure['page']}</p>
    <p class="name"><code>{html.escape(figure['file'])}</code></p>
    <p class="caption">{html.escape(figure['caption']) or '<em>no caption found</em>'}</p>
    <p class="context">…{html.escape(figure['textBefore'][-160:])}<b> ▮ </b>{html.escape(figure['textAfter'][:160])}…</p>
    <p class="use"><code>{{% figure "{html.escape(figure['path'])}", "", "{html.escape(figure['caption'])}" %}}</code></p>
  </div>
</figure>""")

    (out_dir / "review.html").write_text(f"""<!doctype html><meta charset="utf-8">
<title>Figures — {html.escape(Path(pdf_path).name)}</title>
<style>
  body {{ margin: 0; padding: 24px; background: #e8e4da; font: 14px/1.5 system-ui, sans-serif; color: #1c1b18; }}
  h1 {{ font-size: 18px; }}
  .row {{ display: grid; grid-template-columns: minmax(0, 320px) 1fr; gap: 20px; align-items: start;
          margin: 0 0 18px; padding: 16px; background: #fcfaf6; border: 1px solid #d5cdb9; border-radius: 10px; }}
  .row img {{ display: block; width: 100%; height: auto; background: #fff; border: 1px solid #eee; }}
  .meta p {{ margin: 0 0 8px; }}
  .page {{ font-size: 11px; letter-spacing: .06em; text-transform: uppercase; color: #6b675d; }}
  .caption {{ font-size: 15px; }}
  .context {{ color: #6b675d; font-size: 12px; }}
  code {{ font-size: 12px; background: #f2ede1; padding: 1px 4px; border-radius: 3px; word-break: break-all; }}
</style>
<h1>{len(figures)} figures from {html.escape(Path(pdf_path).name)}</h1>
<p>Check each one. Rename the file, fix the caption, delete what is not a figure — then run the placement pass.</p>
{''.join(rows)}
""")


def main():
    parser = argparse.ArgumentParser(description="Extract figures from a rulebook PDF.")
    parser.add_argument("pdf")
    parser.add_argument("--slug", required=True, help="game slug, for the image paths")
    parser.add_argument("--out", default=None, help="output directory (default: ./figures-<slug>)")
    parser.add_argument("--dpi", type=int, default=220)
    parser.add_argument("--first-page", type=int, default=1)
    parser.add_argument("--last-page", type=int, default=0)
    args = parser.parse_args()

    out_dir = Path(args.out) if args.out else Path(f"figures-{args.slug}")
    figures = extract(Path(args.pdf), out_dir, args.slug, args.dpi, args.first_page, args.last_page)

    print(f"{len(figures)} figures → {out_dir}/images")
    print(f"review: {out_dir}/review.html")


if __name__ == "__main__":
    main()
