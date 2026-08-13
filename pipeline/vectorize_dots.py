"""
Rebuilds a dot-matrix logo as vector art.

Upscaling a screenshot only makes the dots blurrier. Instead this reads the
red dots out of the crop, snaps them onto the grid they were drawn on, and
emits an SVG of perfect circles: same design, same layout, infinite sharpness.

Usage:  python vectorize_dots.py <src.png> <dst.svg>
"""
import sys
from collections import Counter

from PIL import Image


def main(src: str, dst: str) -> None:
    im = Image.open(src).convert("RGB")
    w, h = im.size
    px = im.load()

    # 1. every red pixel
    red = [[False] * w for _ in range(h)]
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            red[y][x] = r > 110 and g < 90 and b < 90

    # 2. group them into dots (flood fill each blob once)
    seen = [[False] * w for _ in range(h)]
    dots = []
    for y in range(h):
        for x in range(w):
            if not red[y][x] or seen[y][x]:
                continue
            stack, blob = [(x, y)], []
            seen[y][x] = True
            while stack:
                cx, cy = stack.pop()
                blob.append((cx, cy))
                for nx, ny in ((cx+1, cy), (cx-1, cy), (cx, cy+1), (cx, cy-1)):
                    if 0 <= nx < w and 0 <= ny < h and red[ny][nx] and not seen[ny][nx]:
                        seen[ny][nx] = True
                        stack.append((nx, ny))
            if len(blob) >= 4:
                xs = [p[0] for p in blob]
                ys = [p[1] for p in blob]
                dots.append((sum(xs) / len(xs), sum(ys) / len(ys), len(blob)))

    if not dots:
        sys.exit("no dots found")

    # 3. work out the grid pitch from the gaps between neighbouring dots
    def pitch(values: list[float]) -> float:
        vals = sorted(values)
        gaps = [round(b - a) for a, b in zip(vals, vals[1:]) if 3 < b - a < 60]
        common = Counter(gaps).most_common(6)
        return min(g for g, _ in common) if common else 10.0

    px_pitch = pitch([d[0] for d in dots])
    py_pitch = pitch([d[1] for d in dots])
    step = (px_pitch + py_pitch) / 2

    # 4. snap each dot to that grid so the rows and columns line up exactly
    x0 = min(d[0] for d in dots)
    y0 = min(d[1] for d in dots)
    grid = sorted({(round((d[0] - x0) / step), round((d[1] - y0) / step))
                   for d in dots})

    cols = max(c for c, _ in grid) + 1
    rows = max(r for _, r in grid) + 1
    radius = (sum(d[2] for d in dots) / len(dots) / 3.14159) ** 0.5

    # 5. emit the SVG on a unit grid of 10 per cell
    cell = 10
    r_svg = round(radius / step * cell, 2)
    circles = "".join(
        f'<circle cx="{c * cell + cell / 2}" cy="{r * cell + cell / 2}" '
        f'r="{r_svg}"/>' for c, r in grid)
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" '
           f'viewBox="0 0 {cols * cell} {rows * cell}" fill="#ff1c12">'
           f'{circles}</svg>')

    with open(dst, "w", encoding="utf-8") as f:
        f.write(svg)
    print(f"[OK] {dst} · {len(grid)} dots · grid {cols}x{rows} · "
          f"pitch {step:.1f}px · radius {r_svg}/{cell}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
