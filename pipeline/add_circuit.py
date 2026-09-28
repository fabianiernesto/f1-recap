"""
Adds a circuit to the site: track shape, circuit vitals and the weekend stub
the hero needs. Everything comes from FastF1, so a new Grand Prix is one
command away.

  python add_circuit.py 2026 "Barcelona" barcelona-2026 "Spanish Grand Prix" Spain

Writes data/<slug>/track.json and data/<slug>/weekend.json.
"""
import json
import sys
from pathlib import Path

import fastf1
import numpy as np

ROOT = Path(__file__).parent
CACHE = ROOT / "fastf1_cache"
DATA = ROOT.parent / "data"

VIEW = 1000.0
PAD = 70.0
MAX_POINTS = 450
MIN_BRAKING_METRES = 30

# published lap distances: telemetry follows the racing line and reads short
OFFICIAL_LENGTH_KM = {
    "Silverstone": 5.891, "Barcelona": 4.657, "Monza": 5.793,
    "Spa": 7.004, "Zandvoort": 4.259, "Suzuka": 5.807, "Hungary": 4.381,
    "Madrid": 5.414, "Azerbaijan": 6.003,
    "Australia": 5.278, "China": 5.451, "Japan": 5.807, "Miami": 5.412,
    "Canada": 4.361, "Monaco": 3.337, "Austria": 4.326, "Belgium": 7.004,
    "Netherlands": 4.259,
}

# corner counts for circuits FastF1 has no circuit info for yet. Madring: 22,
# per Wikipedia and RacingCircuits.info, checked 28-sep-2026
OFFICIAL_CORNERS = {"Madrid": 22}

# FastF1 finds an event by the name of the Grand Prix; the circuit the site
# shows is a different word for most of them
CIRCUIT_NAME = {"Hungary": "Hungaroring", "Spa": "Spa-Francorchamps",
                "Madrid": "Madring", "Azerbaijan": "Baku",
                "Australia": "Albert Park", "China": "Shanghai", "Japan": "Suzuka",
                "Canada": "Montreal", "Austria": "Spielberg", "Belgium": "Spa-Francorchamps",
                "Netherlands": "Zandvoort"}

# the corners worth naming, per circuit
CORNER_NAMES = {
    "Silverstone": {1: "ABBEY", 3: "VILLAGE", 6: "BROOKLANDS", 7: "LUFFIELD",
                    9: "COPSE", 11: "MAGGOTTS", 13: "BECKETTS", 15: "STOWE",
                    18: "CLUB"},
    "Barcelona": {1: "ELF", 3: "RENAULT", 4: "REPSOL", 5: "SEAT",
                  7: "WÜRTH", 9: "CAMPSA", 10: "LA CAIXA", 12: "BANC SABADELL",
                  14: "EUROPCAR"},
}


def main(year: int, gp: str, slug: str, name: str, country: str) -> None:
    CACHE.mkdir(exist_ok=True)
    fastf1.Cache.enable_cache(str(CACHE))

    session = fastf1.get_session(year, gp, "R")
    session.load(laps=True, telemetry=True, weather=False, messages=False)

    # the fastest lap first, then the next quickest, until one has position
    # data (Monaco 2026: the fastest lap came back without X and Y)
    lap, pos = None, None
    for _, cand in session.laps.pick_quicklaps().sort_values("LapTime").iterlaps():
        try:
            p = cand.get_pos_data()
        except Exception:
            continue
        if "X" in p.columns and len(p) > 100 and cand.get_car_data() is not None:
            lap, pos = cand, p
            break
    if lap is None:
        raise SystemExit("no lap in this race carries position data")
    xs, ys = pos["X"].to_numpy(), pos["Y"].to_numpy()

    step = max(1, len(xs) // MAX_POINTS)
    xs, ys = xs[::step], ys[::step]
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

    # a circuit new to the calendar can come without FastF1's circuit info
    # (Madring 2026 did): then no corner positions, and the corner count
    # comes from the published figure or is left blank
    try:
        info = session.get_circuit_info()
    except Exception:
        info = None
    names = CORNER_NAMES.get(gp, {})
    corners = ([{"x": tx(c["X"]), "y": ty(c["Y"]), "label": names[int(c["Number"])]}
                for _, c in info.corners.iterrows() if int(c["Number"]) in names]
               if info is not None else [])
    corner_count = len(info.corners) if info is not None else OFFICIAL_CORNERS.get(gp)

    # ---- circuit vitals, the same five everywhere ----
    tel = lap.get_car_data().add_distance()
    dist = tel["Distance"].to_numpy()
    seg = np.diff(dist, prepend=dist[0])
    thr = tel["Throttle"].to_numpy()
    flat_out = float(seg[thr >= 98].sum() / seg.sum() * 100)

    length_km = OFFICIAL_LENGTH_KM.get(gp, float(dist.max()) / 1000)
    slowest = int(tel["Speed"].min())

    top_speed = 0
    for _, l in session.laps.pick_quicklaps().iterlaps():
        try:
            top_speed = max(top_speed, int(l.get_car_data()["Speed"].max()))
        except (ValueError, KeyError):
            continue

    brake = tel["Brake"].to_numpy().astype(bool)
    braking, start = 0, None
    for i, on in enumerate(brake):
        if on and start is None:
            start = i
        elif not on and start is not None:
            if dist[i] - dist[start] >= MIN_BRAKING_METRES:
                braking += 1
            start = None

    total_laps = int(session.laps["LapNumber"].max())
    stats = [
        {"label": "Lap length", "value": f"{length_km:.3f} km",
         "short": f"Start line to start line, {total_laps} times over on Sunday"},
        {"label": "Corners", "value": str(corner_count) if corner_count else "-",
         "short": "Each one a chance to gain time, and a chance to throw the lap away"},
        {"label": "Full throttle", "value": f"{flat_out:.0f}%",
         "short": "How much of the lap is spent flat out, and how much the engine gets to decide"},
        {"label": "Top speed", "value": f"{top_speed} km/h",
         "short": f"Fastest anybody went all race. It drops to {slowest} km/h at the tightest corner"},
        {"label": "Braking zones", "value": str(braking),
         "short": "Proper stops, not brushes of the pedal. This is where the overtakes happen"},
    ]

    out = DATA / slug
    out.mkdir(parents=True, exist_ok=True)
    (out / "track.json").write_text(json.dumps({
        "circuit": CIRCUIT_NAME.get(gp, gp), "view": VIEW, "start": points[0],
        "points": points, "corners": corners, "stats": stats,
    }), encoding="utf-8")

    date = session.date.strftime("%d %b %Y").upper()
    (out / "weekend.json").write_text(json.dumps({
        "slug": slug, "gp": f"{name} {year}", "short": name, "circuit": CIRCUIT_NAME.get(gp, gp),
        "country": country, "date": date, "laps": total_laps,
        "sessions": [], "rating": None, "heat": [],
    }, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"[OK] {slug}: {len(points)} track points, {len(corners)} named corners")
    for s in stats:
        print(f"  {s['label']:<14} {s['value']}")


if __name__ == "__main__":
    main(int(sys.argv[1]), sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5])
