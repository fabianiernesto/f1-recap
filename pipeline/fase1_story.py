"""
Fase 1 (v1) -- Race story generator, English, bar voice.
Reads the Silverstone 2026 cache and produces the scroll recap:
every moment anchored to a real lap so the car can travel the race.

Voice rules (from Ernesto's LinkedIn system, memory_v16 + simplified_master):
no em dashes (only -->), no signposts, no flat lists, no dead negation,
hooks are scenes with stakes, every explainer lands a "so what".

Usage:  python fase1_story.py
"""
import json
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path
from statistics import median

ROOT = Path(__file__).parent
CACHE = ROOT / "cache"
OUT = ROOT.parent / "data" / "silverstone-2026"
PREVIEW = ROOT.parent / "web_preview"

RACE, QUALI = 11326, 11322
TOTAL_LAPS = 52


def load(skey: int, sname: str, ep: str) -> list:
    f = CACHE / f"{skey}_{sname}_{ep}.json"
    return json.loads(f.read_text(encoding="utf-8")) if f.exists() else []


def parse_ts(s: str | None) -> datetime | None:
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00")) if s else None
    except (ValueError, TypeError):
        return None


def main() -> None:
    drivers = {d["driver_number"]: d for d in load(RACE, "Race", "drivers")}

    def name(num: int | None) -> str:
        d = drivers.get(num, {})
        return d.get("last_name") or d.get("name_acronym") or f"#{num}"

    def team(num: int | None) -> str:
        return drivers.get(num, {}).get("team_name", "?")

    laps = load(RACE, "Race", "laps")
    result = sorted(load(RACE, "Race", "session_result"),
                    key=lambda r: (r.get("position") or 99))
    overtakes = load(RACE, "Race", "overtakes")
    pits = load(RACE, "Race", "pit")
    stints = load(RACE, "Race", "stints")
    positions = load(RACE, "Race", "position")
    quali_res = sorted(load(QUALI, "Quali", "session_result"),
                       key=lambda r: (r.get("position") or 99))

    # ---- lap <-> time index ----
    lap_starts: dict[int, list[datetime]] = defaultdict(list)
    for l in laps:
        ts = parse_ts(l.get("date_start"))
        if l.get("lap_number") and ts:
            lap_starts[l["lap_number"]].append(ts)
    lap_index = sorted(
        (ln, sorted(ts)[len(ts) // 2]) for ln, ts in lap_starts.items()
    )

    def lap_of(ts: datetime | None) -> int | None:
        if not ts:
            return None
        prev = None
        for ln, start in lap_index:
            if ts < start:
                return prev
            prev = ln
        return prev

    # ---- facts ----
    pole = quali_res[0]
    pole_num = pole["driver_number"]
    winner, second, third = result[0], result[1], result[2]
    dnfs = [r for r in result if r.get("dnf")]

    def q3_gap(r: dict) -> float | None:
        g = r.get("gap_to_leader")
        if isinstance(g, list):
            vals = [x for x in g if isinstance(x, (int, float))]
            return vals[-1] if vals else None
        return g if isinstance(g, (int, float)) else None

    pole_margin = q3_gap(quali_res[1])

    # leader at the end of lap 1 (last position record before lap 2 starts)
    lap2_start = dict(lap_index).get(2)
    leader_l1 = None
    if lap2_start:
        latest: dict[int, tuple[datetime, int]] = {}
        for p in positions:
            ts = parse_ts(p.get("date"))
            if ts and ts < lap2_start:
                num = p["driver_number"]
                if num not in latest or ts > latest[num][0]:
                    latest[num] = (ts, p.get("position") or 99)
        for num, (_, pos) in latest.items():
            if pos == 1:
                leader_l1 = num
    pole_held = leader_l1 == pole_num

    # overtakes with laps
    ov_laps = [(lap_of(parse_ts(o.get("date"))), o) for o in overtakes]
    # lap 1 is the start shuffle and post-SC laps are field resets: OpenF1
    # logs every position swap, so neither counts as a genuine on-track pass
    green_ov = [(ln, o) for ln, o in ov_laps if ln and 2 <= ln <= 46]
    front_ov = [(ln, o) for ln, o in green_ov if (o.get("position") or 99) <= 3]
    busiest_lap = Counter(ln for ln, _ in green_ov).most_common(1)[0]
    ov_count = Counter(o["overtaking_driver_number"] for _, o in green_ov)

    # best climber vs quali grid
    grid_pos = {r["driver_number"]: r.get("position") for r in quali_res}
    gains = []
    for r in result:
        g, p = grid_pos.get(r["driver_number"]), r.get("position")
        if g and p and not r.get("dnf"):
            gains.append((g - p, r["driver_number"], g, p))
    climb = max(gains)
    climb_num = climb[1]
    climb_last_ov = max((ln for ln, o in ov_laps
                         if ln and o["overtaking_driver_number"] == climb_num),
                        default=None)

    # pits
    real_pits = [p for p in pits if p.get("pit_duration")]
    fastest_pit = min(real_pits, key=lambda p: p["pit_duration"])
    pit_window = int(median(p["lap_number"] for p in real_pits if p.get("lap_number")))
    compounds = Counter(s.get("compound") for s in stints)

    # fastest lap + VER retirement lap
    best_lap = min((l for l in laps if l.get("lap_duration")),
                   key=lambda l: l["lap_duration"])
    dnf_laps = {r["driver_number"]:
                max((l.get("lap_number") or 0) for l in laps
                    if l.get("driver_number") == r["driver_number"])
                for r in dnfs}
    ver = next((r for r in dnfs if name(r["driver_number"]) == "Verstappen"), None)

    # ---- cards (all English, laps anchor the scroll) ----
    cards = [
        {
            "type": "cover", "lap": 0,
            "kicker": "British GP · Silverstone · 52 laps",
            "title": "Four laps from the flag, this race flipped",
            "text": f"Verstappen was already out. Hamilton was chasing a home podium. "
                    f"And then the Safety Car lights came on. {len(green_ov)} genuine "
                    "on-track passes say this was no Sunday drive... scroll and watch "
                    "it unfold.",
        },
        {
            "type": "prediction", "lap": 0,
            "kicker": "Before lights out, call it",
            "title": f"{name(pole_num)} starts from pole, in Hamilton's backyard. "
                     "Does he still lead after lap 1?",
            "options": ["He holds it", "He loses it"],
            "answer": "He holds it" if pole_held else "He loses it",
            "reveal": (f"He held it. {name(pole_num)} covered the field into the "
                       "first corners and closed lap 1 still in front, pole margin "
                       "intact. The hard part came later."
                       if pole_held else
                       f"He lost it. By the time lap 1 was done, "
                       f"{name(leader_l1)} was the name at the top of the tower "
                       f"and {name(pole_num)} was chasing."),
        },
        {
            "type": "prediction", "lap": 18,
            "kicker": "Mid-race, call it",
            "title": f"{name(climb_num)} started way back in P{climb[2]}. "
                     "Where does he finish?",
            "options": ["In the points", "Outside the top 10"],
            "answer": "In the points" if climb[3] <= 10 else "Outside the top 10",
            "reveal": f"P{climb[3]}. {name(climb_num)} climbed {climb[0]} places "
                      f"one pass at a time, and his last one landed on lap "
                      f"{climb_last_ov}, right when the race was at its wildest. "
                      "Almost none of it made the TV cut.",
        },
        {
            "type": "prediction", "lap": 44,
            "kicker": "Lap 44, call it",
            "title": "Verstappen is still out there fighting. "
                     "Does he see the chequered flag?",
            "options": ["He makes it home", "He doesn't"],
            "answer": "He doesn't" if ver else "He makes it home",
            "reveal": (f"He didn't. His car rolled to a stop on lap "
                       f"{dnf_laps.get(ver['driver_number'])}, the Safety Car "
                       "followed, and every gap in the race was erased at once. "
                       "One retirement flipped the whole ending."
                       if ver else "He made it home."),
        },
        {
            "type": "moment", "lap": 1, "kicker": "Lap 1 · Lights out",
            "title": "Pole by almost nothing" if pole_margin and pole_margin < 0.15
                     else "Lights out",
            "text": f"{name(pole_num)} took pole by {pole_margin:.3f}s the day before. "
                    f"That is less time than a single blink. "
                    + (f"Into the first corners it paid off: still P1 when lap 1 closed."
                       if pole_held else
                       f"It bought him exactly one racing lap of peace: by the end of "
                       f"lap 1, {name(leader_l1)} was the name on top."),
        },
        {
            "type": "moment", "lap": busiest_lap[0],
            "kicker": f"Lap {busiest_lap[0]} · The busiest lap",
            "title": f"{busiest_lap[1]} overtakes on this lap alone",
            "text": f"The lead group swapped places {len(front_ov)} times today. "
                    f"Your TV feed showed a fraction of that. The one doing most of "
                    f"the passing: {name(ov_count.most_common(1)[0][0])}, "
                    f"{ov_count.most_common(1)[0][1]} moves all afternoon.",
            "dato": {"label": "Most overtakes (top 5)",
                     "rows": [[name(n), c] for n, c in ov_count.most_common(5)]},
        },
        {
            "type": "moment", "lap": pit_window,
            "kicker": f"Lap {pit_window} · Pit window",
            "title": "One stop, and everyone knew it",
            "text": f"Soft, medium, hard: all three compounds saw track today, and almost "
                    f"everyone got away with a single stop. Fastest trip down the pit lane, "
                    f"entry to exit: {name(fastest_pit['driver_number'])}, "
                    f"{fastest_pit['pit_duration']:.1f}s. When nobody gains anything in the "
                    "pits, track position becomes the whole game... remember that when the "
                    "Safety Car shows up later.",
            "dato": {"label": "Stints per compound",
                     "rows": [[c, n] for c, n in compounds.most_common()]},
        },
        {
            "type": "moment", "lap": climb_last_ov or 30,
            "kicker": "The drive your feed skipped",
            "title": f"{name(climb_num)}: P{climb[2]} on the grid, P{climb[3]} at the flag",
            "text": f"{climb[0]} positions gained, one overtake at a time, most of them "
                    f"nowhere near a TV camera. His last pass came on lap {climb_last_ov}. "
                    f"Nobody will open the sports pages with {name(climb_num)} tomorrow. "
                    "They probably should.",
        },
        {
            "type": "moment", "lap": dnf_laps.get(ver["driver_number"], 30) if ver else 30,
            "kicker": f"Lap {dnf_laps.get(ver['driver_number'])} · Out" if ver else "Out",
            "title": "Verstappen's Sunday ends early" if ver else "Retirements",
            "text": ("His car rolled to a stop on lap "
                     f"{dnf_laps.get(ver['driver_number'])} and that was that. "
                     if ver else "")
                    + "Also out today: "
                    + ", ".join(name(r["driver_number"]) for r in dnfs
                                if not ver or r["driver_number"] != ver["driver_number"])
                    + ". Zero points weekends are where title fights quietly bleed.",
        },
        {
            "type": "moment", "lap": best_lap.get("lap_number"),
            "kicker": f"Lap {best_lap.get('lap_number')} · Fastest lap",
            "title": f"{name(best_lap['driver_number'])}: {best_lap['lap_duration']:.3f}s",
            "text": f"The kid who started from pole answered his critics with the fastest "
                    f"lap of the day, {best_lap['lap_duration']:.3f}s around Silverstone "
                    f"in a {team(best_lap['driver_number'])}. Keep his name handy.",
        },
        {
            "type": "moment", "lap": 48, "kicker": "Lap 48 of 52 · Safety Car",
            "title": "Every gap on track, erased",
            "text": "Four laps from home, the Safety Car wiped out every second anyone "
                    "had built all afternoon. It pulled in on lap 51... and came "
                    "straight back out again. The race finished with the field packed "
                    "nose to tail and Sainz under investigation for a Safety Car "
                    "infringement. Silverstone got its money's worth.",
        },
        {
            "type": "moment", "lap": 52, "kicker": "Lap 52 · Chequered flag",
            "title": f"{name(winner['driver_number'])} wins it",
            "text": f"{name(winner['driver_number'])} brings his "
                    f"{team(winner['driver_number'])} home first, ahead of "
                    f"{name(second['driver_number'])}. And P3, in front of his own "
                    f"grandstand, at home: {name(third['driver_number'])}. "
                    "Listen to that crowd.",
        },
        {
            "type": "share", "lap": 52, "kicker": "Silverstone, one line",
            "title": "Won on the lap nobody was watching the clock",
            "text": "Race rating: coming with v1's spoiler-free formula.",
        },
    ]

    # the car travels the race in order: moments AND predictions sorted by
    # their lap anchor, cover pinned first, share card pinned last
    head = [c for c in cards if c["type"] == "cover"]
    tail = [c for c in cards if c["type"] == "share"]
    body = sorted((c for c in cards if c["type"] in ("moment", "prediction")),
                  key=lambda c: c.get("lap") or 0)
    cards = head + body + tail

    # full driver details for the light result poster (R1 in the moodboard)
    def drv(num: int) -> dict:
        d = drivers.get(num, {})
        return {"number": num, "first": d.get("first_name", ""),
                "last": d.get("last_name", ""), "team": d.get("team_name", ""),
                "colour": d.get("team_colour", ""),
                "headshot": d.get("headshot_url", "")}

    result = {
        "date": "05 JUL 2026",
        "podium": [{"pos": i + 1, **drv(r["driver_number"])}
                   for i, r in enumerate([winner, second, third])],
        "fastest": {"time": round(best_lap["lap_duration"], 3),
                    **drv(best_lap["driver_number"])},
    }

    story = {
        "gp": "British Grand Prix 2026", "session": "Race",
        "circuit": "Silverstone", "laps": TOTAL_LAPS,
        "generated": "fase1_story v1", "result": result, "cards": cards,
    }

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "race_story.json").write_text(
        json.dumps(story, ensure_ascii=False, indent=2), encoding="utf-8")
    PREVIEW.mkdir(exist_ok=True)
    (PREVIEW / "story_data.js").write_text(
        "window.STORY = " + json.dumps(story, ensure_ascii=False) + ";",
        encoding="utf-8")
    print(f"[OK] {len(cards)} cards -> race_story.json (lap-anchored, English)")


if __name__ == "__main__":
    main()
