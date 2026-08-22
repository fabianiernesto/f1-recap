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


def blind_rounds(s, fmt) -> list[dict]:
    if not s.result:
        return []

    grid = s.start_grid()
    green = s.green_overtakes()
    ov = Counter(o["overtaking_driver_number"] for _, o in green)
    cases = s.stewards()
    best = s.best_lap
    fastest_num = best["driver_number"] if best else None
    stop_counts = Counter(p["driver_number"] for p in s.pits if p.get("pit_duration"))
    typical = Counter(stop_counts.values()).most_common(1)[0][0] if stop_counts else 0
    most_passes = max(ov.values()) if ov else 0

    # who led, carried forward, because the feed only records changes
    pos_events: dict[int, list[tuple[int, int]]] = {}
    for pt in sorted(s.position, key=lambda x: x.get("date") or ""):
        from build_weekend import parse_ts  # same clock as everything else
        ln = s.lap_of(parse_ts(pt.get("date")))
        if ln and pt.get("position"):
            pos_events.setdefault(pt["driver_number"], []).append((ln, pt["position"]))

    def led(num: int) -> int:
        ev = pos_events.get(num, [])
        if not ev:
            return 0
        total, i, pos = 0, 0, None
        for lap in range(1, (s.total_laps or 0) + 1):
            while i < len(ev) and ev[i][0] <= lap:
                pos = ev[i][1]
                i += 1
            if pos == 1:
                total += 1
        return total

    def out_lap(num: int) -> int:
        return max((l.get("lap_number") or 0) for l in s.laps
                   if l.get("driver_number") == num) or 0

    # the superlatives have to belong to exactly one driver, or they are lies
    # on every sheet but one
    swing = {}
    for r in s.result:
        st, fi = grid.get(r["driver_number"]), r.get("position")
        swing[r["driver_number"]] = (st - fi) if (st and fi and not r.get("dnf")) else 0
    best_climb = max(swing.values(), default=0)
    worst_fall = min(swing.values(), default=0)

    candidates: list[tuple[int, dict]] = []
    for r in s.result:
        num = r["driver_number"]
        start, finish = grid.get(num), r.get("position")
        stops = s.pit_laps(num)
        comps = list(dict.fromkeys(
            st.get("compound") for st in s.stints
            if st.get("driver_number") == num and st.get("compound")))
        pace = s.pace(num)
        pens = [c for c in cases if num in c["cars"] and c["secs"]]
        moved = (start - finish) if (start and finish and not r.get("dnf")) else 0
        laps_led = led(num)

        # what makes this afternoon worth asking about, and the line that
        # explains the answer once it is given
        tell, weight = None, 0
        if r.get("dnf"):
            tell, weight = "the car gave up on him, and the sheet just stops", 5
        elif finish == 1:
            tell, weight = "led most of it and never gave anyone a way past", 5
        elif moved <= -6:
            tell, weight = (
                ("the afternoon that got away: nobody lost more places than he did"
                 if moved == worst_fall else
                 f"started near the front and threw {abs(moved)} places away"), 6)
        elif moved >= 6:
            tell, weight = (
                ("the biggest climb of the afternoon, one pass at a time"
                 if moved == best_climb else
                 f"{moved} places gained the hard way, without a camera in sight"), 5)
        elif len(stops) > typical:
            tell, weight = ("more stops than anyone was planning. that is damage or "
                            "a gamble, never a strategy"), 4
        elif num == fastest_num:
            tell, weight = "the fastest lap of the race is his", 4
        elif pens:
            tell, weight = "the stewards spent more time on him than on anybody", 3
        elif ov.get(num, 0) == most_passes and most_passes:
            tell, weight = "more overtakes than anyone out there", 4

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
            rows.append(["Penalty", f"{pens[0]['secs']}s, {(pens[0]['reason'] or '').lower()}"])
        rows.append(["Finished",
                     f"retired, lap {out_lap(num)}" if r.get("dnf") else f"P{finish}"])

        candidates.append((weight, {
            "answer": s.name(num),
            "number": num,
            "rows": rows,
            "tell": tell,
        }))

    candidates.sort(key=lambda x: -x[0])
    picked = [c for _, c in candidates[:8]]

    # decoys come from nearby on the results sheet: a wrong answer has to be
    # believable or the round answers itself
    order = [r["driver_number"] for r in s.result]
    for rnd in picked:
        i = order.index(rnd["number"])
        near = [n for n in order[max(0, i - 3): i + 4] if n != rnd["number"]]
        decoys = [s.name(n) for n in near[:3]]
        while len(decoys) < 3:
            extra = s.name(order[len(decoys) % len(order)])
            if extra not in decoys and extra != rnd["answer"]:
                decoys.append(extra)
        rnd["options"] = sorted([rnd["answer"], *decoys])
        del rnd["number"]

    return picked
