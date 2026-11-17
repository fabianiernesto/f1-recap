"""Data for the launch teaser (src/Teaser.tsx): the 20 circuits in race order,
their real outlines and the moments the site explains for each one.

    python video/scripts/teaser_data.py      (from the project root)
"""
import json
import os
from datetime import datetime

ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
DATA = os.path.join(ROOT, "data")
OUT = os.path.join(ROOT, "video", "src", "teaser.json")

gps = []
for slug in os.listdir(DATA):
    wk = os.path.join(DATA, slug, "weekend.json")
    tr = os.path.join(DATA, slug, "track.json")
    if not (os.path.exists(wk) and os.path.exists(tr)):
        continue
    w = json.load(open(wk, encoding="utf-8"))
    t = json.load(open(tr, encoding="utf-8"))
    pts = t["points"]
    step = max(1, len(pts) // 160)
    gps.append({
        "circuit": w["circuit"],
        "date": w["date"],
        "moments": sum(s["moments"] for s in w["sessions"]),
        "pts": [[round(x), round(y)] for x, y in pts[::step]],
    })
gps.sort(key=lambda g: datetime.strptime(g["date"], "%d %b %Y"))
json.dump({"gps": gps, "moments": sum(g["moments"] for g in gps)}, open(OUT, "w", encoding="utf-8"))
print(len(gps), "GPs,", sum(g["moments"] for g in gps), "moments ->", OUT)
