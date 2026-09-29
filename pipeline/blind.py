"""
The blind test.

A driver's afternoon, stripped of his name and his team, laid out as a sheet of
numbers: where he started, what he did with it, how many times he stopped, what
the stewards made of him. Guess who.

The point is not the guessing. It is that after five of these you can read a
timing sheet, which is the thing the sport never bothers to teach anybody.

Rounds are only built for drivers whose afternoon has a shape to it, because a
driver who started ninth, finished ninth and stopped twice is unguessable and
no fun to be asked about.
"""
from collections import Counter

from photos import photo


def blind_rounds(s, fmt) -> list[dict]:
    if not s.result:
        return []
    from build_weekend import parse_ts  # same clock as everything else

    grid = s.start_grid()
    green = s.green_overtakes()
    ov = Counter(o["overtaking_driver_number"] for _, o in green)
    penalties = s.penalties()
    best = s.best_lap
    fastest_num = best["driver_number"] if best else None
    stop_counts = Counter(p["driver_number"] for p in s.real_pits)
    typical = Counter(stop_counts.values()).most_common(1)[0][0] if stop_counts else 0
    most_passes = max(ov.values()) if ov else 0
    top_passers = [d for d, c in ov.items() if c == most_passes]
    event = "sprint" if s.label.startswith("Sprint") else "race"

    pos_events: dict[int, list[tuple[int, int]]] = {}
    for pt in sorted(s.position, key=lambda x: x.get("date") or ""):
        ln = s.lap_of(parse_ts(pt.get("date")))
        if ln and pt.get("position"):
            pos_events.setdefault(pt["driver_number"], []).append((ln, pt["position"]))

    def led(num: int) -> int:
        return sum(1 for d in s.leader_by_lap().values() if d == num)

    def _old_led(num: int) -> int:
        ev = pos_events.get(num, [])
        done = s.completed_laps(num)
        last = min(s.total_laps or 0, done if done is not None else s.total_laps or 0)
        total, i, pos = 0, 0, grid.get(num)
        for lap in range(1, last + 1):
            while i < len(ev) and ev[i][0] <= lap:
                pos = ev[i][1]
                i += 1
            if pos == 1:
                total += 1
        return total

    # the superlatives have to belong to exactly one driver, or they are lies
    # on every sheet but one
    swing = {}
    for r in s.result:
        st, fi = grid.get(r["driver_number"]), s.finish_pos(r["driver_number"])
        swing[r["driver_number"]] = (st - fi) if (st and fi) else 0
    best_climb = max(swing.values(), default=0)
    worst_fall = min(swing.values(), default=0)
    unique = lambda v: list(swing.values()).count(v) == 1

    candidates: list[tuple[int, dict]] = []
    for r in s.result:
        num = r["driver_number"]
        if r.get("dns"):
            continue
        start, finish = grid.get(num), s.finish_pos(num)
        retired = bool(r.get("dnf"))
        stops = s.pit_laps(num)
        comps = []
        for st in sorted((st for st in s.stints if st.get("driver_number") == num),
                         key=lambda st: st.get("lap_start") or 0):
            c = st.get("compound")
            # medium, hard, medium stays three sets: only back-to-back repeats fold
            if c and c != "UNKNOWN" and (not comps or comps[-1] != c):
                comps.append(c)
        pace = s.pace(num)
        pens = [c for c in penalties if c["car"] == num]
        moved = swing.get(num, 0)
        laps_led = led(num)

        tell, weight = None, 0
        if retired:
            tell, weight = f"his {event} ended on lap {s.stop_lap(num)}, and the sheet just stops", 5
        elif finish == 1:
            tell, weight = ((f"led {laps_led} of {s.total_laps} laps and took the win"
                             if laps_led else "took the win"), 5)
        elif moved <= -6:
            tell, weight = ((f"nobody lost more places than he did: {abs(moved)}"
                             if moved == worst_fall and unique(moved) else
                             f"started P{start} and lost {abs(moved)} places"), 6)
        elif moved >= 6:
            tell, weight = ((f"the biggest climb of the {event}, {moved} places"
                             if moved == best_climb and unique(moved) else
                             f"{moved} places gained from P{start}"), 5)
        elif typical and len(stops) > typical:
            tell, weight = f"{len(stops)} stops when most of the field made {typical}", 4
        elif num == fastest_num:
            tell, weight = f"the fastest lap of the {event} is his", 4
        elif pens:
            what = f"a {pens[0]['kind']} penalty" if pens[0]["secs"] else pens[0]["kind"]
            tell, weight = f"the stewards gave him {what}", 3
        elif most_passes and top_passers == [num]:
            tell, weight = "more passes on track than anyone out there", 4

        if not tell:
            continue

        rows = [["Started", f"P{start}" if start else "-"]]
        if laps_led:
            rows.append(["Laps led", str(laps_led)])
        rows += [
            ["Stops", str(len(stops)) + (f" (lap {', '.join(map(str, stops))})" if stops else "")],
            ["Tyres", " to ".join(c.lower() for c in comps) if comps else "-"],
            ["Median lap", fmt(pace) if pace else "-"],
            ["On-track passes", str(ov.get(num, 0))],
        ]
        if num == fastest_num and best:
            rows.append(["Fastest lap", fmt(best["lap_duration"])])
        if pens:
            rows.append(["Penalty", pens[0]["kind"] + (f", {pens[0]['reason']}" if pens[0]["reason"] else "")])
        rows.append(["Finished",
                     f"retired, lap {s.stop_lap(num)}" if retired else
                     f"P{finish}" if finish else "not classified"])

        candidates.append((weight, {
            "answer": s.name(num),
            "number": num,
            # carried for the reveal: the answer is in the payload anyway
            "team": s.team(num),
            "colour": (s.drivers.get(num, {}).get("team_colour") or "").lstrip("#"),
            "headshot": photo(s.drivers.get(num, {})),
            "rows": rows,
            "tell": tell,
        }))

    candidates.sort(key=lambda x: -x[0])
    picked = [c for _, c in candidates[:8]]

    # decoys come from nearby on the results sheet: a wrong answer has to be
    # believable or the round answers itself
    order = [r["driver_number"] for r in s.result if not r.get("dns")]
    for rnd in picked:
        i = order.index(rnd["number"])
        near = [n for n in order[max(0, i - 3): i + 4] if n != rnd["number"]]
        decoys = [s.name(n) for n in near[:3]]
        j = 0
        while len(decoys) < 3 and j < len(order):
            extra = s.name(order[j])
            if extra not in decoys and extra != rnd["answer"]:
                decoys.append(extra)
            j += 1
        rnd["options"] = sorted([rnd["answer"], *decoys])

    return picked
