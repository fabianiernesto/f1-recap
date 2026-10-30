"""Data for the activity mockups (22/10/2026): Silverstone 2026 race, real.

Writes mock_data.js with the track, the field (code, team colour, photo) and
every car's crossing time of the line at the end of every lap, so the mockups
place the cars by their real gaps rather than by hand.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "pipeline"))
sys.argv = [sys.argv[0], "silverstone-2026"]
import build_weekend as bw  # noqa: E402
from photos import photo  # noqa: E402

spec = next(x for x in bw.SESSIONS if x[2] == "race")
s = bw.Session(*spec)
track = json.loads((ROOT / "data" / "silverstone-2026" / "track.json").read_text(encoding="utf-8"))

cross = {}
for l in s.laps:
    ts, d, ln = bw.parse_ts(l.get("date_start")), l.get("lap_duration"), l.get("lap_number")
    if ts and d and ln:
        cross.setdefault(l["driver_number"], {})[ln] = round(ts.timestamp() + d, 3)

field = []
for num, d in s.drivers.items():
    if num not in cross:
        continue
    field.append({"num": num, "code": d.get("name_acronym"), "name": s.name(num), "team": s.team(num),
                  "colour": "#" + (d.get("team_colour") or "888888").lstrip("#"),
                  "photo": (photo(d) or "").replace("w_1000", "w_420"),
                  "cross": cross[num], "stops": s.pit_laps(num)})

out = {"track": {"view": track["view"], "points": track["points"], "corners": track["corners"]},
       "laps": s.total_laps, "field": field}
(Path(__file__).parent / "mock_data.js").write_text("window.MOCK = " + json.dumps(out) + ";", encoding="utf-8")
print("ok", len(field), "cars")
