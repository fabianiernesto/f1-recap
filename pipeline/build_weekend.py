"""
Builds the whole Grand Prix weekend from the cached sessions:

  data/<slug>/weekend.json          the hub: sessions, spoiler-free rating, heat map
  data/<slug>/story_<session>.json  one scroll story per session

Every session gets its own logic: qualifying is told through eliminations and
thousandths, practice through pace and scares, the race through overtakes and
strategy. Honesty is a feature: a dull session is allowed to say so.

Usage:  python build_weekend.py
"""
import json
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path
from statistics import median

ROOT = Path(__file__).parent
CACHE = ROOT / "cache"
OUT = ROOT.parent / "data" / "silverstone-2026"

GP = {
    "slug": "silverstone-2026",
    "gp": "British Grand Prix 2026",
    "short": "British Grand Prix",
    "circuit": "Silverstone",
    "country": "Great Britain",
    "date": "05 JUL 2026",
    "laps": 52,
}

# session key -> (cache name, url slug, label, kind)
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


def q3_gap(r: dict) -> float | None:
    """In qualifying gap_to_leader is a list [Q1, Q2, Q3]; take the last real one."""
    g = r.get("gap_to_leader")
    if isinstance(g, list):
        vals = [x for x in g if isinstance(x, (int, float))]
        return vals[-1] if vals else None
    return g if isinstance(g, (int, float)) else None


class Session:
    """Everything one session knows about itself."""

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
        self.grid = sorted(load(skey, cache_name, "starting_grid"),
                           key=lambda r: (r.get("position") or 99))
        self.total_laps = max((l.get("lap_number") or 0) for l in self.laps) if self.laps else 0
        self._lap_index()

    def name(self, num: int | None) -> str:
        d = self.drivers.get(num, {})
        return d.get("last_name") or d.get("name_acronym") or f"#{num}"

    def team(self, num: int | None) -> str:
        return self.drivers.get(num, {}).get("team_name", "")

    def _lap_index(self) -> None:
        starts: dict[int, list[datetime]] = defaultdict(list)
        for l in self.laps:
            ts = parse_ts(l.get("date_start"))
            if l.get("lap_number") and ts:
                starts[l["lap_number"]].append(ts)
        self.lap_index = sorted((ln, sorted(t)[len(t) // 2]) for ln, t in starts.items())

    def lap_of(self, ts: datetime | None) -> int | None:
        if not ts:
            return None
        prev = None
        for ln, start in self.lap_index:
            if ts < start:
                return prev
            prev = ln
        return prev

    # ---------- shared facts ----------
    @property
    def best_lap(self) -> dict | None:
        timed = [l for l in self.laps if l.get("lap_duration")]
        return min(timed, key=lambda l: l["lap_duration"]) if timed else None

    @property
    def dnfs(self) -> list[dict]:
        return [r for r in self.result if r.get("dnf")]

    @property
    def sc_laps(self) -> list[int]:
        out = []
        for m in self.rc:
            txt = (m.get("message") or "").upper()
            if "SAFETY CAR DEPLOYED" in txt and m.get("lap_number"):
                out.append(m["lap_number"])
        return out

    @property
    def rain(self) -> bool:
        return any(w.get("rainfall") for w in self.weather)

    def green_overtakes(self) -> list[tuple[int | None, dict]]:
        """Lap 1 and safety-car restarts are field shuffles, not passes."""
        sc = set(self.sc_laps)
        out = []
        for o in self.overtakes:
            ln = self.lap_of(parse_ts(o.get("date")))
            if ln and ln > 1 and not any(abs(ln - s) <= 2 for s in sc):
                out.append((ln, o))
        return out


def fmt_time(s: float) -> str:
    m = int(s // 60)
    return f"{m}:{s - m * 60:06.3f}" if m else f"{s:.3f}"


# ---------------------------------------------------------------- stories
def race_story(s: Session) -> list[dict]:
    cards: list[dict] = []
    if not s.result:
        return cards

    winner = s.result[0]
    green = s.green_overtakes()
    ov_by_driver = Counter(o["overtaking_driver_number"] for _, o in green)
    grid_pos = {g["driver_number"]: g.get("position") for g in s.grid}
    best = s.best_lap

    cards.append({
        "type": "cover", "lap": 0,
        "kicker": f"{GP['short']} · {s.label} · {s.total_laps} laps",
        "title": "Here is how it actually went",
        "text": f"{len(green)} genuine on-track passes, "
                f"{len(s.dnfs)} cars that never finished"
                + (f" and {len(s.sc_laps)} safety car" if s.sc_laps else "")
                + ". Scroll and watch it unfold.",
    })

    if green:
        busiest, n = Counter(ln for ln, _ in green).most_common(1)[0]
        top_num, top_n = ov_by_driver.most_common(1)[0]
        cards.append({
            "type": "moment", "lap": busiest,
            "kicker": f"Lap {busiest} · The busiest lap",
            "title": f"{n} overtakes on this lap alone",
            "text": f"The one doing most of the passing all afternoon: "
                    f"{s.name(top_num)}, {top_n} moves.",
            "dato": {"label": "Most overtakes",
                     "rows": [[s.name(n2), c] for n2, c in ov_by_driver.most_common(5)]},
        })

    real_pits = [p for p in s.pits if p.get("pit_duration")]
    if real_pits:
        window = int(median(p["lap_number"] for p in real_pits if p.get("lap_number")))
        fastest = min(real_pits, key=lambda p: p["pit_duration"])
        compounds = Counter(st.get("compound") for st in s.stints)
        cards.append({
            "type": "moment", "lap": window,
            "kicker": f"Lap {window} · Pit window",
            "title": "The stops that shaped it",
            "text": f"Fastest trip down the pit lane, entry to exit: "
                    f"{s.name(fastest['driver_number'])}, {fastest['pit_duration']:.1f}s. "
                    "When nobody gains in the pits, track position becomes the whole game.",
            "dato": {"label": "Stints per compound",
                     "rows": [[c, n] for c, n in compounds.most_common() if c]},
        })

    if best:
        cards.append({
            "type": "moment", "lap": best.get("lap_number"),
            "kicker": f"Lap {best.get('lap_number')} · Fastest lap",
            "title": f"{s.name(best['driver_number'])}: {best['lap_duration']:.3f}s",
            "text": f"The quickest anyone went all day, in a "
                    f"{s.team(best['driver_number'])}.",
        })

    for r in s.dnfs[:1]:
        num = r["driver_number"]
        out_lap = max((l.get("lap_number") or 0) for l in s.laps
                      if l.get("driver_number") == num)
        cards.append({
            "type": "moment", "lap": out_lap,
            "kicker": f"Lap {out_lap} · Out",
            "title": f"{s.name(num)}'s day ends early",
            "text": "Also out: "
                    + (", ".join(s.name(d["driver_number"]) for d in s.dnfs[1:]) or "nobody else")
                    + ". Zero points weekends are where title fights quietly bleed.",
        })

    for lap in s.sc_laps[:1]:
        cards.append({
            "type": "moment", "lap": lap,
            "kicker": f"Lap {lap} of {s.total_laps} · Safety Car",
            "title": "Every gap on track, erased",
            "text": "Whatever anyone had built up to here was wiped out in one lap, "
                    "and the race restarted nose to tail.",
        })

    gains = [(grid_pos.get(r["driver_number"], 99) - (r.get("position") or 99),
              r["driver_number"]) for r in s.result
             if not r.get("dnf") and grid_pos.get(r["driver_number"])]
    if gains:
        climb, num = max(gains)
        if climb > 2:
            cards.append({
                "type": "moment", "lap": max(2, s.total_laps - 4),
                "kicker": "The drive your feed skipped",
                "title": f"{s.name(num)}: P{grid_pos[num]} on the grid, "
                         f"P{next(r.get('position') for r in s.result if r['driver_number'] == num)} at the flag",
                "text": f"{climb} positions gained, one pass at a time, most of them "
                        "nowhere near a TV camera.",
            })

    cards.append({
        "type": "moment", "lap": s.total_laps,
        "kicker": f"Lap {s.total_laps} · Chequered flag",
        "title": f"{s.name(winner['driver_number'])} wins it",
        "text": f"{s.name(winner['driver_number'])} brings the "
                f"{s.team(winner['driver_number'])} home first"
                + (f", ahead of {s.name(s.result[1]['driver_number'])}"
                   f" and {s.name(s.result[2]['driver_number'])}."
                   if len(s.result) > 2 else "."),
    })

    head = [c for c in cards if c["type"] == "cover"]
    body = sorted((c for c in cards if c["type"] == "moment"),
                  key=lambda c: c.get("lap") or 0)
    return head + body


def quali_story(s: Session) -> list[dict]:
    if not s.result:
        return []
    pole = s.result[0]
    margin = q3_gap(s.result[1]) if len(s.result) > 1 else None
    cards = [{
        "type": "cover", "lap": 0,
        "kicker": f"{GP['short']} · {s.label}",
        "title": "One lap decides the whole Sunday",
        "text": "Three rounds, five cars knocked out each time, and a grid that "
                "shapes everything the race can become.",
    }, {
        "type": "moment", "lap": 1,
        "kicker": "Pole position",
        "title": f"{s.name(pole['driver_number'])} takes it",
        "text": (f"By {margin:.3f}s over {s.name(s.result[1]['driver_number'])}. "
                 "That is less time than a blink."
                 if margin else f"For {s.team(pole['driver_number'])}."),
    }]

    # who went out when: Q1 = positions 16-20, Q2 = 11-15
    q1_out = [r for r in s.result if 16 <= (r.get("position") or 99) <= 20]
    q2_out = [r for r in s.result if 11 <= (r.get("position") or 99) <= 15]
    if q1_out:
        cards.append({
            "type": "moment", "lap": 2,
            "kicker": "Q1 · First cut",
            "title": "Out before it got serious",
            "text": ", ".join(f"{s.name(r['driver_number'])} (P{r['position']})"
                              for r in q1_out) + ".",
        })
    if q2_out:
        cards.append({
            "type": "moment", "lap": 3,
            "kicker": "Q2 · Second cut",
            "title": "So close to the top ten",
            "text": ", ".join(f"{s.name(r['driver_number'])} (P{r['position']})"
                              for r in q2_out) + ".",
        })

    cards.append({
        "type": "moment", "lap": 4,
        "kicker": "The front rows",
        "title": "How Sunday starts",
        "text": " · ".join(f"P{r['position']} {s.name(r['driver_number'])}"
                           for r in s.result[:6]),
        "dato": {"label": "Top ten",
                 "rows": [[f"P{r['position']} {s.name(r['driver_number'])}",
                           s.team(r["driver_number"])] for r in s.result[:10]]},
    })
    return cards


def practice_story(s: Session) -> list[dict]:
    best = s.best_lap
    incidents = [m for m in s.rc if "FLAG" in (m.get("message") or "").upper()
                 and "GREEN" not in (m.get("message") or "").upper()]
    cards = [{
        "type": "cover", "lap": 0,
        "kicker": f"{GP['short']} · {s.label}",
        "title": "Practice, honestly",
        "text": "Nobody wins anything here. What it does tell you is who looks "
                "comfortable and who is fighting the car.",
    }]
    if best:
        cards.append({
            "type": "moment", "lap": best.get("lap_number") or 1,
            "kicker": "Fastest of the session",
            "title": f"{s.name(best['driver_number'])}: {fmt_time(best['lap_duration'])}",
            "text": f"In a {s.team(best['driver_number'])}. Take practice times with "
                    "salt: nobody shows their hand yet.",
        })
    cards.append({
        "type": "moment", "lap": 2,
        "kicker": "What actually happened",
        "title": f"{len(incidents)} flags, {len(s.laps)} laps run" if incidents
                 else f"{len(s.laps)} quiet laps",
        "text": "Rodaje, tyre work and long runs."
                if not incidents else
                "Enough interruptions to lose track time, which matters more than it sounds.",
    })
    return cards


# ---------------------------------------------------------------- rating
def race_rating(s: Session) -> dict:
    """Spoiler-free 0-10, built only from how eventful the race was."""
    green = s.green_overtakes()
    lead_changes = len([1 for _, o in green if (o.get("position") or 99) == 1])
    score = 0.0
    score += min(3.0, len(green) / 40)                 # passing
    score += min(2.0, lead_changes * 0.8)              # fights for the lead
    score += min(1.5, len(s.sc_laps) * 0.9)            # neutralisations
    score += min(1.2, len(s.dnfs) * 0.35)              # attrition
    score += 1.5 if s.rain else 0                      # weather
    late = [ln for ln, _ in green if ln and ln > s.total_laps * 0.85]
    score += min(1.3, len(late) * 0.25)                # late drama
    score = round(min(10.0, score + 1.0), 1)

    if score >= 8:
        verdict = "Find two hours. Watch this one properly."
    elif score >= 6:
        verdict = "Worth your time, especially the last stretch."
    elif score >= 4:
        verdict = "Fine. Watch the highlights and you have not missed much."
    else:
        verdict = "Honestly? Read the recap and get on with your day."
    return {"score": score, "verdict": verdict,
            "spoiler_free": True}


def heat_map(s: Session) -> list[int]:
    """Excitement per lap, 0-10, so you know where to skip to on a replay."""
    per_lap = Counter(ln for ln, _ in s.green_overtakes() if ln)
    for m in s.rc:
        txt = (m.get("message") or "").upper()
        ln = m.get("lap_number")
        if not ln:
            continue
        if "SAFETY CAR" in txt:
            per_lap[ln] += 4
        elif "FLAG" in txt and "GREEN" not in txt:
            per_lap[ln] += 2
        elif "INVESTIGATION" in txt or "PENALTY" in txt:
            per_lap[ln] += 1
    peak = max(per_lap.values(), default=1)
    return [min(10, round(per_lap.get(ln, 0) / peak * 10))
            for ln in range(1, (s.total_laps or 1) + 1)]


# ---------------------------------------------------------------- build
def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    sessions_meta = []
    race: Session | None = None

    for skey, cache_name, slug, label, kind in SESSIONS:
        s = Session(skey, cache_name, slug, label, kind)
        if not s.laps and not s.result:
            print(f"[skip] {label}: no cached data")
            continue

        cards = (race_story(s) if kind == "race" else
                 quali_story(s) if kind == "quali" else practice_story(s))

        story = {
            "gp": GP["gp"], "session": label, "sessionSlug": slug,
            "circuit": GP["circuit"], "laps": s.total_laps or GP["laps"],
            "generated": "build_weekend", "cards": cards,
        }

        if slug == "race":
            race = s
            winner = s.result[0] if s.result else None
            if winner:
                story["result"] = {
                    "date": GP["date"],
                    "podium": [{"pos": i + 1, "number": r["driver_number"],
                                "first": s.drivers.get(r["driver_number"], {}).get("first_name", ""),
                                "last": s.name(r["driver_number"]),
                                "team": s.team(r["driver_number"]),
                                "colour": s.drivers.get(r["driver_number"], {}).get("team_colour", ""),
                                "headshot": s.drivers.get(r["driver_number"], {}).get("headshot_url", "")}
                               for i, r in enumerate(s.result[:3])],
                    "fastest": {"time": round(s.best_lap["lap_duration"], 3),
                                "last": s.name(s.best_lap["driver_number"]),
                                "number": s.best_lap["driver_number"],
                                "first": "", "team": s.team(s.best_lap["driver_number"]),
                                "colour": "", "headshot": ""} if s.best_lap else None,
                }
            (OUT / "race_story.json").write_text(
                json.dumps(story, ensure_ascii=False, indent=2), encoding="utf-8")

        (OUT / f"story_{slug}.json").write_text(
            json.dumps(story, ensure_ascii=False, indent=2), encoding="utf-8")

        # one honest headline per session for the hub
        if kind == "practice":
            headline = "Rodaje and tyre work. You can skip this one."
        elif kind == "quali":
            headline = f"{s.name(s.result[0]['driver_number'])} on pole" if s.result else label
        else:
            headline = f"{len(s.green_overtakes())} on-track passes" \
                       + (f", {len(s.sc_laps)} safety car" if s.sc_laps else "")

        sessions_meta.append({
            "slug": slug, "label": label, "kind": kind,
            "headline": headline, "moments": len(cards),
            "laps": s.total_laps,
        })
        print(f"[OK] {label}: {len(cards)} cards")

    weekend = {
        **GP,
        "sessions": sessions_meta,
        "rating": race_rating(race) if race else None,
        "heat": heat_map(race) if race else [],
    }
    (OUT / "weekend.json").write_text(
        json.dumps(weekend, ensure_ascii=False, indent=2), encoding="utf-8")
    r = weekend["rating"]
    print(f"[OK] weekend.json · rating {r['score']}/10 · heat map "
          f"{len(weekend['heat'])} laps")


if __name__ == "__main__":
    main()
