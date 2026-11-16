"""
Bakes the smeared copy that drags behind the moodboard photographs
(components/Mood.tsx, Blur) into an image, so the browser stops computing it
on every frame.

The live trail is `filter: blur(16px) saturate(1.35) brightness(1.1)` on a
moving layer. On a laptop GPU (Intel UHD) recomputing that blur sixty times a
second, while the layer drags, is what made the home stutter on scroll
(25/10/2026). Here the same three operations run once, in the same order and
the same colour maths as the CSS filter, with the blur measured in the
photograph's own pixels so it lands at 16 screen pixels where the photograph
is shown: one file for wide screens (measured at 1440px) and one for phones
(measured at 390px).

Only photographs whose box has their own proportions are baked. Where the
box crops the photo (the horse, the tyre), the crop changes with the screen
and the live blur fades at the crop's edge, which a fixed image cannot do, so
those keep the live filter.

    python web/scripts/bake_trails.py
"""
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter

PUBLIC = Path(__file__).resolve().parent.parent / "public"
OUT = PUBLIC / "home" / "mood" / "trails"

# source -> (scale on a 1440px screen, scale on a 390px phone): the width the
# photograph is drawn at over its natural width, measured on the built site
TRAILS = {
    # 1672px wide since 16/11/2026 (was 736: 1.29 / 0.69)
    "home/mood/helmet.jpg": (0.568, 0.304),
    # the car runs on the home (0.28 / 0.137) and on Sessions (0.346 / 0.18)
    "home/mood/car-top.jpg": (0.31, 0.16),
    "home/mood/nuevas/helmet-guantes-c.webp": (0.603, 0.303),
}
CSS_BLUR = 16.0


def css_filter(rgba: np.ndarray, sigma: float) -> np.ndarray:
    """blur(sigma) saturate(1.35) brightness(1.1), as Chrome runs them:
    the blur on premultiplied colour with transparency beyond the edges,
    then the two colour steps on straight colour, clamped after each."""
    a = rgba[..., 3:4] / 255.0
    rgb = rgba[..., :3] / 255.0
    pad = int(3 * sigma) + 2
    pm = np.concatenate([rgb * a, a], axis=-1)
    pm = np.pad(pm, ((pad, pad), (pad, pad), (0, 0)))
    pm = np.stack([gaussian_filter(pm[..., c], sigma, mode="constant") for c in range(4)], axis=-1)
    pm = pm[pad:-pad, pad:-pad]
    alpha = pm[..., 3:4]
    rgb = np.where(alpha > 1e-6, pm[..., :3] / np.maximum(alpha, 1e-6), 0)
    s = 1.35
    m = np.array([
        [0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s],
        [0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s],
        [0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s],
    ])
    rgb = np.clip(rgb @ m.T, 0, 1)
    rgb = np.clip(rgb * 1.1, 0, 1)
    return np.concatenate([rgb, alpha], axis=-1)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for src, scales in TRAILS.items():
        im = np.asarray(Image.open(PUBLIC / src).convert("RGBA")).astype(np.float64)
        stem = Path(src).stem
        for tag, scale in zip(("d", "m"), scales):
            out = css_filter(im, CSS_BLUR / scale)
            img = Image.fromarray((out * 255 + 0.5).astype(np.uint8), "RGBA")
            # a blur this wide carries no detail: twice the drawn size is
            # plenty for a sharp screen, and never more than the source
            k = min(1.0, scale * 2)
            if k < 1:
                img = img.resize((max(1, round(img.width * k)), max(1, round(img.height * k))), Image.LANCZOS)
            path = OUT / f"{stem}-{tag}.webp"
            img.save(path, "WEBP", quality=90, method=6)
            print(f"{path.relative_to(PUBLIC)}  {img.size}  {path.stat().st_size // 1024}KB  sigma {CSS_BLUR / scale:.1f}px")


if __name__ == "__main__":
    main()
