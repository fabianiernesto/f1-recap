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

# Published circuit length. Telemetry measures the racing line, which cuts the
# corners and comes out ~85 m short, so the number a fan recognises has to be
# stated rather than derived.
OFFICIAL_LENGTH_KM = {"Silverstone": 5.891, "Monza": 5.793, "Spa": 7.004}

# a brush of the brake pedal is not a braking zone
MIN_BRAKING_METRES = 30


def main() -> None:
    CACHE.mkdir(exist_ok=True)
    fastf1.Cache.enable_cache(str(CACHE))

    session = fastf1.get_session(YEAR, GP, SESSION)
    session.load(laps=True, telemetry=True, weather=False, messages=False)

    lap = session.laps.pick_fastest()
    tel = lap.get_car_data().add_distance()

    length_km = OFFICIAL_LENGTH_KM.get(GP, float(tel["Distance"].max()) / 1000)

    # the fastest lap runs in clean air, so its peak is NOT how fast the cars
    # go here: take the highest speed anybody reached all race
    top_speed = 0
    for _, l in session.laps.pick_quicklaps().iterlaps():
        try:
            t = l.get_car_data()
        except (ValueError, KeyError):
            continue
        top_speed = max(top_speed, int(t["Speed"].max()))

    # share of the lap at full throttle, weighted by distance rather than by
    # samples, so slow corners do not count the same as a straight
    dist = tel["Distance"].to_numpy()
    thr = tel["Throttle"].to_numpy()
    seg = np.diff(dist, prepend=dist[0])
    flat_out = float(seg[thr >= 98].sum() / seg.sum() * 100)

    # braking zones: proper stops, measured by how far the brake stays on.
    # (DRS was the obvious fifth number, but this feed reports that channel as
    # all zeros, and a made-up figure is worse than a different real one.)
    brake = tel["Brake"].to_numpy().astype(bool)
    braking_zones, start = 0, None
    for i, on in enumerate(brake):
        if on and start is None:
            start = i
        elif not on and start is not None:
            if dist[i] - dist[start] >= MIN_BRAKING_METRES:
                braking_zones += 1
            start = None

    corners = len(session.get_circuit_info().corners)

    stats = [
        {"label": "Lap length",
         "value": f"{length_km:.3f} km",
         "note": "Official distance of one lap."},
        {"label": "Corners",
         "value": str(corners),
         "note": "Every one of them a chance to gain or lose the lap."},
        {"label": "Full throttle",
         "value": f"{flat_out:.0f}%",
         "note": "How much of the lap is spent flat out. The higher it is, "
                 "the more the engine decides."},
        {"label": "Top speed",
         "value": f"{top_speed} km/h",
         "note": "Fastest anybody went here all race."},
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
