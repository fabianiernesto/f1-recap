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
    real_pits = s.real_pits
    penalties = s.penalties()
    winner = s.result[0]["driver_number"] if s.result else None
    best = s.best_lap
    sprint = s.label.startswith("Sprint")
    event = "sprint" if sprint else "race"
    scs = s.sc_periods

    def plural(n, w, many=None):
        return f"{n} {w if n == 1 else (many or w + 's')}"

    # where each driver was, lap by lap, so a collapse can be pinned to a lap
    pos_by_driver: dict[int, list[tuple[int, int]]] = defaultdict(list)
    for pt in sorted(s.position, key=lambda x: x.get('date') or ''):
        ln = s.lap_of(parse_ts(pt.get('date')))
        if ln and pt.get('position'):
            pos_by_driver[pt['driver_number']].append((ln, pt['position']))

    def swings(num: int) -> list[dict]:
        out, prev = [], grid.get(num)
        for ln, pos in pos_by_driver.get(num, []):
            if prev is not None and pos - prev >= 2:
                out.append({'lap': ln, 'lost': pos - prev})
            prev = pos
        out.sort(key=lambda x: -x['lost'])
        return out[:3]

    # the position feed only records changes: carry the last known position
    # forward from the grid, and stop on the last lap the car completed
    def led_laps(num: int) -> int:
        events = pos_by_driver.get(num, [])
        done = s.completed_laps(num)
        last = min(s.total_laps or 0, done if done is not None else s.total_laps or 0)
        led, i, pos = 0, 0, grid.get(num)
        for lap in range(1, last + 1):
            while i < len(events) and events[i][0] <= lap:
                pos = events[i][1]
                i += 1
            if pos == 1:
                led += 1
        return led

    stop_counts = Counter(p['driver_number'] for p in real_pits)
    typical = Counter(stop_counts.values()).most_common(1)[0][0] if stop_counts else 0
    winner_pace = s.pace(winner) if winner else None
    green_lane = [p["pit_duration"] for p in s.timed_stops
                  if p["lap_number"] not in s.dead_laps and not s.neutralised(p["ts"])]
    lane = median(green_lane) if len(green_lane) >= 3 else None

    # ---------- every driver's race ----------
    drivers: dict[str, dict] = {}
    for r in s.result:
        num = r["driver_number"]
        info = s.drivers.get(num, {})
        comps = [st.get("compound") for st in s.stints
                 if st.get("driver_number") == num and st.get("compound")
                 and st.get("compound") != "UNKNOWN"]
        pace = s.pace(num)
        pens = [c for c in penalties if c["car"] == num]
        start, finish = grid.get(num), s.finish_pos(num)
        retired = bool(r.get("dnf")) and not r.get("dns")
        drivers[s.name(num).lower()] = {
            "name": s.name(num),
            "code": (info.get("name_acronym") or "").lower(),
            "number": num,
            "team": s.team(num),
            "start": start,
            "finish": finish,
            "moved": (start - finish) if (start and finish) else None,
            "dnf": retired,
            "dns": bool(r.get("dns")),
            "dnfLap": s.stop_lap(num) if retired else None,
            "points": round(r.get("points") or 0),
            "stops": s.pit_laps(num),
            "compounds": list(dict.fromkeys(comps)),
            "pace": fmt(pace) if pace else None,
            "paceRaw": round(pace, 3) if pace else None,
            "overtakes": ov_by_driver.get(num, 0),
            "penalty": pens[0]["kind"] if pens else None,
            "penaltyFor": (pens[0]["reason"] or None) if pens else None,
            "led": led_laps(num),
            "swings": swings(num),
            "fastestLap": bool(best and best.get("driver_number") == num),
            "gap": (round(r["gap_to_leader"], 3)
                    if isinstance(r.get("gap_to_leader"), (int, float)) else None),
            "vsWinner": (round(pace - winner_pace, 3)
                         if pace and winner_pace and num != winner else None),
            "extraStops": (len(s.pit_laps(num)) - typical) if typical else 0,
        }

    # ---------- what happened, lap by lap ----------
    by_lap = Counter(ln for ln, _ in green)
    busiest = max(by_lap.values()) if by_lap else 0
    lap_events: dict[str, list[str]] = defaultdict(list)
    for p in scs:
        if p["lap"]:
            lap_events[str(p["lap"])].append("safety car came out, every gap wiped")
    for a, b in s.vsc_periods:
        ln = s.lap_of(a)
        if ln:
            lap_events[str(ln)].append("virtual safety car, gaps frozen")
    for ln in s.red_laps[:1]:
        lap_events[str(ln)].append(f"red flag, the {event} was stopped")
    for lap, n in by_lap.most_common():
        if n >= 3:
            lap_events[str(lap)].append(
                f"{n} passes on track, busiest lap of the {event}" if n == busiest
                else f"{n} passes on track")
    for p in real_pits:
        lap_events[str(p["lap_number"])].append(f"{s.name(p['driver_number'])} pitted")
    for r in s.dnfs:
        lap_events[str(s.stop_lap(r["driver_number"]))].append(
            f"{s.name(r['driver_number'])} retired")
    for c in penalties:
        if c["lap"]:
            lap_events[str(c["lap"])].append(
                f"{s.name(c['car'])} got " + (f"a {c['kind']} penalty" if c["secs"] else c["kind"]))
    if best and best.get("lap_number"):
        lap_events[str(best["lap_number"])].append(
            f"{s.name(best['driver_number'])} set the fastest lap, {fmt(best['lap_duration'])}")

    a0, b0 = s.race_start_ts, s.race_end_ts
    wx = [w for w in s.weather if a0 and b0 and parse_ts(w.get("date"))
          and a0 <= parse_ts(w["date"]) <= b0]
    wet = any(w.get("rainfall") for w in wx)
    track_t = [w["track_temperature"] for w in sorted(wx, key=lambda w: w.get("date") or "")
               if (w.get("track_temperature") or 0) > 0]
    lap1 = len(s.lap1_passes())
    quickest = sorted((d["paceRaw"], d["name"]) for d in drivers.values() if d["paceRaw"])
    used = sorted({c for d in drivers.values() for c in d["compounds"]})
    w_led = led_laps(winner) if winner else 0

    # ---------- the things people actually ask ----------
    topics = [
        {"id": "winner",
         "keys": ["who won", "winner", "won", "win", "ganador", "gano", "quien gano",
                  "first place", "p1"],
         "say": [f"{s.name(winner)} took it" if winner else "nobody, weirdly",
                 (f"{s.team(winner)}. started P{grid.get(winner)}"
                  + (f", led {w_led} of {s.total_laps} laps" if w_led else ""))
                 if winner and grid.get(winner) else s.team(winner) if winner else ""]},
        {"id": "podium",
         "keys": ["podium", "podio", "top 3", "top three", "second", "third", "segundo"],
         "say": [" · ".join(f"P{r['position']} {s.name(r['driver_number'])}"
                            for r in s.result[:3])]},
        {"id": "fastest",
         "keys": ["fastest lap", "quickest lap", "vuelta rapida", "fastest time"],
         "say": [f"{s.name(best['driver_number'])}, {fmt(best['lap_duration'])} on lap "
                 f"{best.get('lap_number')}",
                 "no points for it anymore, that went after 2024. bragging rights only"]
                if best else []},
        {"id": "sc",
         "keys": ["safety car", "sc", "coche de seguridad", "neutralised", "yellow"],
         "say": ([f"safety car on lap {', '.join(str(p['lap']) for p in scs if p['lap'])}",
                  "something's on track that shouldn't be, so everyone queues behind a "
                  "road car at reduced speed",
                  "if you'd built a big lead it's gone. brutal when you're leading, "
                  "brilliant when you're not"] if scs
                 else [f"no proper safety car, just a virtual one on lap "
                       f"{s.vsc_laps[0]}. gaps frozen, nobody bunched up"]
                 if s.vsc_laps
                 else [f"no safety car in this one"])},
        {"id": "overtakes",
         "keys": ["overtake", "overtaking", "passes", "adelantamiento", "adelantamientos",
                  "how many overtakes"],
         "say": [f"{plural(len(green), 'pass', 'passes')} on track after lap 1",
                 "pit lane swaps and anything behind the safety car don't count, they'd "
                 "inflate the number and mean nothing"]},
        {"id": "pits",
         "keys": ["pit", "pitstop", "pit stop", "stops", "parada", "boxes", "pitted"],
         "say": ([f"{plural(len(real_pits), 'stop')} in the whole {event}"]
                 + ([f"you spend about {lane:.0f}s in the pit lane here"] if lane else [])
                 if real_pits else ["nobody stopped"])},
        {"id": "undercut",
         "keys": ["undercut", "overcut"],
         "say": ["you pit before the guy ahead and do fast laps on new tyres "
                 "while he's still out there on old ones",
                 "if it works he comes out behind you after his stop. you never passed "
                 "him on track, you passed him in the pit lane"]},
        {"id": "tyres",
         "keys": ["tyre", "tyres", "tire", "compound", "neumatico", "rueda", "soft",
                  "medium", "hard"],
         "say": ([f"compounds out there: {', '.join(used).lower()}",
                  "softer is quicker and wears faster, harder lasts and is slower. the "
                  "whole strategy is choosing which pain you want"] if used else [])},
        {"id": "drs",
         "keys": ["drs", "rear wing", "ala movil"],
         "say": ["no drs anymore, the 2026 cars don't have it"]},
        {"id": "points",
         "keys": ["points", "puntos", "championship", "standings", "scored"],
         "say": [("top 8 score in a sprint: 8, 7, 6, 5, 4, 3, 2, 1" if sprint else
                  "top 10 score: 25, 18, 15, 12, 10, 8, 6, 4, 2, 1"),
                 " · ".join(f"{s.name(r['driver_number'])} {round(r.get('points') or 0)}"
                            for r in s.result[:5])]},
        {"id": "penalty",
         "keys": ["penalty", "penalties", "sancion", "stewards", "fia", "punished",
                  "investigation"],
         "say": ([plural(len(penalties), "penalty", "penalties") + " handed out",
                  " · ".join(f"{s.name(c['car'])} {c['kind']}" for c in penalties)[:190]]
                 if penalties else ["no penalties handed out"])},
        {"id": "weather",
         "keys": ["weather", "rain", "wet", "dry", "temperature", "lluvia", "tiempo",
                  "calor", "hot"],
         "say": ([("rain was recorded" if wet else "no rain recorded during it"),
                  f"track at {track_t[0]:.0f}°C at the start and {track_t[-1]:.0f}°C at the flag"]
                 if len(track_t) >= 2 else [])},
        {"id": "good",
         "keys": ["was it good", "worth watching", "boring", "merece la pena",
                  "estuvo bien", "any good", "should i watch", "entertaining"],
         "say": ["you tell me",
                 f"{plural(len(green), 'pass', 'passes')} on track, "
                 f"{plural(len(scs), 'safety car')} and {plural(len(s.dnfs), 'retirement')}"]},
        {"id": "newbie",
         "keys": ["explain", "i know nothing", "new to f1", "how does this work",
                  "no entiendo", "explicame", "beginner", "from scratch", "like im five"],
         "say": [f"ok so {s.starters} cars, lined up in the order they qualified",
                 "in a dry race everyone has to use two tyre types, so everyone stops at "
                 "least once" + (f", about {lane:.0f} seconds in the pit lane each time" if lane else ""),
                 "the whole sport is deciding WHEN to lose that time"]},
        {"id": "pace",
         "keys": ["fastest car", "best car", "pace", "ritmo", "quickest car",
                  "who was quickest", "who had the pace"],
         "say": ([f"on median racing lap it was {quickest[0][1]}",
                  "that leaves out lap 1, pit laps and anything behind the safety car. "
                  "the honest read on who had the car under him"] if quickest else [])},
        {"id": "dnf",
         "keys": ["retire", "retired", "retirement", "dnf", "abandono", "broke down",
                  "who went out", "did not finish", "crash"],
         "say": ([" · ".join(f"{d['name']} on lap {d['dnfLap']}"
                             for d in drivers.values() if d["dnf"]),
                  "the data says when they stopped, not why"]
                 if any(d["dnf"] for d in drivers.values()) else ["everyone who started finished"])},
        {"id": "grid",
         "keys": ["start", "lights out", "first lap", "lap 1", "salida", "grid", "pole"],
         "say": [f"{plural(lap1, 'place')} changed hands on track on lap 1",
                 "cold tyres, cold brakes, full fuel and everybody going for the same gap"]},
    ]

    return {
        "typicalStops": typical,
        "pitLoss": round(lane) if lane else None,
        "session": s.label,
        "circuit": gp["circuit"],
        "laps": s.total_laps,
        "winner": s.name(winner) if winner else None,
        "drivers": drivers,
        "lapEvents": {k: v[:4] for k, v in sorted(lap_events.items(), key=lambda kv: int(kv[0]))},
        "topics": [t for t in topics if any(x for x in t["say"])],
    }
