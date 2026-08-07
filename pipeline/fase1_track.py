"""
Fase 1 -- Real Silverstone track layout from FastF1 telemetry.
Takes the fastest race lap's X/Y position data, normalises it into a
1000x1000 viewBox, attaches real corner names, and exports:
  data/silverstone-2026/track.json  +  web_preview/track_data.js

Usage:  python fase1_track.py
"""
import json
from pathlib import Path

import fastf1

ROOT = Path(__file__).parent
CACHE = ROOT / "fastf1_cache"
OUT = ROOT.parent / "data" / "silverstone-2026"
PREVIEW = ROOT.parent / "web_preview"

# Silverstone GP layout, current corner numbering
CORNER_NAMES = {
    1: "ABBEY", 3: "VILLAGE", 6: "BROOKLANDS", 7: "LUFFIELD",
    9: "COPSE", 11: "MAGGOTTS", 13: "BECKETTS", 15: "STOWE", 18: "CLUB",
}
# straights labelled at the midpoint between two corners
STRAIGHTS = {(14, 15): "HANGAR STRAIGHT", (5, 6): "WELLINGTON STRAIGHT"}

VIEW = 1000.0
PAD = 70.0
MAX_POINTS = 450


def main() -> None:
    CACHE.mkdir(exist_ok=True)
    fastf1.Cache.enable_cache(str(CACHE))

    session = fastf1.get_session(2026, "Silverstone", "R")
    session.load(laps=True, telemetry=True, weather=False, messages=False)

    lap = session.laps.pick_fastest()
    pos = lap.get_pos_data()
    xs, ys = pos["X"].to_numpy(), pos["Y"].to_numpy()
    print(f"[OK] fastest lap pos data: {len(xs)} points "
          f"({lap['Driver']}, lap {int(lap['LapNumber'])})")

    # downsample, close the loop
    step = max(1, len(xs) // MAX_POINTS)
    xs, ys = xs[::step], ys[::step]

    # normalise into viewBox; screen Y grows downwards -> flip Y
    minx, maxx, miny, maxy = xs.min(), xs.max(), ys.min(), ys.max()
    span = max(maxx - minx, maxy - miny)
    scale = (VIEW - 2 * PAD) / span
    offx = (VIEW - (maxx - minx) * scale) / 2
    offy = (VIEW - (maxy - miny) * scale) / 2

    def tx(x: float) -> float:
        return round(offx + (x - minx) * scale, 1)

    def ty(y: float) -> float:
        return round(VIEW - (offy + (y - miny) * scale), 1)

    points = [[tx(x), ty(y)] for x, y in zip(xs, ys)]
    points.append(points[0])

    # corners with real names
    info = session.get_circuit_info()
    corners = []
    cmap = {}
    for _, c in info.corners.iterrows():
        n = int(c["Number"])
        cmap[n] = (tx(c["X"]), ty(c["Y"]))
        if n in CORNER_NAMES:
            corners.append({"x": tx(c["X"]), "y": ty(c["Y"]),
                            "label": CORNER_NAMES[n]})
    for (a, b), label in STRAIGHTS.items():
        if a in cmap and b in cmap:
            corners.append({"x": round((cmap[a][0] + cmap[b][0]) / 2, 1),
                            "y": round((cmap[a][1] + cmap[b][1]) / 2, 1),
                            "label": label})

    track = {"circuit": "Silverstone", "view": VIEW,
             "start": points[0], "points": points, "corners": corners}

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "track.json").write_text(json.dumps(track), encoding="utf-8")
    PREVIEW.mkdir(exist_ok=True)
    (PREVIEW / "track_data.js").write_text(
        "window.TRACK = " + json.dumps(track) + ";", encoding="utf-8")
    print(f"[OK] {len(points)} track points, {len(corners)} labels -> track_data.js")


if __name__ == "__main__":
    main()
