"""
Circuit vitals for the hero panel, measured from the fastest lap's telemetry.

Five numbers, the same five at every Grand Prix, so the panel says something
instead of decorating: how long the lap is, how many corners, how much of it
is spent flat out, how fast it gets and how many DRS zones it has.

None of them reveal what happened in the race, so the spoiler-free promise
of the front door holds.

Usage:  python fase1_circuit_stats.py
"""
import json
from pathlib import Path

import fastf1
import numpy as np

ROOT = Path(__file__).parent
CACHE = ROOT / "fastf1_cache"
OUT = ROOT.parent / "data" / "silverstone-2026"

YEAR, GP, SESSION = 2026, "Silverstone", "R"


def main() -> None:
    CACHE.mkdir(exist_ok=True)
    fastf1.Cache.enable_cache(str(CACHE))

    session = fastf1.get_session(YEAR, GP, SESSION)
    session.load(laps=True, telemetry=True, weather=False, messages=False)

    lap = session.laps.pick_fastest()
    tel = lap.get_car_data().add_distance()

    length_km = float(tel["Distance"].max()) / 1000
    top_speed = int(tel["Speed"].max())

    # share of the lap at full throttle, weighted by distance rather than by
    # samples, so slow corners do not count the same as a straight
    dist = tel["Distance"].to_numpy()
    thr = tel["Throttle"].to_numpy()
    seg = np.diff(dist, prepend=dist[0])
    flat_out = float(seg[thr >= 98].sum() / seg.sum() * 100)

    # braking zones: count where the brake goes from off to on. (DRS was the
    # obvious fifth number, but this feed reports the DRS channel as all
    # zeros, and a made-up figure is worse than a different real one.)
    brake = tel["Brake"].to_numpy().astype(bool)
    braking_zones = int(np.sum(brake[1:] & ~brake[:-1]))

    corners = len(session.get_circuit_info().corners)

    stats = [
        {"label": "Lap length",
         "value": f"{length_km:.3f} km",
         "note": "Distance covered on the fastest lap of the weekend."},
        {"label": "Corners",
         "value": str(corners),
         "note": "Every one of them a chance to gain or lose the lap."},
        {"label": "Full throttle",
         "value": f"{flat_out:.0f}%",
         "note": "How much of the lap is spent flat out. The higher it is, "
                 "the more the engine decides."},
        {"label": "Top speed",
         "value": f"{top_speed} km/h",
         "note": "Fastest the cars go here, on the longest straight."},
        {"label": "Braking zones",
         "value": str(braking_zones),
         "note": "Times the driver hits the brakes in a single lap. "
                 "Every one of them is a chance to out-brake somebody."},
    ]

    track_file = OUT / "track.json"
    track = json.loads(track_file.read_text(encoding="utf-8"))
    track["stats"] = stats
    track_file.write_text(json.dumps(track), encoding="utf-8")

    for s in stats:
        print(f"  {s['label']:<14} {s['value']}")
    print(f"[OK] stats written into {track_file.name}")


if __name__ == "__main__":
    main()
