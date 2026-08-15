"""
Builds the whole Grand Prix weekend from the cached sessions.

  data/<slug>/weekend.json          the hub: sessions and their headlines
  data/<slug>/story_<session>.json  one deep story per session

Everyone gets the same, full analysis: no depth selector, no spoiler gate.
The detectors mine everything the feed carries -- sector times, the speed trap,
the gap to the car ahead, every flag, every stop -- so a race lands 20-30
moments and even a practice session has something honest to say.

Usage:  python build_weekend.py
"""
import json
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path
from statistics import mean, median

ROOT = Path(__file__).parent
CACHE = ROOT / "cache"
OUT = ROOT.parent / "data" / "silverstone-2026"

GP = {
    "slug": "silverstone-2026", "gp": "British Grand Prix 2026",
    "short": "British Grand Prix", "circuit": "Silverstone",
    "country": "Great Britain", "date": "05 JUL 2026", "laps": 52,
}

SESSIONS = [
    (11316, "FP1", "fp1", "Practice 1", "practice"),
    (11317, "Sprint_Quali", "sprint-quali", "Sprint Qualifying", "quali"),
    (11321, "Sprint", "sprint", "Sprint", "race"),
    (11322, "Quali", "quali", "Qualifying", "quali"),
    (11326, "Race", "race", "Race", "race"),
]


def load(skey: int, sname: str, ep: str) -> list:
    f = CACHE / f"{skey}_{sname}_{ep}.json"
    return json.loads(f.read_text(encoding="utf-8")) if f.exists() else []


def parse_ts(s: str | None) -> datetime | None:
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00")) if s else None
    except (ValueError, TypeError):
        return None


def fmt(seconds: float) -> str:
    m = int(seconds // 60)
    return f"{m}:{seconds - m * 60:06.3f}" if m else f"{seconds:.3f}"


def q_gap(r: dict) -> float | None:
    """In qualifying gap_to_leader is a list [Q1, Q2, Q3]."""
    g = r.get("gap_to_leader")
    if isinstance(g, list):
        vals = [x for x in g if isinstance(x, (int, float))]
        return vals[-1] if vals else None
    return g if isinstance(g, (int, float)) else None


class Session:
    def __init__(self, skey: int, cache_name: str, slug: str, label: str, kind: str):
        self.key, self.slug, self.label, self.kind = skey, slug, label, kind
        self.drivers = {d["driver_number"]: d for d in load(skey, cache_name, "drivers")}
        self.laps = load(skey, cache_name, "laps")
        self.result = sorted(load(skey, cache_name, "session_result"),
                             key=lambda r: (r.get("position") or 99))
        self.overtakes = load(skey, cache_name, "overtakes")
        self.pits = load(skey, cache_name, "pit")
        self.stints = load(skey, cache_name, "stints")
        self.rc = load(skey, cache_name, "race_control")
        self.weather = load(skey, cache_name, "weather")
        self.radio = load(skey, cache_name, "team_radio")
        self.intervals = load(skey, cache_name, "intervals")
        self.grid = sorted(load(skey, cache_name, "starting_grid"),
                           key=lambda r: (r.get("position") or 99))
        self.total_laps = max((l.get("lap_number") or 0) for l in self.laps) if self.laps else 0
        starts: dict[int, list[datetime]] = defaultdict(list)
        for l in self.laps:
            ts = parse_ts(l.get("date_start"))
            if l.get("lap_number") and ts:
                starts[l["lap_number"]].append(ts)
        self.lap_index = sorted((ln, sorted(t)[len(t) // 2]) for ln, t in starts.items())

    # ---------- helpers ----------
    def name(self, num: int | None) -> str:
        d = self.drivers.get(num, {})
        return d.get("last_name") or d.get("name_acronym") or f"#{num}"

    def team(self, num: int | None) -> str:
        return self.drivers.get(num, {}).get("team_name", "")

    def lap_of(self, ts: datetime | None) -> int | None:
        if not ts:
            return None
        prev = None
        for ln, start in self.lap_index:
            if ts < start:
                return prev
            prev = ln
        return prev

    def timed_laps(self, num: int) -> list[dict]:
        return [l for l in self.laps
                if l.get("driver_number") == num and l.get("lap_duration")
                and not l.get("is_pit_out_lap")]

    @property
    def best_lap(self) -> dict | None:
        timed = [l for l in self.laps if l.get("lap_duration")]
        return min(timed, key=lambda l: l["lap_duration"]) if timed else None

    @property
    def dnfs(self) -> list[dict]:
        return [r for r in self.result if r.get("dnf")]

    @property
    def sc_laps(self) -> list[int]:
        return sorted({m["lap_number"] for m in self.rc
                       if "SAFETY CAR DEPLOYED" in (m.get("message") or "").upper()
                       and m.get("lap_number")})

    def messages(self, *needles: str) -> list[dict]:
        return [m for m in self.rc
                if any(n in (m.get("message") or "").upper() for n in needles)]

    def green_overtakes(self) -> list[tuple[int, dict]]:
        """Lap 1 and safety-car restarts are field shuffles, not passes."""
        sc = set(self.sc_laps)
        out = []
        for o in self.overtakes:
            ln = self.lap_of(parse_ts(o.get("date")))
            if ln and ln > 1 and not any(abs(ln - s) <= 2 for s in sc):
                out.append((ln, o))
        return out

    def speed_trap(self) -> tuple[int, int] | None:
        best = max((l for l in self.laps if l.get("st_speed")),
                   key=lambda l: l["st_speed"], default=None)
        return (best["driver_number"], int(best["st_speed"])) if best else None

    def sector_kings(self) -> list[tuple[str, str, float]]:
        out = []
        for i in (1, 2, 3):
            key = f"duration_sector_{i}"
            best = min((l for l in self.laps if l.get(key)),
                       key=lambda l: l[key], default=None)
            if best:
                out.append((f"Sector {i}", self.name(best["driver_number"]), best[key]))
        return out

    def battles(self, threshold: float = 1.0, min_samples: int = 25) -> list[tuple[int, int]]:
        """Drivers who sat within DRS range of the car ahead for a long stretch."""
        runs: dict[int, int] = Counter()
        current: dict[int, int] = defaultdict(int)
        for iv in sorted(self.intervals, key=lambda x: x.get("date") or ""):
            num, gap = iv.get("driver_number"), iv.get("interval")
            if isinstance(gap, (int, float)) and 0 < gap <= threshold:
                current[num] += 1
                runs[num] = max(runs[num], current[num])
            else:
                current[num] = 0
        return [(n, c) for n, c in runs.most_common(6) if c >= min_samples]

    def pace(self, num: int) -> float | None:
        """Median clean lap: a fairer read of pace than any single lap."""
        laps = [l["lap_duration"] for l in self.timed_laps(num)]
        return median(laps) if len(laps) >= 5 else None


# ------------------------------------------------------------------ race
def race_story(s: Session) -> list[dict]:
    if not s.result:
        return []
    cards: list[dict] = []
    green = s.green_overtakes()
    ov_by_driver = Counter(o["overtaking_driver_number"] for _, o in green)
    grid_pos = {g["driver_number"]: g.get("position") for g in s.grid}
    winner = s.result[0]
    add = cards.append

    add({"type": "cover", "lap": 0,
         "kicker": f"{GP['short']} · {s.label} · {s.total_laps} laps",
         "title": "Everything that happened, in order",
         "text": f"{len(green)} on-track passes, {len(s.pits)} pit stops, "
                 f"{len(s.dnfs)} cars that never finished"
                 + (f" and {len(s.sc_laps)} safety car." if s.sc_laps else ".")})

    # --- the start ---
    lap1 = [o for o in s.overtakes if s.lap_of(parse_ts(o.get("date"))) in (None, 1)]
    add({"type": "moment", "lap": 1, "kicker": "Lap 1 · Lights out",
         "title": f"{len(lap1)} places changed hands before the first lap was done",
         "text": "Twenty cars funnelling into the first corner on cold tyres. "
                 "Most of this is the pack sorting itself out, and some of it "
                 "decides the afternoon."})

    # --- busiest green-flag laps ---
    for lap, n in Counter(ln for ln, _ in green).most_common(3):
        movers = Counter(o["overtaking_driver_number"] for ln, o in green if ln == lap)
        add({"type": "moment", "lap": lap, "kicker": f"Lap {lap} · Traffic",
             "title": f"{n} overtakes on this lap alone",
             "text": "The pack compressed and everyone had a go: "
                     + ", ".join(s.name(num) for num, _ in movers.most_common(3)) + ".",
             "dato": {"label": f"Passes on lap {lap}",
                      "rows": [[s.name(num), c] for num, c in movers.most_common()]}})

    # --- fights for the lead ---
    lead = [(ln, o) for ln, o in green if (o.get("position") or 99) == 1]
    if lead:
        ln, o = lead[0]
        add({"type": "moment", "lap": ln, "kicker": f"Lap {ln} · For the lead",
             "title": f"{s.name(o['overtaking_driver_number'])} takes the lead from "
                      f"{s.name(o['overtaken_driver_number'])}",
             "text": f"The lead changed hands {len(lead)} time"
                     f"{'s' if len(lead) > 1 else ''} on track today, which is "
                     "rarer than it sounds."})

    # --- the busiest driver ---
    if ov_by_driver:
        num, n = ov_by_driver.most_common(1)[0]
        add({"type": "moment", "lap": max(2, s.total_laps // 3),
             "kicker": "The one doing the passing",
             "title": f"{s.name(num)}: {n} overtakes",
             "text": f"More than anybody else out there, in a {s.team(num)}.",
             "dato": {"label": "Most overtakes",
                      "rows": [[s.name(d), c] for d, c in ov_by_driver.most_common(6)]}})

    # --- battles that never resolved ---
    stuck = s.battles()
    if stuck:
        add({"type": "moment", "lap": max(2, int(s.total_laps * 0.55)),
             "kicker": "Stuck within a second",
             "title": f"{s.name(stuck[0][0])} spent the race in somebody's mirrors",
             "text": "Close enough for DRS for long stretches and still no way "
                     "through. This is what modern F1 traffic actually looks like, "
                     "and it happened to "
                     + (f"{len(stuck)} drivers today." if len(stuck) > 1 else "him alone today."),
             "dato": {"label": "Longest spells within a second",
                      "rows": [[s.name(n), f"{c} samples"] for n, c in stuck]}})

    # --- pit strategy ---
    real_pits = [p for p in s.pits if p.get("pit_duration")]
    if real_pits:
        window = int(median(p["lap_number"] for p in real_pits if p.get("lap_number")))
        fastest = min(real_pits, key=lambda p: p["pit_duration"])
        by_lap = Counter(p["lap_number"] for p in real_pits)
        busiest_lap, busiest_n = by_lap.most_common(1)[0]
        add({"type": "moment", "lap": window, "kicker": f"Lap {window} · Pit window",
             "title": f"{len(real_pits)} stops, and the busiest lap saw {busiest_n} of them",
             "text": f"Once one car blinks, everybody has to answer. The quickest "
                     f"trip down the lane belonged to {s.name(fastest['driver_number'])} "
                     f"at {fastest['pit_duration']:.1f}s.",
             "dato": {"label": "Stops per lap",
                      "rows": [[f"Lap {l}", c] for l, c in sorted(by_lap.items())[:8]]}})

        stops_per_driver = Counter(p["driver_number"] for p in real_pits)
        odd = [n for n, c in stops_per_driver.items() if c >= 3]
        if odd:
            add({"type": "moment", "lap": window + 4, "kicker": "Off the script",
                 "title": f"{s.name(odd[0])} stopped {stops_per_driver[odd[0]]} times",
                 "text": "Three stops when the field is doing one or two means "
                         "something went wrong, or somebody gambled."})

    # --- tyres ---
    if s.stints:
        compounds = Counter(st.get("compound") for st in s.stints if st.get("compound"))
        longest = max(s.stints, key=lambda st: (st.get("lap_end") or 0) - (st.get("lap_start") or 0))
        span = (longest.get("lap_end") or 0) - (longest.get("lap_start") or 0)
        add({"type": "moment", "lap": longest.get("lap_end") or s.total_laps // 2,
             "kicker": "Tyres", "title": f"{s.name(longest['driver_number'])} nursed one "
                                         f"set for {span} laps",
             "text": f"On the {(longest.get('compound') or '').lower()}s. Every lap you "
                     "stretch is a lap you do not lose in the pits, until the rubber "
                     "gives up.",
             "dato": {"label": "Stints by compound",
                      "rows": [[c, n] for c, n in compounds.most_common()]}})

    # --- safety cars ---
    for lap in s.sc_laps:
        ended = next((m["lap_number"] for m in s.messages("SAFETY CAR IN THIS LAP")
                      if (m.get("lap_number") or 0) >= lap), None)
        add({"type": "moment", "lap": lap,
             "kicker": f"Lap {lap} of {s.total_laps} · Safety Car",
             "title": "Every gap on track, erased",
             "text": (f"Neutralised until lap {ended}. " if ended else "")
                     + "Whatever anybody had built up to here was wiped out, and the "
                       "race restarted nose to tail."})

    # --- flags and stewards ---
    yellows = [m for m in s.rc if m.get("flag") in ("YELLOW", "DOUBLE YELLOW")]
    if yellows:
        sectors = Counter(m.get("message", "").split("SECTOR")[-1].strip()
                          for m in yellows if "SECTOR" in (m.get("message") or ""))
        add({"type": "moment", "lap": yellows[len(yellows) // 2].get("lap_number") or 1,
             "kicker": "Yellow flags", "title": f"{len(yellows)} yellow flag calls",
             "text": "Debris, spins and cars parked in dangerous places. Every one "
                     "of them costs lap time to whoever is unlucky enough to arrive.",
             "dato": {"label": "Most affected sectors",
                      "rows": [[f"Sector {k}", v] for k, v in sectors.most_common(4) if k]}})

    blues = [m for m in s.rc if m.get("flag") == "BLUE"]
    if len(blues) > 20:
        add({"type": "moment", "lap": int(s.total_laps * 0.6), "kicker": "Blue flags",
             "title": f"{len(blues)} blue flags waved",
             "text": "That is how often a backmarker had to move aside. Lapped "
                     "traffic decides more races than anybody admits."})

    investigations = s.messages("INVESTIGATION", "NOTED")
    if investigations:
        add({"type": "moment", "lap": investigations[0].get("lap_number") or s.total_laps,
             "kicker": "Stewards", "title": f"{len(investigations)} incidents looked at",
             "text": (investigations[0].get("message") or "").title() + ".",
             "dato": {"label": "Under investigation",
                      "rows": [[f"Lap {m.get('lap_number') or '-'}",
                                (m.get("message") or "")[:44]] for m in investigations[:5]]}})

    penalties = s.messages("PENALTY")
    if penalties:
        add({"type": "moment", "lap": penalties[0].get("lap_number") or s.total_laps,
             "kicker": "Penalties", "title": f"{len(penalties)} penalty calls",
             "text": "Time added, places lost, and in some cases a result rewritten "
                     "after the flag."})

    deleted = s.messages("DELETED")
    if deleted:
        add({"type": "moment", "lap": deleted[0].get("lap_number") or 1,
             "kicker": "Track limits", "title": f"{len(deleted)} lap times deleted",
             "text": "The white line is the track. Run wide and the lap simply "
                     "stops counting."})

    # --- retirements ---
    for r in s.dnfs:
        num = r["driver_number"]
        out_lap = max((l.get("lap_number") or 0) for l in s.laps
                      if l.get("driver_number") == num) or 0
        add({"type": "moment", "lap": out_lap, "kicker": f"Lap {out_lap} · Retirement",
             "title": f"{s.name(num)} is out",
             "text": f"The {s.team(num)} stops after {out_lap} laps. "
                     "Zero points weekends are where title fights quietly bleed."})

    # --- pace and speed ---
    best = s.best_lap
    if best:
        add({"type": "moment", "lap": best.get("lap_number"),
             "kicker": f"Lap {best.get('lap_number')} · Fastest lap",
             "title": f"{s.name(best['driver_number'])}: {fmt(best['lap_duration'])}",
             "text": f"The quickest anybody went all afternoon, in a "
                     f"{s.team(best['driver_number'])}.",
             "dato": {"label": "Best sector times",
                      "rows": [[f"{sec} · {who}", f"{t:.3f}s"]
                               for sec, who, t in s.sector_kings()]}})

    trap = s.speed_trap()
    if trap:
        add({"type": "moment", "lap": int(s.total_laps * 0.45), "kicker": "Speed trap",
             "title": f"{s.name(trap[0])} hit {trap[1]} km/h",
             "text": "Top speed says as much about wing level and tow as it does "
                     "about the engine."})

    # --- pace ranking, the honest one ---
    ranked = sorted(((s.pace(r["driver_number"]), r["driver_number"])
                     for r in s.result if s.pace(r["driver_number"])), key=lambda x: x[0])
    if len(ranked) >= 5:
        add({"type": "moment", "lap": int(s.total_laps * 0.7), "kicker": "True pace",
             "title": f"{s.name(ranked[0][1])} had the quickest car underneath him",
             "text": "Ranked on median clean lap, which strips out traffic, safety "
                     "cars and one-off heroics. It does not always match the result.",
             "dato": {"label": "Median clean lap",
                      "rows": [[s.name(n), fmt(t)] for t, n in ranked[:6]]}})

    # --- movers ---
    gains = [((grid_pos.get(r["driver_number"]) or 99) - (r.get("position") or 99),
              r["driver_number"]) for r in s.result
             if not r.get("dnf") and grid_pos.get(r["driver_number"])]
    if gains:
        climb, num = max(gains)
        if climb > 1:
            add({"type": "moment", "lap": max(2, s.total_laps - 4),
                 "kicker": "The drive nobody talked about",
                 "title": f"{s.name(num)}: P{grid_pos[num]} on the grid, "
                          f"P{next(r.get('position') for r in s.result if r['driver_number'] == num)} at the flag",
                 "text": f"{climb} places gained, one pass at a time, most of them "
                         "nowhere near a TV camera."})
        drop, dnum = min(gains)
        if drop < -1:
            add({"type": "moment", "lap": max(3, s.total_laps - 6), "kicker": "Backwards",
                 "title": f"{s.name(dnum)} went the other way: {abs(drop)} places lost",
                 "text": "Strategy, damage or simply a car that would not do what it "
                         "did on Saturday."})

    # --- weather ---
    if s.weather:
        track = [w["track_temperature"] for w in s.weather if w.get("track_temperature")]
        air = [w["air_temperature"] for w in s.weather if w.get("air_temperature")]
        if track:
            add({"type": "moment", "lap": int(s.total_laps * 0.3), "kicker": "Conditions",
                 "title": f"Track at {max(track):.0f}°C, and falling to {min(track):.0f}°C",
                 "text": "Hot tarmac punishes tyres and rewards whoever is gentlest "
                         "with them. As it cools, the picture flips."
                         + (" It stayed dry." if not any(w.get("rainfall") for w in s.weather) else ""),
                 "dato": {"label": "Conditions",
                          "rows": [["Track temp", f"{min(track):.0f}-{max(track):.0f} °C"],
                                   ["Air temp", f"{min(air):.0f}-{max(air):.0f} °C" if air else "-"],
                                   ["Rain", "Yes" if any(w.get("rainfall") for w in s.weather) else "No"]]}})

    # --- the flag ---
    podium = s.result[:3]
    add({"type": "moment", "lap": s.total_laps, "kicker": "Chequered flag",
         "title": f"{s.name(winner['driver_number'])} wins it",
         "text": " · ".join(f"P{r['position']} {s.name(r['driver_number'])}" for r in podium)
                 + f". {s.name(podium[1]['driver_number'])} finished "
                   f"{q_gap(podium[1]) or 0:.3f}s behind." if len(podium) > 1 else "",
         "dato": {"label": "Points scored",
                  "rows": [[s.name(r["driver_number"]), f"{r.get('points') or 0:.0f}"]
                           for r in s.result[:10]]}})

    head = [c for c in cards if c["type"] == "cover"]
    body = sorted((c for c in cards if c["type"] == "moment"),
                  key=lambda c: c.get("lap") or 0)
    return head + body


# ------------------------------------------------------------------ quali
def quali_story(s: Session) -> list[dict]:
    if not s.result:
        return []
    cards: list[dict] = []
    add = cards.append
    pole = s.result[0]
    margin = q_gap(s.result[1]) if len(s.result) > 1 else None

    add({"type": "cover", "lap": 0, "kicker": f"{GP['short']} · {s.label}",
         "title": "One lap decides the whole Sunday",
         "text": "Three rounds, five cars knocked out each time, and a grid that "
                 "shapes everything the race can become."})

    add({"type": "moment", "lap": 1, "kicker": "Pole position",
         "title": f"{s.name(pole['driver_number'])} takes it",
         "text": (f"By {margin:.3f}s over {s.name(s.result[1]['driver_number'])}. "
                  "Less time than a blink." if margin
                  else f"For {s.team(pole['driver_number'])}."),
         "dato": {"label": "Top ten",
                  "rows": [[f"P{r['position']} {s.name(r['driver_number'])}",
                            s.team(r["driver_number"])] for r in s.result[:10]]}})

    for lo, hi, rnd, note in ((16, 20, "Q1", "Out before it got serious"),
                              (11, 15, "Q2", "So close to the top ten")):
        out = [r for r in s.result if lo <= (r.get("position") or 99) <= hi]
        if out:
            add({"type": "moment", "lap": 2 if rnd == "Q1" else 3,
                 "kicker": f"{rnd} · The cut", "title": note,
                 "text": ", ".join(f"{s.name(r['driver_number'])} (P{r['position']})"
                                   for r in out) + ".",
                 "dato": {"label": f"Knocked out in {rnd}",
                          "rows": [[s.name(r["driver_number"]), f"P{r['position']}"]
                                   for r in out]}})

    deleted = s.messages("DELETED")
    if deleted:
        add({"type": "moment", "lap": 4, "kicker": "Track limits",
             "title": f"{len(deleted)} laps thrown in the bin",
             "text": "In qualifying a deleted lap can be the difference between "
                     "Q3 and going home early.",
             "dato": {"label": "Deleted laps",
                      "rows": [[(m.get("message") or "")[:40], "deleted"]
                               for m in deleted[:5]]}})

    trap = s.speed_trap()
    if trap:
        add({"type": "moment", "lap": 5, "kicker": "Speed trap",
             "title": f"{s.name(trap[0])} was quickest through the trap: {trap[1]} km/h",
             "text": "Qualifying trim, wings trimmed back, nothing to lose."})

    kings = s.sector_kings()
    if kings:
        add({"type": "moment", "lap": 6, "kicker": "Sector by sector",
             "title": "Nobody owned the whole lap",
             "text": "The perfect lap of the day was never actually driven: it lives "
                     "in three different cars.",
             "dato": {"label": "Fastest sectors",
                      "rows": [[f"{sec} · {who}", f"{t:.3f}s"] for sec, who, t in kings]}})

    yellows = [m for m in s.rc if m.get("flag") in ("YELLOW", "DOUBLE YELLOW")]
    if yellows:
        add({"type": "moment", "lap": 7, "kicker": "Interruptions",
             "title": f"{len(yellows)} yellow flag calls during the session",
             "text": "A yellow in the wrong sector at the wrong moment ends "
                     "somebody's lap, and sometimes their session."})

    add({"type": "moment", "lap": 8, "kicker": "The grid",
         "title": "How Sunday starts",
         "text": " · ".join(f"P{r['position']} {s.name(r['driver_number'])}"
                            for r in s.result[:6])})
    return cards


# ------------------------------------------------------------------ practice
def practice_story(s: Session) -> list[dict]:
    cards: list[dict] = []
    add = cards.append
    best = s.best_lap
    laps_by_driver = Counter(l["driver_number"] for l in s.laps if l.get("lap_duration"))

    add({"type": "cover", "lap": 0, "kicker": f"{GP['short']} · {s.label}",
         "title": "Practice, honestly",
         "text": f"{len(s.laps)} laps run and nothing at stake. What it does tell "
                 "you is who looks comfortable and who is fighting the car."})

    if best:
        add({"type": "moment", "lap": 1,
             "kicker": f"Fastest of the session · lap {best.get('lap_number')}",
             "title": f"{s.name(best['driver_number'])}: {fmt(best['lap_duration'])}",
             "text": f"In a {s.team(best['driver_number'])}. Take practice times with "
                     "salt: fuel loads are secret and nobody shows their hand."})

    if laps_by_driver:
        num, n = laps_by_driver.most_common(1)[0]
        add({"type": "moment", "lap": 2, "kicker": "Who did the work",
             "title": f"{s.name(num)} racked up {n} laps",
             "text": "Track time is the currency of a Friday. Whoever runs most "
                     "learns most, and burns the most rubber doing it.",
             "dato": {"label": "Laps completed",
                      "rows": [[s.name(d), c] for d, c in laps_by_driver.most_common(6)]}})

    # long runs tell you far more than a single lap
    runs = []
    for num in laps_by_driver:
        laps = s.timed_laps(num)
        if len(laps) >= 6:
            runs.append((mean(l["lap_duration"] for l in laps), num, len(laps)))
    if len(runs) >= 3:
        runs.sort()
        add({"type": "moment", "lap": 3, "kicker": "Long-run pace",
             "title": f"{s.name(runs[0][1])} looked strongest over a stint",
             "text": "Average clean lap across the session. This is the number teams "
                     "actually care about on a Friday, not the headline time.",
             "dato": {"label": "Average clean lap",
                      "rows": [[s.name(n), fmt(t)] for t, n, _ in runs[:6]]}})

    if s.stints:
        compounds = Counter(st.get("compound") for st in s.stints if st.get("compound"))
        add({"type": "moment", "lap": 4, "kicker": "Tyres",
             "title": "What they ran, and on what",
             "text": "Compound choice on a Friday is a rehearsal for Sunday's plan.",
             "dato": {"label": "Stints by compound",
                      "rows": [[c, n] for c, n in compounds.most_common()]}})

    trap = s.speed_trap()
    if trap:
        add({"type": "moment", "lap": 5, "kicker": "Speed trap",
             "title": f"{s.name(trap[0])} topped the trap at {trap[1]} km/h",
             "text": "Early wing choices show up here before anybody admits to them."})

    incidents = [m for m in s.rc if m.get("flag") in ("YELLOW", "DOUBLE YELLOW", "RED")]
    add({"type": "moment", "lap": 6, "kicker": "Interruptions",
         "title": f"{len(incidents)} flag calls" if incidents else "A clean session",
         "text": ("Every interruption costs somebody a run they had planned."
                  if incidents else
                  "No red flags, no drama. Rare and quietly useful for everyone.")})

    if s.weather:
        track = [w["track_temperature"] for w in s.weather if w.get("track_temperature")]
        if track:
            add({"type": "moment", "lap": 7, "kicker": "Conditions",
                 "title": f"Track between {min(track):.0f}°C and {max(track):.0f}°C",
                 "text": "Friday conditions rarely match Sunday, which is why the "
                         "times you see here mislead so often."})
    return cards


# ------------------------------------------------------------------ build
def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    sessions_meta = []

    for skey, cache_name, slug, label, kind in SESSIONS:
        s = Session(skey, cache_name, slug, label, kind)
        if not s.laps and not s.result:
            print(f"[skip] {label}: no cached data")
            continue

        cards = (race_story(s) if kind == "race" else
                 quali_story(s) if kind == "quali" else practice_story(s))

        story = {"gp": GP["gp"], "session": label, "sessionSlug": slug,
                 "circuit": GP["circuit"], "laps": s.total_laps or GP["laps"],
                 "generated": "build_weekend", "cards": cards}

        if slug == "race" and s.result:
            w = s.result[0]
            story["result"] = {
                "date": GP["date"],
                "podium": [{"pos": i + 1, "number": r["driver_number"],
                            "first": s.drivers.get(r["driver_number"], {}).get("first_name", ""),
                            "last": s.name(r["driver_number"]),
                            "team": s.team(r["driver_number"]),
                            "colour": s.drivers.get(r["driver_number"], {}).get("team_colour", ""),
                            "headshot": s.drivers.get(r["driver_number"], {}).get("headshot_url", "")}
                           for i, r in enumerate(s.result[:3])],
                "fastest": ({"time": round(s.best_lap["lap_duration"], 3),
                             "last": s.name(s.best_lap["driver_number"]),
                             "number": s.best_lap["driver_number"], "first": "",
                             "team": s.team(s.best_lap["driver_number"]),
                             "colour": "", "headshot": ""} if s.best_lap else None)}
            (OUT / "race_story.json").write_text(
                json.dumps(story, ensure_ascii=False, indent=2), encoding="utf-8")

        (OUT / f"story_{slug}.json").write_text(
            json.dumps(story, ensure_ascii=False, indent=2), encoding="utf-8")

        if kind == "practice":
            headline = f"{len(s.laps)} laps run, no points at stake"
        elif kind == "quali":
            headline = (f"{s.name(s.result[0]['driver_number'])} on pole"
                        if s.result else label)
        else:
            headline = (f"{len(s.green_overtakes())} on-track passes"
                        + (f", {len(s.sc_laps)} safety car" if s.sc_laps else ""))

        sessions_meta.append({"slug": slug, "label": label, "kind": kind,
                              "headline": headline, "moments": len(cards),
                              "laps": s.total_laps})
        print(f"[OK] {label}: {len(cards)} cards")

    weekend = {**GP, "sessions": sessions_meta, "rating": None, "heat": []}
    (OUT / "weekend.json").write_text(
        json.dumps(weekend, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[OK] weekend.json · {sum(m['moments'] for m in sessions_meta)} cards total")


if __name__ == "__main__":
    main()
