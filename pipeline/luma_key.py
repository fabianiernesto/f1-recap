"""
Luminance key for dark subjects on light backgrounds, destined for BLACK pages:
dark pixels stay, light pixels go, midtones fade. Ideal for the glossy black
car on a baked-in checkerboard, where flood fill bleeds through soft edges.

Usage:  python luma_key.py <src> <dst.png> [keep_below] [drop_above]
"""
import sys

from PIL import Image, ImageFilter

from cutout_landmark import keep_largest_piece


def main(src: str, dst: str, keep: int = 110, drop: int = 185) -> None:
    im = Image.open(src).convert("RGB")
    lum = im.convert("L")

    # alpha ramp: opaque below `keep`, transparent above `drop`
    span = max(1, drop - keep)
    a = lum.point(lambda v: 255 if v <= keep
                  else 0 if v >= drop
                  else int(255 * (drop - v) / span))

    out = im.convert("RGBA")
    out.putalpha(a)
    out = keep_largest_piece(out)

    r, g, b, alpha = out.split()
    alpha = alpha.filter(ImageFilter.GaussianBlur(0.8))
    out = Image.merge("RGBA", (r, g, b, alpha))

    bbox = out.getbbox()
    if bbox:
        out = out.crop(bbox)
    out.save(dst)
    print(f"[OK] {dst} · {out.size[0]}x{out.size[1]}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2],
         int(sys.argv[3]) if len(sys.argv) > 3 else 110,
         int(sys.argv[4]) if len(sys.argv) > 4 else 185)
