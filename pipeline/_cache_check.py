"""Which cache files are missing or empty, for every registered session."""
import json, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from gps import GPS  # noqa: E402

C = pathlib.Path(__file__).parent / "cache"
NEED = ["drivers", "laps", "session_result", "race_control", "stints", "pit", "position", "weather"]
RACE = ["intervals", "overtakes"]
bad = []
for slug, g in GPS.items():
    for key, name, sslug, label, kind in g["sessions"]:
        for ep in NEED + (RACE if kind == "race" else []) + (["starting_grid"] if sslug == "quali" else []):
            f = C / f"{key}_{name}_{ep}.json"
            if not f.exists():
                bad.append(f"{slug} {label} {ep}: MISSING")
            else:
                try:
                    data = json.loads(f.read_text(encoding="utf-8"))
                    if not data and ep not in ("starting_grid", "weather"):
                        bad.append(f"{slug} {label} {ep}: empty")
                except Exception as e:
                    bad.append(f"{slug} {label} {ep}: unreadable {e}")
print("\n".join(bad) or "all present")
print(len(bad), "problems")
