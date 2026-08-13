"""
Post-processes a cut-out so it sits INTO a black page instead of floating on it:

  1. erodes the alpha edge, which removes the pale rim a flood-fill leaves behind
  2. pulls the whole subject darker and flattens the blown highlights

Darker artwork also hides resolution limits: the softer the detail, the less a
low-res source shows.

Usage:  python darken_cutout.py <src.png> <dst.png> [erode_px] [brightness]
"""
import sys

from PIL import Image, ImageFilter


def main(src: str, dst: str, erode: int = 2, brightness: float = 0.58) -> None:
    im = Image.open(src).convert("RGBA")
    r, g, b, a = im.split()

    # erode: MinFilter shrinks the opaque area, cutting the light fringe off
    if erode > 0:
        size = erode * 2 + 1
        a = a.filter(ImageFilter.MinFilter(size))
        a = a.filter(ImageFilter.GaussianBlur(0.6))

    # darken, and compress the top end so specular highlights stop glaring
    def curve(v: int) -> int:
        v = v / 255
        v = v ** 1.35                      # deepen the midtones
        v = min(v, 0.82) * brightness      # clip highlights, then scale
        return int(v * 255)

    lut = [curve(i) for i in range(256)]
    r, g, b = r.point(lut), g.point(lut), b.point(lut)

    out = Image.merge("RGBA", (r, g, b, a))
    bbox = out.getbbox()
    if bbox:
        out = out.crop(bbox)
    out.save(dst)
    print(f"[OK] {dst} · {out.size[0]}x{out.size[1]} · erode {erode}px · "
          f"brightness {brightness}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2],
         int(sys.argv[3]) if len(sys.argv) > 3 else 2,
         float(sys.argv[4]) if len(sys.argv) > 4 else 0.58)
