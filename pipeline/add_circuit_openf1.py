"""
add_circuit.py for a race FastF1 can no longer load.

FastF1 reads livetiming.formula1.com, which has answered 401 since at least
02-nov-2026; every circuit before Sepang came from FastF1's local cache. This
writes the same track.json and weekend stub with the same arithmetic, from
OpenF1's location and car_data (the raw feeds FastF1 was reading anyway) and
the corner list FastF1 took from MultiViewer, whose URL OpenF1 publishes per
meeting.

  python add_circuit_openf1.py <slug> <key in add_circuit's tables> [--out DIR]

The session comes from gps.py, so run fase0_explora.py first: the laps are read
from the cache. --out writes somewhere else, to compare against a circuit that
FastF1 built.
"""
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np

from add_circuit import (CIRCUIT_NAME, CORNER_NAMES, DATA, MAX_POINTS, MIN_BRAKING_METRES,
                         OFFICIAL_CORNERS, OFFICIAL_LENGTH_KM, PAD, VIEW)
from gps import GPS

BASE = "https://api.openf1.org/v1"
CACHE = Path(__file__).parent / "cache"
ISO = "%Y-%m-%dT%H:%M:%S"


def get(url: str):
    time.sleep(0.4)  # OpenF1 allows 3 requests a second
    req = urllib.request.Request(url, headers={"User-Agent": "racing-simplified"})
    for attempt in range(6):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(4 * (attempt + 1))
                continue
            raise
    raise SystemExit(f"rate limited: {url}")


def feed(endpoint: str, skey: int, driver: int | None = None, since=None, until=None, extra: str = "") -> list:
    q = f"{BASE}/{endpoint}?session_key={skey}"
    if driver:
        q += f"&driver_number={driver}"
    # + is not a date offset here: the filter goes in without a zone, as UTC
    if since:
        q += "&date>=" + since.strftime(ISO + ".%f")
    if until:
        q += "&date<=" + until.strftime(ISO + ".%f")
    return get(q + extra)


def ts(s: str) -> datetime:
    return datetime.fromisoformat(s).replace(tzinfo=None)


def quick_laps(laps: list[dict]) -> list[dict]:
    """FastF1's pick_quicklaps: within 107% of the fastest lap."""
    timed = [l for l in laps if l.get("lap_duration") and l.get("date_start")
             and not l.get("is_pit_out_lap") and (l.get("lap_number") or 0) > 1]
    best = min(l["lap_duration"] for l in timed)
    return sorted((l for l in timed if l["lap_duration"] <= best * 1.07), key=lambda l: l["lap_duration"])


def main(slug: str, key: str, out_dir: str | None) -> None:
    meta = GPS[slug]["meta"]
    skey, name = next((k, n) for k, n, s, *_ in GPS[slug]["sessions"] if s == "race")
    load = lambda ep: json.loads((CACHE / f"{skey}_{name}_{ep}.json").read_text(encoding="utf-8"))
    laps, result = load("laps"), load("session_result")
    quick = quick_laps(laps)

    # the fastest lap first, then the next quickest, until one has position data
    lap, pos = None, None
    for cand in quick[:12]:
        start = ts(cand["date_start"])
        end = start + timedelta(seconds=cand["lap_duration"])
        p = feed("location", skey, cand["driver_number"], start, end)
        p = [r for r in p if r.get("x") or r.get("y")]
        if len(p) > 100:
            lap, pos = cand, p
            break
    if lap is None:
        raise SystemExit("no lap in this race carries position data")
    xs = np.array([r["x"] for r in pos], dtype=float)
    ys = np.array([r["y"] for r in pos], dtype=float)
    print(f"  shape from lap {lap['lap_number']} of car {lap['driver_number']}: "
          f"{lap['lap_duration']}s, {len(xs)} samples")

    step = max(1, len(xs) // MAX_POINTS)
    xs, ys = xs[::step], ys[::step]
    minx, maxx, miny, maxy = xs.min(), xs.max(), ys.min(), ys.max()
    span = max(maxx - minx, maxy - miny)
    scale = (VIEW - 2 * PAD) / span
    offx = (VIEW - (maxx - minx) * scale) / 2
    offy = (VIEW - (maxy - miny) * scale) / 2
    tx = lambda x: round(float(offx + (x - minx) * scale), 1)
    ty = lambda y: round(float(VIEW - (offy + (y - miny) * scale)), 1)
    points = [[tx(x), ty(y)] for x, y in zip(xs, ys)]
    closing = float(np.hypot(points[0][0] - points[-1][0], points[0][1] - points[-1][1]))
    print(f"  gap before closing the loop: {closing:.1f} of {VIEW:.0f}")
    points.append(points[0])

    # the corner list FastF1's get_circuit_info reads
    meeting = get(f"{BASE}/sessions?session_key={skey}")[0]
    mk = get(f"{BASE}/meetings?meeting_key={meeting['meeting_key']}")[0]
    try:
        info = get(mk["circuit_info_url"])
    except Exception as e:
        print("  no circuit info:", e)
        info = None
    names = CORNER_NAMES.get(key, {})
    found = (info or {}).get("corners") or []
    corners = [{"x": tx(c["trackPosition"]["x"]), "y": ty(c["trackPosition"]["y"]), "label": names[int(c["number"])]}
               for c in found if int(c["number"]) in names]
    corner_count = OFFICIAL_CORNERS.get(key) or (len(found) or None)

    # ---- circuit vitals, the same five everywhere ----
    end = ts(lap["date_start"]) + timedelta(seconds=lap["lap_duration"])
    tel = feed("car_data", skey, lap["driver_number"], ts(lap["date_start"]), end)
    t = np.array([(ts(r["date"]) - ts(tel[0]["date"])).total_seconds() for r in tel])
    speed = np.array([r["speed"] for r in tel], dtype=float)
    # FastF1's add_distance: speed times time, sample by sample
    dist = np.cumsum(speed / 3.6 * np.diff(t, prepend=t[0]))
    seg = np.diff(dist, prepend=dist[0])
    thr = np.array([r["throttle"] for r in tel], dtype=float)
    flat_out = float(seg[thr >= 98].sum() / seg.sum() * 100)
    length_km = OFFICIAL_LENGTH_KM.get(key, float(dist.max()) / 1000)
    slowest = int(speed.min())

    # the highest speed on any quick lap: only the fast samples are fetched
    fast = feed("car_data", skey, extra="&speed>=280")
    windows = {}
    for l in quick:
        s = ts(l["date_start"])
        windows.setdefault(l["driver_number"], []).append((s, s + timedelta(seconds=l["lap_duration"])))
    top_speed = 0
    for r in fast:
        when = ts(r["date"])
        if any(a <= when <= b for a, b in windows.get(r["driver_number"], [])):
            top_speed = max(top_speed, int(r["speed"]))

    brake = np.array([r["brake"] for r in tel]).astype(bool)
    braking, start = 0, None
    for i, on in enumerate(brake):
        if on and start is None:
            start = i
        elif not on and start is not None:
            if dist[i] - dist[start] >= MIN_BRAKING_METRES:
                braking += 1
            start = None

    # the lap count and the day from the session itself: a race can run short
    # of its schedule (Sepang 2026: 55 of 56)
    total_laps = next(r["number_of_laps"] for r in result if r.get("position") == 1)
    h, m, *_ = (int(x) for x in meeting["gmt_offset"].replace("-", "").split(":"))
    sign = -1 if meeting["gmt_offset"].startswith("-") else 1
    local = ts(meeting["date_start"]) + sign * timedelta(hours=h, minutes=m)
    stats = [
        {"label": "Lap length", "value": f"{length_km:.3f} km",
         "short": f"Start line to start line, {total_laps} times over on {local.strftime('%A')}"},
        {"label": "Corners", "value": str(corner_count) if corner_count else "-",
         "short": "Each one a chance to gain time, and a chance to throw the lap away"},
        {"label": "Full throttle", "value": f"{flat_out:.0f}%",
         "short": "How much of the lap is spent flat out, and how much the engine gets to decide"},
        {"label": "Top speed", "value": f"{top_speed} km/h",
         "short": f"Peak in the car data on clean laps. It drops to {slowest} km/h at the tightest corner"},
        {"label": "Braking zones", "value": str(braking),
         "short": "Proper stops, not brushes of the pedal. This is where the overtakes happen"},
    ]

    out = Path(out_dir) / slug if out_dir else DATA / slug
    out.mkdir(parents=True, exist_ok=True)
    (out / "track.json").write_text(json.dumps({
        "circuit": CIRCUIT_NAME.get(key, key), "view": VIEW, "start": points[0],
        "points": points, "corners": corners, "stats": stats,
    }), encoding="utf-8")
    (out / "weekend.json").write_text(json.dumps({
        "slug": slug, "gp": meta["gp"], "short": meta["short"], "circuit": CIRCUIT_NAME.get(key, key),
        "country": meta["country"], "date": local.strftime("%d %b %Y").upper(), "laps": total_laps,
        "sessions": [], "rating": None, "heat": [],
    }, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"[OK] {slug}: {len(points)} track points, {len(corners)} named corners")
    for s in stats:
        print(f"  {s['label']:<14} {s['value']}")


if __name__ == "__main__":
    args = sys.argv[1:]
    out_dir = None
    if "--out" in args:
        i = args.index("--out")
        out_dir = args[i + 1]
        del args[i:i + 2]
    main(args[0], args[1], out_dir)
