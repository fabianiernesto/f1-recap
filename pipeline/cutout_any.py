"""
Generic cut-out: removes a flat (or checkerboard) background from any image
by flood-filling from the borders, keeps the largest piece, feathers the edge.

Usage:  python cutout_any.py <src> <dst.png> [thresh]
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

from cutout_landmark import keep_largest_piece


def main(src: str, dst: str, thresh: int = 62) -> None:
    im = Image.open(src).convert("RGBA")
    w, h = im.size

    seeds = []
    for x in range(0, w, max(1, w // 40)):
        seeds += [(x, 0), (x, h - 1)]
    for y in range(0, h, max(1, h // 40)):
        seeds += [(0, y), (w - 1, y)]

    for s in seeds:
        if im.getpixel(s)[3] == 0:
            continue
        ImageDraw.floodfill(im, s, (0, 0, 0, 0), thresh=thresh)

    im = keep_largest_piece(im)

    r, g, b, a = im.split()
    a = a.filter(ImageFilter.GaussianBlur(1.1))
    im = Image.merge("RGBA", (r, g, b, a))

    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)

    im.save(dst)
    print(f"[OK] {Path(dst).name} · {im.size[0]}x{im.size[1]}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 62)
