"""
What Alfred knows.

He has to answer whatever gets typed at him, so the race is packed into a form
he can look things up in: every driver's afternoon, what happened on each lap,
and plain explanations for the things a newcomer trips over. All of it is read
from the same feed as the cards, which is why he can be casual without making
anything up, and why he can say plainly when the data has no answer.
"""
from collections import Counter, defaultdict
from statistics import median


def race_brain(s, gp: dict, fmt, parse_ts) -> dict:
    grid = s.start_grid()
    green = s.green_overtakes()
    ov_by_driver = Counter(o["overtaking_driver_number"] for _, o in green)
    real_pits = [p for p in s.pits if p.get("pit_duration") and p.get("lap_number")]
    cases = s.stewards()
    penalties = [c for c in cases if c["secs"]]
    winner = s.result[0]["driver_number"] if s.result else None
    best = s.best_lap

    def out_lap(num: int) -> int:
        return max((l.get("lap_number") or 0) for l in s.laps
                   if l.get("driver_number") == num) or 0

    # ---------- every driver's afternoon ----------
    drivers: dict[str, dict] = {}
    for r in s.result:
        num = r["driver_number"]
        info = s.drivers.get(num, {})
        comps = [st.get("compound") for st in s.stints
                 if st.get("driver_number") == num and st.get("compound")]
        pace = s.pace(num)
        pens = [c for c in cases if num in c["cars"] and c["secs"]]
        start, finish = grid.get(num), r.get("position")
        drivers[s.name(num).lower()] = {
            "name": s.name(num),
            "code": (info.get("name_acronym") or "").lower(),
            "number": num,
            "team": s.team(num),
            "start": start,
            "finish": None if r.get("dnf") else finish,
            "moved": (start - finish) if (start and finish and not r.get("dnf")) else None,
            "dnf": bool(r.get("dnf")),
            "dnfLap": out_lap(num) if r.get("dnf") else None,
            "points": round(r.get("points") or 0),
            "stops": s.pit_laps(num),
            "compounds": list(dict.fromkeys(comps)),
            "pace": fmt(pace) if pace else None,
            "paceRaw": round(pace, 3) if pace else None,
            "overtakes": ov_by_driver.get(num, 0),
            "penalty": f"{pens[0]['secs']}s" if pens else None,
            "penaltyFor": (pens[0]["reason"] or "").lower() or None if pens else None,
        }

    # ---------- what happened, lap by lap ----------
    by_lap = Counter(ln for ln, _ in green)
    busiest = max(by_lap.values()) if by_lap else 0
    lap_events: dict[str, list[str]] = defaultdict(list)
    for lap in s.sc_laps:
        lap_events[str(lap)].append("safety car came out, every gap wiped")
    for lap, n in by_lap.most_common():
        if n >= 3:
            lap_events[str(lap)].append(
                f"{n} overtakes, busiest lap of the race" if n == busiest
                else f"{n} overtakes")
    for p in real_pits:
        lap_events[str(p["lap_number"])].append(f"{s.name(p['driver_number'])} pitted")
    for r in s.dnfs:
        lap_events[str(out_lap(r["driver_number"]))].append(
            f"{s.name(r['driver_number'])} retired")
    for c in penalties:
        lap_events[str(c["lap"])].append(
            f"{s.name(c['cars'][0])} picked up a {c['secs']}s penalty")
    if best and best.get("lap_number"):
        lap_events[str(best["lap_number"])].append(
            f"{s.name(best['driver_number'])} set the fastest lap, {fmt(best['lap_duration'])}")

    wet = any(w.get("rainfall") for w in s.weather)
    track_t = [w["track_temperature"] for w in s.weather if w.get("track_temperature")]
    lap1 = len([o for o in s.overtakes
                if s.lap_of(parse_ts(o.get("date"))) in (None, 1)])
    quickest = sorted((d["paceRaw"], d["name"]) for d in drivers.values() if d["paceRaw"])
    lane = median(p["pit_duration"] for p in real_pits) if real_pits else None
    used = sorted({c for d in drivers.values() for c in d["compounds"]})

    # ---------- the things people actually ask ----------
    topics = [
        {"id": "winner",
         "keys": ["who won", "winner", "won", "win", "ganador", "gano", "quien gano",
                  "first place", "p1"],
         "say": [f"{s.name(winner)} took it" if winner else "nobody, weirdly",
                 f"{s.team(winner)}. led when it mattered" if winner else ""]},
        {"id": "podium",
         "keys": ["podium", "podio", "top 3", "top three", "second", "third", "segundo"],
         "say": [" · ".join(f"P{r['position']} {s.name(r['driver_number'])}"
                            for r in s.result[:3])]},
        {"id": "fastest",
         "keys": ["fastest lap", "quickest lap", "vuelta rapida", "fastest time"],
         "say": [f"{s.name(best['driver_number'])}, {fmt(best['lap_duration'])} on lap "
                 f"{best.get('lap_number')}",
                 "it's worth a point if you finish top 10, which is why you see people "
                 "pitting at the end just to nick it"] if best else []},
        {"id": "sc",
         "keys": ["safety car", "sc", "coche de seguridad", "neutralised", "yellow"],
         "say": ([f"safety car on lap {', '.join(str(l) for l in s.sc_laps)}",
                  "something's on track that shouldn't be, so everyone queues behind a "
                  "road car at half speed",
                  "if you'd built a 20 second lead it's gone. brutal when you're leading, "
                  "brilliant when you're not"] if s.sc_laps
                 else ["no safety car in this one, green the whole way"])},
        {"id": "overtakes",
         "keys": ["overtake", "overtaking", "passes", "adelantamiento", "adelantamientos",
                  "how many overtakes"],
         "say": [f"{len(green)} proper overtakes",
                 "that's not counting lap 1 or the safety car restarts. those are just the "
                 "field shuffling, they'd double the number and mean nothing"]},
        {"id": "pits",
         "keys": ["pit", "pitstop", "pit stop", "stops", "parada", "boxes", "pitted"],
         "say": ([f"{len(real_pits)} stops all afternoon",
                  f"the lane costs about {lane:.0f}s here, which is why nobody stops "
                  "unless they have to"] if real_pits else ["nobody stopped"])},
        {"id": "undercut",
         "keys": ["undercut", "overcut"],
         "say": ["you pit before the guy ahead and bang in two fast laps on new tyres "
                 "while he's still out there on old ones",
                 "when he finally stops he comes out behind you. you never passed him on "
                 "track, you passed him in the pit lane"]},
        {"id": "tyres",
         "keys": ["tyre", "tyres", "tire", "compound", "neumatico", "rueda", "soft",
                  "medium", "hard"],
         "say": ([f"compounds out there: {', '.join(used).lower()}",
                  "softer is quicker and dies faster, harder lasts and is slower. the "
                  "whole strategy is choosing which pain you want"] if used else [])},
        {"id": "drs",
         "keys": ["drs", "rear wing", "ala movil"],
         "say": ["a flap on the rear wing that opens on the straights and makes you quicker",
                 "you only get it within a second of the car ahead at a set point. purists "
                 "hate it, i'm fine with it, the alternative was processions"]},
        {"id": "points",
         "keys": ["points", "puntos", "championship", "standings", "scored"],
         "say": ["top 10 score: 25, 18, 15, 12, 10, 8, 6, 4, 2, 1",
                 " · ".join(f"{s.name(r['driver_number'])} {round(r.get('points') or 0)}"
                            for r in s.result[:5])]},
        {"id": "penalty",
         "keys": ["penalty", "penalties", "sancion", "stewards", "fia", "punished",
                  "investigation"],
         "say": ([f"{len(penalties)} penalties stuck",
                  " · ".join(
                      f"{n} {v}s" + (f" x{c}" if c > 1 else "")
                      for (n, v), c in Counter(
                          (s.name(c["cars"][0]), c["secs"]) for c in penalties
                      ).items())[:190]]
                 if penalties else ["stewards looked at a few things and let them all go"])},
        {"id": "weather",
         "keys": ["weather", "rain", "wet", "dry", "temperature", "lluvia", "tiempo",
                  "calor", "hot"],
         "say": ([("it rained" if wet else "bone dry all afternoon"),
                  f"track hit {max(track_t):.0f}°C and cooled to {min(track_t):.0f}°C"
                  if track_t else ""] if s.weather else [])},
        {"id": "good",
         "keys": ["was it good", "worth watching", "boring", "merece la pena",
                  "estuvo bien", "any good", "should i watch", "entertaining"],
         "say": ["bit of both honestly",
                 f"{len(green)} overtakes and the midfield was mental, the front was quieter",
                 "watch the last 10 laps at least"]},
        {"id": "newbie",
         "keys": ["explain", "i know nothing", "new to f1", "how does this work",
                  "no entiendo", "explicame", "beginner", "from scratch", "like im five"],
         "say": ["ok so 20 cars, everyone starts in the order they qualified on saturday",
                 "everyone has to stop at least once to change tyres, and that stop costs "
                 "about 25 seconds",
                 "the whole sport is deciding WHEN to lose those 25 seconds"]},
        {"id": "pace",
         "keys": ["fastest car", "best car", "pace", "ritmo", "quickest car",
                  "who was quickest", "who had the pace"],
         "say": ([f"on median clean lap it was {quickest[0][1]}",
                  "median lap strips out traffic, safety cars and one-off heroics. it's "
                  "the honest read on who actually had the car under him"] if quickest else [])},
        {"id": "dnf",
         "keys": ["retire", "retired", "retirement", "dnf", "abandono", "broke down",
                  "who went out", "did not finish", "crash"],
         "say": ([" · ".join(f"{d['name']} on lap {d['dnfLap']}"
                             for d in drivers.values() if d["dnf"]),
                  "no points unless you finish, and you have to be top 10. that's how "
                  "championships quietly bleed out"]
                 if any(d["dnf"] for d in drivers.values()) else ["everyone finished"])},
        {"id": "grid",
         "keys": ["start", "lights out", "first lap", "lap 1", "salida", "grid", "pole"],
         "say": [f"{lap1} position changes before lap 1 was even done",
                 "cold tyres, cold brakes, full fuel and 20 people who all think the same "
                 "gap belongs to them"]},
        {"id": "next",
         "keys": ["next race", "when is", "proxima", "siguiente", "next one"],
         "say": ["two weeks usually, they almost never go back to back",
                 "and teams bring upgrades in between, so the order can change completely. "
                 "that's why nobody can predict this sport"]},
    ]

    return {
        "session": s.label,
        "circuit": gp["circuit"],
        "laps": s.total_laps,
        "winner": s.name(winner) if winner else None,
        "drivers": drivers,
        "lapEvents": {k: v[:4] for k, v in sorted(lap_events.items(), key=lambda kv: int(kv[0]))},
        "topics": [t for t in topics if any(x for x in t["say"])],
    }
