"""
The pit wall.

You take one driver's afternoon and make the calls his garage made. Every
option carries a number, and every number is measured out of this race rather
than assumed: what a stop cost here, how fast each compound went off here,
where the field actually finished.

The model is the one piece of race strategy simple enough to be honest about.
A stint has a cost in seconds. A tyre is a bit slower on its first lap than
the driver's average and a lot slower on its twentieth, so for a window
between two stops, boxing on lap X costs

    sum over the old tyre's remaining laps + sum over the new tyre's laps

and the pit lane itself cancels, because every candidate pays it once. Stop
too early and the second stint is long and worn; stop too late and the first
one is. Somewhere between is the lap the strategist was paid to find, and the
game is whether you find it too. Often he did: several of these calls come out
within a second of the best lap available, which is the correct answer and
worth saying out loud rather than tuning away.

Two things it deliberately will not do.

It does not run the race forward. Each call is scored across the laps it
touches and no further, because a model claiming to know how the whole
afternoon would have gone is writing fiction with a decimal point on it.

And it does not score the safety car. A stop under one is the biggest call in
racing, and it is unmeasurable here: at Silverstone the car came out mid-lap
and thirteen of the twenty stopped inside two laps, so there is barely a
field left to measure a loss against and the reference lap swings from 99 to
126 to 113 seconds on consecutive laps. The saving is real and it is in track
position rather than in seconds. A number here would be noise wearing a
decimal point, so there is no number and no call.
"""
from collections import defaultdict
from statistics import median

from photos import photo

# a stint has to run this long before its lap times say anything about wear
MIN_STINT = 5
# and a compound needs this many clean laps across the field before its
# degradation is a measurement rather than a guess
MIN_SAMPLES = 40
# offsets from the real lap that alternatives are offered at. More than will
# fit, on purpose: a stop on lap 47 of 52 has no "twelve laps later", so the
# ones that do not fit inside the window are dropped and the call is asked
# with whatever is left.
SPREAD = (-12, -8, -4, 4, 8, 12)


def _lap_times(s) -> dict[int, dict[int, float]]:
    """Every lap anybody was timed on, pit laps included.

    Session.timed_laps drops the out-lap, which is right for judging pace and
    wrong here: the out-lap is most of what a stop costs.
    """
    out: dict[int, dict[int, float]] = defaultdict(dict)
    for l in s.laps:
        if l.get("lap_duration") and l.get("lap_number"):
            out[l["driver_number"]][l["lap_number"]] = l["lap_duration"]
    return out


def race_economics(s) -> dict | None:
    """What a stop cost and how each compound behaved, in this race."""
    raw = _lap_times(s)
    sc = set(s.dead_laps)   # safety car, VSC and red flag laps

    # who was in the lane on which lap, so the cars still racing can be asked
    # what a normal lap looked like at that moment
    stopping: dict[int, set[int]] = defaultdict(set)
    for p in s.pits:
        if p.get("lap_number"):
            stopping[p["lap_number"]].add(p["driver_number"])
            stopping[p["lap_number"] + 1].add(p["driver_number"])

    def running_pace(lap: int) -> float | None:
        """The lap the cars who stayed out were doing.

        Measuring a stop against the driver's own median says a stop under a
        safety car costs seventy seconds, which is true and useless: every car
        on the track was doing seventy-second laps. What a stop costs is what
        it costs against the cars that did not take one.
        """
        times = [t[lap] for n, t in raw.items()
                 if lap in t and n not in stopping[lap]]
        return median(times) if len(times) >= 5 else None

    green = []
    for p in s.real_pits:
        num, ln = p.get("driver_number"), p.get("lap_number")
        if ln in sc or ln + 1 in sc:
            continue
        inlap, outlap = raw[num].get(ln), raw[num].get(ln + 1)
        ref_in, ref_out = running_pace(ln), running_pace(ln + 1)
        if inlap and outlap and ref_in and ref_out:
            green.append((inlap - ref_in) + (outlap - ref_out))

    if len(green) < 5:
        return None

    # every clean lap of every stint long enough to say something: how old the
    # tyre was, how far into the race it was, and how far off that driver's own
    # median the lap came out
    pts: list[tuple[int, int, float, str]] = []
    for st in s.stints:
        num, comp = st.get("driver_number"), st.get("compound")
        first, last = st.get("lap_start"), st.get("lap_end")
        base = s.pace(num)
        if not (comp and first and last and base and last - first >= MIN_STINT):
            continue
        for ln in range(first + 1, last):      # no out-lap, no in-lap
            t = raw[num].get(ln)
            # traffic, a moment, a lift: not wear, and it would drag the line
            if t and t < base * 1.06:
                pts.append((ln - first + 1, ln, t - base, comp))

    if len(pts) < MIN_SAMPLES * 2:
        return None

    # A car gets quicker all afternoon as the fuel burns off and the track
    # rubbers in, at something like three or four hundredths a lap. Fit that
    # first and take it out, or it lands on whichever compound happened to be
    # bolted on late and the answer comes out backwards: without this step
    # Silverstone reads as a race where the hard tyre wore faster than the
    # medium, and the model then accuses a strategist who finished four tenths
    # off the win of throwing away nine seconds.
    n = len(pts)
    mx = sum(p[1] for p in pts) / n
    my = sum(p[2] for p in pts) / n
    den = sum((p[1] - mx) ** 2 for p in pts)
    trend = (sum((p[1] - mx) * (p[2] - my) for p in pts) / den) if den else 0.0

    by_compound: dict[str, list[tuple[int, float]]] = defaultdict(list)
    for age, lap, delta, comp in pts:
        by_compound[comp].append((age, delta - trend * lap))

    tyres: dict[str, dict[str, float]] = {}
    for comp, rows in by_compound.items():
        if len(rows) < MIN_SAMPLES:
            continue
        m = len(rows)
        ax = sum(x for x, _ in rows) / m
        ay = sum(y for _, y in rows) / m
        d2 = sum((x - ax) ** 2 for x, _ in rows)
        if not d2:
            continue
        # a tyre that gets quicker with age is a line fitted through noise,
        # not a finding. Floored rather than dropped, so it still plays.
        slope = max(sum((x - ax) * (y - ay) for x, y in rows) / d2, 0.005)
        tyres[comp] = {"deg": round(slope, 4), "base": round(ay - slope * ax, 3),
                       "laps": m}

    if not tyres:
        return None

    return {
        "pitLoss": round(median(green), 1),
        "fuelTrend": round(trend, 4),
        "tyres": tyres,
        "typicalDeg": round(median(t["deg"] for t in tyres.values()), 4),
    }


def _tyre(econ: dict, comp: str | None) -> dict[str, float]:
    return econ["tyres"].get(comp or "", {"deg": econ["typicalDeg"], "base": 0.0})


def _stint_cost(econ: dict, comp: str | None, laps: int) -> float:
    """Seconds a stint of `laps` costs against a car on an average lap.

    Linear wear, so the sum is the triangle: the first lap costs the compound's
    own offset and each one after adds the degradation again.
    """
    if laps <= 0:
        return 0.0
    t = _tyre(econ, comp)
    return t["base"] * laps + t["deg"] * laps * (laps + 1) / 2


def _gap_ladder(s) -> list[dict]:
    """The finish, in seconds behind the winner. Lapped cars end it."""
    out = []
    for r in s.result:
        pos, num = r.get("position"), r["driver_number"]
        gap = r.get("gap_to_leader")
        if not pos or r.get("dnf"):
            continue
        if isinstance(gap, str):               # "+1 LAP" and everything past it
            break
        out.append({"pos": pos, "name": s.name(num),
                    "team": s.team(num), "gap": round(float(gap or 0), 3)})
    return out


def candidate_seats(s) -> list[dict]:
    """Whose afternoon is worth taking over, best first.

    The one with somebody close enough that a call decides it. A seat with
    twenty seconds of clear air in both directions is a seat where nothing
    done on the pit wall shows up at the flag: an honest race, and a dead game.

    Ranked rather than chosen, because tightness is only half of it. A seat is
    no use if its stops cannot be scored -- both compounds have to have been
    run far enough to be measured, and a stop taken under a safety car is not
    scored at all -- so the caller walks this list until one of them plays.
    """
    ladder = _gap_ladder(s)
    if len(ladder) < 4:
        return []

    seats = []
    for i, row in enumerate(ladder[:8]):
        num = next((r["driver_number"] for r in s.result
                    if r.get("position") == row["pos"]), None)
        stops = s.pit_laps(num) if num else []
        # one stop is enough. A one-stop race has exactly one "when" and one
        # "what", and Monza is a one-stop race for the entire field: asking
        # for two stops there meant asking for nobody.
        if not stops:
            continue
        ahead = row["gap"] - ladder[i - 1]["gap"] if i else None
        behind = ladder[i + 1]["gap"] - row["gap"] if i + 1 < len(ladder) else None
        margin = min([g for g in (ahead, behind) if g is not None] or [999])
        # tightest race first, and more stops breaks a tie: more stops is more
        # calls, and the calls are the game
        seats.append(((margin, -len(stops)),
                      {"number": num, "name": s.name(num), "team": s.team(num),
                       "pos": row["pos"], "stops": stops,
                       "margin": round(margin, 3)}))
    return [seat for _, seat in sorted(seats, key=lambda x: x[0])]


def _facts(s, num: int, lap: int, comp: str | None, age: int | None) -> list[list[str]]:
    order = s.order_at_lap(lap)
    mine = next((p for p, n in order if n == num), None)
    ahead = next((n for p, n in order if mine and p == mine - 1), None)
    behind = next((n for p, n in order if mine and p == mine + 1), None)
    gap = s.gap_at_lap(num, lap)
    rows = [["Running", f"P{mine}" if mine else "-"]]
    if comp and age:
        rows.append(["Tyre", f"{comp.lower()}, {age} laps old"])
    if ahead:
        rows.append(["Ahead", s.name(ahead) + (f", {gap:.1f}s up" if gap else "")])
    if behind:
        rows.append(["Behind", s.name(behind)])
    return rows


def _stop_call(s, econ, seat, i, stop, window, comp, nxt) -> dict | None:
    """When to box, scored across the whole window the stop sits inside."""
    w0, w1 = window
    if w1 - w0 < 10:
        return None

    # both stints have to be made of tyres this race ran far enough to
    # measure. Silverstone's soft went on for five laps behind a safety car
    # and nowhere else, so nothing honest can be said about a stint on it.
    if comp not in econ["tyres"] or nxt not in econ["tyres"]:
        return None

    def cost(x: int) -> float:
        return _stint_cost(econ, comp, x - w0) + _stint_cost(econ, nxt, w1 - x)

    laps = sorted({stop} | {stop + d for d in SPREAD
                            if w0 + 3 <= stop + d <= w1 - 3})
    if len(laps) < 3:
        return None
    scored = [(x, cost(x)) for x in laps]
    floor = min(c for _, c in scored)

    def label(x: int) -> str:
        d = x - stop
        if d == 0:
            return f"Box him now, lap {x}"
        return f"{abs(d)} lap{'s' if abs(d) > 1 else ''} {'earlier' if d < 0 else 'later'}"

    t_old, t_new = _tyre(econ, comp), _tyre(econ, nxt)
    options = [{
        "label": label(x),
        "lap": x,
        "lost": round(c - floor, 1),
        "real": x == stop,
        "note": (f"{x - w0} laps on the {(comp or 'first').lower()}s, then "
                 f"{w1 - x} on the {(nxt or 'next').lower()}s."),
    } for x, c in scored]

    age = stop - w0
    return {
        "lap": stop,
        "kicker": "The first stop" if i == 0 else f"Stop {i + 1}",
        "question": "When do you box him?",
        "facts": _facts(s, seat["number"], stop, comp, age),
        "options": options,
        "reading": (f"The {(comp or '').lower()}s lose "
                    f"{t_old['deg'] * 1000:.0f}ms a lap as they age, the "
                    f"{(nxt or '').lower()}s {t_new['deg'] * 1000:.0f}ms. The "
                    f"stint has to reach lap {w1} either way."),
    }


def _longest_stints(s) -> dict[str, int]:
    """The longest anybody ran on each compound. It bounds what can be asked."""
    out: dict[str, int] = {}
    for st in s.stints:
        c, a, b = st.get("compound"), st.get("lap_start"), st.get("lap_end")
        if c and a and b:
            out[c] = max(out.get(c, 0), b - a + 1)
    return out


def _compound_call(s, econ, seat, last_stop, total) -> dict | None:
    """What to bolt on for the run to the flag, when there is a choice."""
    left = total - last_stop
    if left < 8 or len(econ["tyres"]) < 2:
        return None
    real = next((st.get("compound") for st in s.stints
                 if st.get("driver_number") == seat["number"]
                 and (st.get("lap_start") or 0) > last_stop), None)
    if real not in econ["tyres"]:
        return None

    # a tyre nobody ran near this distance on is a fantasy option: a line
    # fitted to a six-lap stint says nothing about lap thirty
    longest = _longest_stints(s)
    runnable = [c for c in econ["tyres"] if longest.get(c, 0) >= left * 0.7]
    if real not in runnable or len(runnable) < 2:
        return None
    scored = [(c, _stint_cost(econ, c, left)) for c in runnable]
    floor = min(c for _, c in scored)
    comp, age = s.tyre_at_lap(seat["number"], last_stop)
    return {
        "lap": last_stop,
        "kicker": "The last set",
        "question": f"{left} laps to the flag. What goes on the car?",
        "facts": _facts(s, seat["number"], last_stop, comp, age),
        "options": [{
            "label": c.title(),
            "lap": last_stop,
            "lost": round(v - floor, 1),
            "real": c == real,
            "note": (f"{econ['tyres'][c]['deg'] * 1000:.0f}ms a lap of wear, "
                     f"over {left} laps."),
        } for c, v in sorted(scored, key=lambda x: x[1])],
        "reading": "A softer tyre is quicker on lap one and slower on lap "
                   "twenty. How many laps are left decides which half matters.",
    }


def build_calls(s, seat: dict, econ: dict) -> list[dict]:
    num, stops = seat["number"], seat["stops"]
    total = s.total_laps or 0
    # see the note at the top of the file: a stop under a safety car is the
    # biggest call in racing and the one this cannot put a number on
    sc = {l for lap in s.sc_laps for l in (lap - 1, lap, lap + 1)}
    stints = sorted([st for st in s.stints if st.get("driver_number") == num
                     and st.get("lap_start")], key=lambda x: x["lap_start"])
    calls = []

    for i, stop in enumerate(stops):
        if stop in sc:
            continue
        comp, _ = s.tyre_at_lap(num, stop)
        nxt = next((st.get("compound") for st in stints
                    if (st.get("lap_start") or 0) > stop), None)
        # the window opens where this set went on, which the stints know and
        # the stop list does not: a set fitted under a red flag is a stint
        # boundary without a pit stop
        this_stint = next((st for st in stints
                           if (st.get("lap_start") or 0) <= stop <= (st.get("lap_end") or 0)),
                          None)
        w0 = (this_stint.get("lap_start") if this_stint else None) or (stops[i - 1] if i else 1)
        w1 = stops[i + 1] if i + 1 < len(stops) else total
        call = _stop_call(s, econ, seat, i, stop, (w0, w1), comp, nxt)
        if call:
            calls.append(call)

    if stops and stops[-1] not in sc:
        last = _compound_call(s, econ, seat, stops[-1], total)
        if last:
            calls.append(last)

    calls.sort(key=lambda c: (c["lap"], c["kicker"] == "The last set"))
    return calls


# how far the real strategist is allowed to come out from the model's own
# best lap before the model is the one that gets disbelieved
TRUST = 3.0


def _model_agrees(calls: list[dict]) -> bool:
    """Is the tyre model worth showing to anybody?

    The strategist is the ground truth here, not the regression. A garage that
    finished a tenth off the car in front did not leave nine seconds on the
    table, so a model that says it did has learned something about traffic or
    fuel or a driver managing a stint, and nothing about tyres. When the real
    call lands miles from the model's optimum on any decision, the whole race
    is dropped rather than shown with a confident wrong number on it.
    """
    for c in calls:
        real = next((o for o in c["options"] if o.get("real")), None)
        if real and real["lost"] > TRUST:
            return False
    return True


def pitwall_race(s, fmt) -> dict | None:
    econ = race_economics(s)
    if not econ:
        return None
    seat = calls = None
    for candidate in candidate_seats(s):
        built = build_calls(s, candidate, econ)
        if len(built) >= 2 and _model_agrees(built):
            seat, calls = candidate, built
            break
    if not seat:
        return None

    info = s.drivers.get(seat["number"], {})
    return {
        "session": "Race",
        "laps": s.total_laps,
        "driver": {
            "name": seat["name"], "number": seat["number"], "team": seat["team"],
            "colour": info.get("team_colour", ""),
            "headshot": photo(info),
            "start": s.start_grid().get(seat["number"]),
            "finish": seat["pos"],
            "margin": seat["margin"],
        },
        "economics": econ,
        "calls": calls,
        "ladder": _gap_ladder(s),
    }
