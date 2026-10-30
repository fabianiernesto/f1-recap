"""Data for the new ghost mockup (24/10/2026): every driver's real stints at
Silverstone, the race's measured tyre wear and stop cost, and the longest run
each compound did here (a plan cannot ask the model past what was run)."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "pipeline"))
sys.argv = [sys.argv[0], "silverstone-2026"]
import build_weekend as bw  # noqa: E402
from pitwall import race_economics, _longest_stints  # noqa: E402

spec = next(x for x in bw.SESSIONS if x[2] == "race")
s = bw.Session(*spec)
econ = race_economics(s)
out = {"laps": s.total_laps, "econ": econ, "longest": _longest_stints(s), "stints": {}}
for r in s.result:
    n = r["driver_number"]
    sts = sorted((st for st in s.stints if st.get("driver_number") == n and st.get("lap_start")), key=lambda x: x["lap_start"])
    out["stints"][s.name(n)] = [[st.get("compound"), st["lap_start"], st.get("lap_end")] for st in sts]
(Path(__file__).parent / "ghost_data.js").write_text("window.GHOST = " + json.dumps(out) + ";", encoding="utf-8")
print(json.dumps({k: v for k, v in out.items() if k != "stints"}), out["stints"]["Hadjar"], out["stints"]["Norris"])
