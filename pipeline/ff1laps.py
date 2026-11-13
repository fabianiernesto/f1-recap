"""
A second reading of the timing, for the laps the OpenF1 feed lost.

OpenF1 and FastF1 both read the same live timing stream, but FastF1 rebuilds
each car's laps from it and keeps rows OpenF1 drops: Albert Park 2026 has no
lap 2 row for anybody and no lap 3 for the three leaders in OpenF1, and FastF1
has them all, with the real lap times.

Loading a FastF1 session takes the best part of a minute and a heavy import, so
what the builder needs is written once next to the OpenF1 files, as
cache/<session_key>_<cache_name>_ff1laps.json, and read from there.

Usage: python pipeline/ff1laps.py <slug> [slug ...]
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CACHE = ROOT / "cache"
FF1_CACHE = ROOT / "fastf1_cache"

KIND = {"race": "R", "sprint": "S"}


def _secs(v):
    try:
        return round(v.total_seconds(), 3) if v == v else None
    except AttributeError:
        return None


def export(event, session_slug: str, target: Path) -> bool:
    """event: what fastf1.get_session takes for the Grand Prix (round number or
    name). False when FastF1 has nothing for it; the builder then does without."""
    import fastf1
    fastf1.set_log_level("ERROR")
    fastf1.Cache.enable_cache(str(FF1_CACHE))
    ses = fastf1.get_session(2026, event, KIND[session_slug])
    ses.load(laps=True, telemetry=False, weather=False, messages=False)
    rows = []
    for _, l in ses.laps.iterrows():
        date = l.get("LapStartDate")
        rows.append({
            "driver_number": int(l["DriverNumber"]),
            "lap_number": int(l["LapNumber"]),
            "lap_start_date": date.isoformat() if date == date else None,
            "lap_start": _secs(l.get("LapStartTime")),
            "end": _secs(l.get("Time")),
            "lap_time": _secs(l.get("LapTime")),
            "position": int(l["Position"]) if l.get("Position") == l.get("Position") else None,
            "generated": bool(l.get("FastF1Generated")),
            "pit_in": _secs(l.get("PitInTime")),
            "pit_out": _secs(l.get("PitOutTime")),
            "stint": int(l["Stint"]) if l.get("Stint") == l.get("Stint") else None,
            "compound": l.get("Compound") if isinstance(l.get("Compound"), str) else None,
            "tyre_life": int(l["TyreLife"]) if l.get("TyreLife") == l.get("TyreLife") else None,
        })
    if not rows:
        return False
    target.write_text(json.dumps(rows, separators=(",", ":")), encoding="utf-8")
    return True


def run(slug: str) -> None:
    sys.argv = [sys.argv[0], slug]
    sys.modules.pop("build_weekend", None)
    from gps import weekend_of
    gp, sessions = weekend_of(slug)
    date = gp.get("date")
    for skey, cache_name, sess_slug, _label, kind in sessions:
        if kind != "race":
            continue
        target = CACHE / f"{skey}_{cache_name}_ff1laps.json"
        if target.exists():
            print(f"{slug} {sess_slug}: already there")
            continue
        try:
            ok = export(_event_of(date), sess_slug, target)
            print(f"{slug} {sess_slug}: {'written' if ok else 'nothing from FastF1'}")
        except Exception as e:      # no cache and no network: the builder copes
            print(f"{slug} {sess_slug}: no FastF1 data ({type(e).__name__}: {e})")


def _event_of(date_text: str):
    """The FastF1 event held that weekend, matched on the race date."""
    import fastf1
    from datetime import datetime
    fastf1.set_log_level("ERROR")
    fastf1.Cache.enable_cache(str(FF1_CACHE))
    day = datetime.strptime(date_text.title(), "%d %b %Y").date()
    sch = fastf1.get_event_schedule(2026, include_testing=False)
    for _, ev in sch.iterrows():
        d = ev["EventDate"].date()
        if abs((d - day).days) <= 1:
            return int(ev["RoundNumber"])
    raise LookupError(f"no event near {date_text}")


if __name__ == "__main__":
    for s in sys.argv[1:]:
        run(s)
