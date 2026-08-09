"""
Cuts the flat sky out of a landmark photo so it can sit on the night poster.

Flood-fills from the image border, so light areas INSIDE the building (the
clock faces) survive. Feathers the resulting edge so it does not look cut with
scissors, then writes a transparent PNG next to the original.

Usage:  python cutout_landmark.py silverstone-2026
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

LANDMARKS = Path(__file__).parent.parent / "web" / "public" / "landmarks"
THRESH = 62        # how far from the seed colour still counts as sky
FEATHER = 1.1      # px of edge softening


def keep_largest_piece(im: Image.Image) -> Image.Image:
    """Drop leftover sky fragments: keep only the biggest opaque blob."""
    w, h = im.size
    alpha = im.getchannel("A").load()
    seen = bytearray(w * h)
    best: list[int] = []

    for sy in range(0, h, 2):
        for sx in range(0, w, 2):
            if seen[sy * w + sx] or alpha[sx, sy] < 8:
                continue
            stack, blob = [(sx, sy)], []
            seen[sy * w + sx] = 1
            while stack:
                x, y = stack.pop()
                blob.append(y * w + x)
                for nx2, ny2 in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx2 < w and 0 <= ny2 < h and not seen[ny2 * w + nx2] \
                            and alpha[nx2, ny2] >= 8:
                        seen[ny2 * w + nx2] = 1
                        stack.append((nx2, ny2))
            if len(blob) > len(best):
                best = blob

    keep = bytearray(w * h)
    for i in best:
        keep[i] = 1
    a = im.getchannel("A")
    px = a.load()
    for y in range(h):
        row = y * w
        for x in range(w):
            if not keep[row + x]:
                px[x, y] = 0
    im.putalpha(a)
    return im


def main(slug: str) -> None:
    src = next((p for p in LANDMARKS.glob(f"{slug}.*")
                if p.suffix.lower() in {".jpg", ".jpeg", ".webp", ".png"}), None)
    if src is None:
        sys.exit(f"no image found for {slug} in {LANDMARKS}")

    im = Image.open(src).convert("RGBA")
    w, h = im.size

    # seeds all around the border: the sky is whatever touches the edges
    seeds = []
    for x in range(0, w, max(1, w // 24)):
        seeds += [(x, 0), (x, h - 1)]
    for y in range(0, h, max(1, h // 24)):
        seeds += [(0, y), (w - 1, y)]

    for s in seeds:
        if im.getpixel(s)[3] == 0:      # already cleared
            continue
        ImageDraw.floodfill(im, s, (0, 0, 0, 0), thresh=THRESH)

    im = keep_largest_piece(im)

    # feather the alpha edge
    r, g, b, a = im.split()
    a = a.filter(ImageFilter.GaussianBlur(FEATHER))
    im = Image.merge("RGBA", (r, g, b, a))

    # trim fully transparent margins
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)

    out = LANDMARKS / f"{slug}.png"
    im.save(out)
    cleared = sum(1 for p in im.getdata() if p[3] == 0)
    print(f"[OK] {out.name} · {im.size[0]}x{im.size[1]} · "
          f"{cleared * 100 // (im.size[0] * im.size[1])}% transparent")

    if src.suffix.lower() != ".png":
        src.unlink()
        print(f"[OK] removed the opaque original ({src.name})")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "silverstone-2026")
