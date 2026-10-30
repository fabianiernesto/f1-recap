"""
Data for the Paddock Exchange mockup (26/10/2026): the real race from
data/<slug>/replay_race.json and the circuit from track.json, written as a
script the mockup page can load from disk.

    python web_preview/bolsa/export.py baku-2026
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
slug = sys.argv[1] if len(sys.argv) > 1 else "baku-2026"
replay = json.loads((ROOT / "data" / slug / "replay_race.json").read_text(encoding="utf-8"))
track = json.loads((ROOT / "data" / slug / "track.json").read_text(encoding="utf-8"))
weekend = json.loads((ROOT / "data" / slug / "weekend.json").read_text(encoding="utf-8"))

out = {
    "slug": slug,
    "gp": weekend.get("name") or track.get("circuit"),
    "circuit": track.get("circuit"),
    "points": track["points"],
    "laps": replay["laps"],
    "neutral": replay["neutral"],
    "red": replay["red"],
    "pits": replay["pits"],
    "field": [{k: c[k] for k in ("num", "code", "name", "team", "colour", "photo", "grid", "finish", "out", "cross")}
              for c in replay["field"]],
}
dest = Path(__file__).with_name("data.js")
dest.write_text("window.RACE = " + json.dumps(out, ensure_ascii=False) + ";\n", encoding="utf-8")
print(dest, len(out["field"]), "cars,", out["laps"], "laps")
