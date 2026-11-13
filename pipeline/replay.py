"""
The race, replayable (since 23/10/2026): the engine under both activities.

Call the race and The ghost both play the race back on the real track. All
they need is when every car crossed the line at the end of every lap: between
two crossings a car is somewhere on the lap in proportion to the time, which
puts every dot where the real gaps say it was. A red flag is a stretch with
no crossings at all, and it is cut out of the clock, or the replay would sit
for half an hour.

On top of that this writes the calls for Call the race. Every one is built
from the real race, asked at the real moment, with nothing on the screen that
had not happened yet, and answered by what happened next:

  the start         who leads after lap 1
  the safety car    who leads eight laps after it came out
  the fight         a car within a second: is he ahead five laps later?
  the stops         who of the top three stops first
  the retirement    one of three does not see the flag
  the fastest lap   whose is it, at the flag
  the climber       a big mover: where does he finish?
  the finish        a few laps from the end: who wins?

A template that the race does not support (no safety car, no fight, no
retirement) is skipped, never invented.

Usage: python pipeline/replay.py <slug> [slug ...]
Writes data/<slug>/replay_<session>.json for the race and the sprint.
"""
import json
import sys
from datetime import timedelta
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data"


def run(slug: str) -> None:
    sys.argv = [sys.argv[0], slug]
    sys.modules.pop("build_weekend", None)
    import build_weekend as bw
    from photos import photo

    for spec in [x for x in bw.SESSIONS if x[4] == "race"]:
        s = bw.Session(*spec)
        if not s.result or not s.laps:
            continue
        out = build(s, bw, photo)
        if out:
            f = DATA / slug / f"replay_{spec[2]}.json"
            f.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
            print(f"{slug} {spec[2]}: {len(out['field'])} cars, {len(out['calls'])} calls: "
                  + " | ".join(c["kind"] for c in out["calls"]))


def build(s, bw, photo) -> dict | None:
    t0 = s.race_start_ts
    if not t0:
        return None
    total = s.total_laps or 0
    grid = s.start_grid()

    # ---------- every crossing of the line, in seconds from the start
    # (repaired in Session.crossings, which every card reads too)
    raw = s.crossings()
    # a stretch with nobody crossing for minutes is a stoppage: cut it out
    events = sorted(t for laps in raw.values() for t in laps.values())
    cuts, prev = [], 0.0
    for t in events:
        # the wait before the first crossing we know is not a stoppage: the feed
        # just has no first laps (Albert Park 2026)
        if prev and t - prev > 240:
            cuts.append((prev, t - prev - 60))
        prev = t
    def warp(t: float) -> float:
        return t - sum(dur for at, dur in cuts if t > at)

    field, cross = [], {}
    unsure: set[int] = set()
    for r in s.result:
        num = r["driver_number"]
        if r.get("dns"):
            continue
        # one that went out on lap 1 was on the grid and on the track: he stays,
        # with no crossing, or the board renumbers around him (Monaco 2026, P2)
        laps = raw.get(num, {})
        last = max(laps) if laps else 0
        seq = [0.0] + [round(warp(laps[l]), 2) if l in laps else None for l in range(1, last + 1)]
        # a real hole between two real crossings spreads evenly for the dots to
        # move, and those laps are marked: no question and no answer rests on them
        for i in range(1, len(seq)):
            if seq[i] is None:
                j = next((k for k in range(i + 1, len(seq)) if seq[k] is not None), None)
                seq[i] = round(seq[i - 1] + ((seq[j] - seq[i - 1]) / (j - i + 1) if j else 95), 2)
                unsure.add(i)
        cross[num] = seq
        d = s.drivers.get(num, {})
        field.append({
            "num": num, "code": d.get("name_acronym") or s.name(num)[:3].upper(), "name": s.name(num),
            "team": s.team(num), "colour": (d.get("team_colour") or "888888").lstrip("#"),
            "photo": (photo(d) or "").replace("w_1000", "w_420"),
            "grid": grid.get(num), "finish": s.finish_pos(num) if not r.get("dnf") else None,
            "out": s.stop_lap(num) if r.get("dnf") else None, "cross": seq,
            **({"dsq": True} if num in s.dsq else {}),
        })

    def order(lap: int) -> list[int]:
        """Who was where at the end of a lap: laps done, then who crossed first."""
        rows = []
        for n, seq in cross.items():
            done = min(lap, len(seq) - 1)
            rows.append((-done, seq[done], n))
        return [n for *_, n in sorted(rows)]

    def gap(a: int, b: int, lap: int) -> float | None:
        sa, sb = cross.get(a), cross.get(b)
        if not sa or not sb or lap >= len(sa) or lap >= len(sb):
            return None
        return round(sa[lap] - sb[lap], 1)

    name = s.name
    pits = sorted({(p["driver_number"], p["lap_number"]) for p in s.real_pits if p.get("lap_number")}, key=lambda x: x[1])
    neutral, spans = [], {}
    for p in s.sc_periods:
        if p.get("lap"):
            neutral.append({"kind": "SC", "from": p["lap"], "to": p.get("end_lap") or min(total, p["lap"] + 4)})
            # "in this lap": the lane stays cheap until it comes in, about two minutes on
            spans[("SC", p["lap"])] = (p["ts"], s.sc_until(p))
    for a, b in s.vsc_periods:
        la, lb = s.lap_of(a), s.lap_of(b)
        if la:
            neutral.append({"kind": "VSC", "from": la, "to": lb or la + 1})
            spans[("VSC", la)] = (a, s.vsc_until(b))
    neutral.sort(key=lambda x: x["from"])
    reds = sorted(set(s.red_laps))
    best = s.best_lap
    retirements = sorted(((f["out"], f["num"]) for f in field if f["out"]), key=lambda x: x[0])

    calls = []
    used_laps: set[int] = set()

    def free(lap: int) -> bool:
        return lap not in unsure and all(abs(lap - u) >= 2 for u in used_laps)

    def opt(n: int, lap: int, lead: int | None = None, gap_lap: int | None = None) -> dict:
        pos = order(lap).index(n) + 1
        g = gap(n, lead, gap_lap if gap_lap is not None else lap) if lead and lead != n else None
        return {"id": str(n), "label": name(n), "sub": f"P{pos}" + (f" · +{g:.1f}s" if g and g > 0 else (" · leading" if pos == 1 else ""))}

    # the start
    # the front of the grid as it was: a car that goes out on lap 1 was still on
    # it (Monaco 2026 Verstappen P2, Spa 2026 Russell P3); one that never started was not
    dns = {r["driver_number"] for r in s.result if r.get("dns")}
    front = sorted(((p, n) for n, p in grid.items() if n not in dns), key=lambda x: x[0])[:3]
    lap1_timed = sum(1 for l in s.laps if l.get("lap_number") == s.start_lap and l.get("lap_duration")) >= 0.5 * len(cross)
    if len(front) == 3 and total > 3:
        sl = s.start_lap
        lead1 = order(sl)[0]
        if not lap1_timed and sl == 1:
            # Albert Park 2026: lap 1 has no times, the position feed was there
            at = t0 + timedelta(seconds=min(seq[2] for seq in cross.values() if len(seq) > 2) / 2)
            p1 = [p for p in s.position if p.get("position") == 1 and bw.parse_ts(p.get("date")) and bw.parse_ts(p.get("date")) <= at]
            if p1:
                lead1 = max(p1, key=lambda p: p["date"])["driver_number"]
        ids = [n for _, n in front]
        options = [{"id": str(n), "label": name(n), "sub": f"Starts P{p}"} for p, n in front]
        answer = str(lead1) if lead1 in ids else "other"
        if answer == "other":
            options.append({"id": "other", "label": "Somebody else", "sub": "From further back"})
        calls.append({"kind": "start", "lap": 0, "reveal": sl,
                      "q": "Lights out. Who leads after lap 1?" if sl == 1 else
                           f"{'Two laps' if sl == 3 else 'A lap' if sl == 2 else f'{sl - 1} laps'} behind the safety car, then a standing start. Who leads after lap {sl}?",
                      "ctx": (f"{name(front[0][1])} on pole, {name(front[1][1])} alongside, {name(front[2][1])} third."
                              if [p for p, _ in front] == [1, 2, 3] else
                              f"{name(front[0][1])}, {name(front[1][1])} and {name(front[2][1])} head the grid."),
                      "options": options, "answer": answer,
                      "why": f"{name(lead1)} led lap {sl}" + (f", from P{grid.get(lead1)} on the grid." if grid.get(lead1, 1) != 1 else ", from pole.")})
        used_laps.add(0)

    # the safety car (or the VSC)
    for nz in neutral:
        L = nz["from"]
        if L < 3 or L > total - 9 or any(L - 1 <= r <= L + 1 for r in reds) or not free(L):
            continue
        # the lap before: the order at L already shows who dived in under it
        top3 = order(L - 1)[:3]
        R = min(total, L + 8)
        lead = order(R)[0]
        # by the clock, not by the lap: a car in the lane after the VSC ended did
        # not stop under it (Silverstone 2026 lap 23, Spa 2026 and Madring 2026)
        a_, b_ = spans[(nz["kind"], L)]
        boxed = [n for n in top3 if any(p["driver_number"] == n and p.get("entry") and a_ <= p["entry"] and (not b_ or p["entry"] <= b_)
                                        for p in s.real_pits)]
        why = (f"{name(lead)} leads on lap {R}. "
               + (f"Under it {', '.join(name(n) for n in boxed)} {'took a stop' if len(boxed) == 1 else 'stopped'}."
                  if boxed else "None of the top three stopped under it."))
        calls.append({"kind": "neutral", "lap": L, "reveal": R, "flag": nz["kind"],
                      "q": f"{'Safety car' if nz['kind'] == 'SC' else 'Virtual safety car'}. Who leads on lap {R}?",
                      # the gap on the lap before: on the lap it comes out the
                      # line times are half racing, half queueing
                      "towerLap": L - 1,
                      "ctx": f"{name(top3[0])} leads {name(top3[1])}"
                             + (f" by {abs(gap(top3[1], top3[0], L - 1)):.1f}s. " if abs(gap(top3[1], top3[0], L - 1) or 0) >= 0.05 else ". ")
                             + ("Pitting behind the safety car costs far less time than in normal racing." if nz["kind"] == "SC" else
                                "Everybody has to slow down, so a stop costs less time than usual."),
                      "options": [opt(n, L - 1, top3[0], L - 1) for n in top3],
                      "answer": str(lead) if lead in top3 else None, "why": why})
        if calls[-1]["answer"] is None:
            calls[-1]["options"].append({"id": "other", "label": "Somebody else", "sub": "From further back"})
            calls[-1]["answer"] = "other"
        used_laps.add(L)
        if sum(1 for c in calls if c["kind"] == "neutral") >= 2:
            break

    # the fight: a car within a second for three laps running, green flag
    dead = set(s.dead_laps) | {l for nz in neutral for l in range(nz["from"], nz["to"] + 2)}
    fights = []
    for L in range(5, total - 8):
        if not free(L) or any(l in dead for l in range(L - 2, L + 7)):
            continue
        o = order(L)
        for i in range(1, min(10, len(o))):
            a, b = o[i], o[i - 1]
            gs = [gap(a, b, l) for l in (L - 2, L - 1, L)]
            if all(g is not None and 0 < g < 1.0 for g in gs):
                if any(pn in (a, b) and L <= pl <= L + 5 for pn, pl in pits):
                    continue
                R = L + 5
                # a car going out or into the lane is not a fight won or lost
                if any(q["driver_number"] in (a, b) and L <= (q.get("lap_number") or 0) <= R + 1 for q in s.lane_visits):
                    continue
                if any(f["out"] and f["out"] <= R + 1 for f in field if f["num"] in (a, b)):
                    continue
                seq = [order(l).index(a) < order(l).index(b) for l in range(L + 1, min(total, R + 1) + 1)]
                ahead = seq[R - L - 1]
                # ahead on some laps and not on the lap asked, or lost again a lap later:
                # the sentence would be false either way (Shanghai 2026, Hamilton and Leclerc)
                if (any(seq[:R - L]) and not ahead) or (ahead and R < total and not seq[-1]):
                    continue
                fights.append((i, L, a, b, gs[-1], R, ahead))
    # one that changes hands first, or the answer is always no; then nearer the
    # front is a better story; one fight per pair of cars
    seen_pairs = set()
    passes = sorted(x for x in fights if x[6])[:1]
    for _, L, a, b, g, R, ahead in passes + sorted(fights):
        if sum(1 for c in calls if c["kind"] == "fight") >= 3:
            break
        if (a, b) in seen_pairs or not free(L):
            continue
        seen_pairs.add((a, b))
        pos_b = order(L).index(b) + 1
        calls.append({"kind": "fight", "lap": L, "reveal": R, "cars": [a, b],
                      "q": f"{name(a)} is {g:.1f}s behind {name(b)}. Is he ahead by lap {R}?",
                      "ctx": f"They are fighting for P{pos_b}, and {name(a)} has been inside a second for three laps.",
                      "options": [{"id": "yes", "label": "Yes, he gets by", "sub": f"{name(a)} ahead on lap {R}"},
                                  {"id": "no", "label": "No, he holds him off", "sub": f"{name(b)} still ahead"}],
                      "answer": "yes" if ahead else "no",
                      "why": (f"{name(a)} got by: ahead of {name(b)} on lap {R}." if ahead else
                              f"{name(b)} held him off: still ahead on lap {R}.")})
        used_laps.add(L)

    # the stops: who of the top three goes first
    for L in range(6, total - 10):
        if not free(L) or L in dead:
            continue
        top3 = order(L)[:3]
        nxt = [(pl, pn) for pn, pl in pits if pn in top3 and pl > L]
        if not nxt or nxt[0][0] - L > 6:
            continue
        # every one of the three on a set the feed knows, or the question
        # would have to guess at what it is asking about
        if any(not s.tyre_at_lap(n, L)[0] or not s.tyre_at_lap(n, L)[1] for n in top3):
            continue
        first_lap, first = min(nxt)
        if any(c["kind"] == "stops" and L <= c["reveal"] + 2 for c in calls):
            continue
        # one car on old tyres and two that have just stopped is no question
        ages = sorted(s.tyre_at_lap(n, L)[1] for n in top3)
        if ages[2] - ages[1] >= 8:
            continue
        if sum(1 for pl, pn in nxt if pl == first_lap) > 1:
            continue
        # the second round reads as the second round, not the same line again
        again = any(c["kind"] == "stops" for c in calls)
        calls.append({"kind": "stops", "lap": L, "reveal": first_lap + 1,
                      "q": ("Next round of stops. Who of the top three pits first?" if again
                            else "Who of the top three stops first?"),
                      "ctx": f"Lap {L}. " + ", ".join(
                          f"{name(n)} on {(s.tyre_at_lap(n, L)[0] or 'his').lower()}s, "
                          f"{s.tyre_at_lap(n, L)[1]} lap{'' if s.tyre_at_lap(n, L)[1] == 1 else 's'} old"
                          + (", a used set" if s.tyre_at_lap(n, L)[1] >= L else "")
                          for n in top3) + ".",
                      "options": [opt(n, L, top3[0]) for n in top3],
                      "answer": str(first), "why": f"{name(first)} boxed on lap {first_lap}."})
        used_laps.add(L)
        if sum(1 for c in calls if c["kind"] == "stops") >= 2:
            break

    # the retirement
    for out_lap, num in retirements:
        L = out_lap - 3
        if L < 4 or not free(L):
            continue
        o = order(L)
        if num not in o:
            continue
        i = o.index(num)
        finishes = lambda n: not any(f["num"] == n and f["out"] for f in field)
        above = [n for n in reversed(o[max(0, i - 3):i]) if finishes(n)]
        below = [n for n in o[i + 1:i + 4] if finishes(n) and n in cross and len(cross[n]) > L]
        near = (above[:1] + below[:1] + above[1:] + below[1:])[:2]
        if len(near) < 2:
            continue
        # by name: in running order the one who stops was always the last of the three
        ids = sorted([num] + near, key=name)
        again = any(c["kind"] == "retire" for c in calls)
        calls.append({"kind": "retire", "lap": L, "reveal": out_lap, "cars": [num],
                      "q": ("Another car will retire. Which of these three?" if again
                            else "One of these three will retire. Who?"),
                      "ctx": f"Lap {L}, {total - L} to go. All three are running.",
                      "options": [opt(n, L) for n in ids], "answer": str(num),
                      "why": f"{name(num)} stopped on lap {out_lap}."})
        used_laps.add(L)
        if sum(1 for c in calls if c["kind"] == "retire") >= 2:
            break

    # the fastest lap
    if best:
        fl = int(total * 0.4)
        if free(fl):
            pace = sorted(((min((l["lap_duration"] for l in s.timed_laps(n) if l.get("lap_duration")), default=999), n)
                           for n in cross), key=lambda x: x[0])
            ids = [n for _, n in pace[:3]]
            if best["driver_number"] in ids:
                calls.append({"kind": "fastest", "lap": fl, "reveal": total,
                              "q": "Who sets the fastest lap?",
                              "ctx": "We find out at the flag. New tyres late in the race usually decide it.",
                              "options": [opt(n, fl) for n in sorted(ids, key=lambda n: order(fl).index(n))],
                              "answer": str(best["driver_number"]),
                              "why": f"{name(best['driver_number'])}, {bw.fmt(best['lap_duration'])} on lap {best.get('lap_number')}."})
                used_laps.add(fl)

    # the climber
    scoring = 8 if s.slug == "sprint" else 10   # a sprint pays down to P8
    mid = int(total * 0.55)
    climbers = sorted(((f["grid"] - f["finish"], f["num"]) for f in field
                       if f["grid"] and f["finish"] and f["grid"] - f["finish"] >= 5), reverse=True)
    # only one still near the line: P17 with thirty laps left has no real options
    climbers = [c for c in climbers if abs(order(mid).index(c[1]) + 1 - scoring) <= 4]
    if climbers and free(mid):
        num = climbers[0][1]
        f = next(x for x in field if x["num"] == num)
        now = order(mid).index(num) + 1
        bucket = "podium" if f["finish"] <= 3 else "points" if f["finish"] <= scoring else "out"
        calls.append({"kind": "climber", "lap": mid, "reveal": total,
                      "q": f"{name(num)} started {s.start_words(num)}. Where does he finish?",
                      "ctx": f"Lap {mid}, and he is P{now}.",
                      "options": [{"id": "podium", "label": "On the podium", "sub": "P1 to P3"},
                                  {"id": "points", "label": "In the points", "sub": f"P4 to P{scoring}"},
                                  {"id": "out", "label": "Out of the points", "sub": f"P{scoring + 1} or lower"}],
                      "answer": bucket, "why": f"{name(num)}: {s.start_line(num)[0].lower() + s.start_line(num)[1:] if s.from_pit_lane(num) else s.start_line(num)}, classified P{f['finish']}."})
        used_laps.add(mid)

    # the finish
    # the classification, not the line: Baku 2026, 0.196s, and two feed stamps a tie
    win = next((r["driver_number"] for r in s.result if r.get("position") == 1), order(total)[0])
    backs = [b for b in (6, 7, 5, 8, 4, 10, 12, 15, 18, 20) if total - b > 0 and total - b not in dead and free(total - b)]
    # the first with a race still in it; a win already decided is no question
    backs = [b for b in backs if abs(gap(order(total - b)[1], order(total - b)[0], total - b) or 99) < 8][:1] or backs[:1]
    for back in backs:
        L = total - back
        top3 = order(L)[:3]
        calls.append({"kind": "finish", "lap": L, "reveal": total,
                      "q": f"{total - L} laps to go. Who wins?",
                      "ctx": f"{name(top3[0])} leads {name(top3[1])} by {abs(gap(top3[1], top3[0], L) or 0):.1f}s, "
                             f"{name(top3[2])} third.",
                      "options": [opt(n, L, top3[0]) for n in top3],
                      "answer": str(win) if win in top3 else "other",
                      "why": f"{name(win)} wins it."})
        if calls[-1]["answer"] == "other":
            calls[-1]["options"].append({"id": "other", "label": "Somebody else", "sub": ""})
        used_laps.add(L)
        break

    def ordinal(n: int) -> str:
        return f"{n}{'th' if 10 <= n % 100 <= 20 else {1: 'st', 2: 'nd', 3: 'rd'}.get(n % 10, 'th')}"

    after1 = order(s.start_lap)
    # what a stop really cost in this race, measured (pipeline/pitwall.py)
    try:
        from pitwall import race_economics
        econ = race_economics(s)
    except Exception:
        econ = None
    # no figure below 12s: that is the race's few green stops talking, not a stop
    loss = f"A stop costs about {econ['pitLoss']:.0f}s in this race." if econ and econ["pitLoss"] >= 12 else "A stop costs around twenty seconds."
    team_name = lambda t: t.replace(" F1 Team", "")
    finish_of = {f["num"]: f["finish"] for f in field}

    # the first lap: who makes up the most places
    # the same sum as the card (Session.lap1_gains)
    gains = s.lap1_gains()
    slot = {n: i + 1 for i, n in enumerate(sorted((n for n in grid if n not in dns), key=grid.get))}
    if lap1_timed and s.start_lap == 1 and gains and gains[0][0] >= 3 and (len(gains) < 2 or gains[0][0] > gains[1][0]):
        top_gain, gainer = gains[0]
        others = [n for g, n in gains[1:] if grid.get(n, 0) >= 8][:2]
        if len(others) == 2:
            ids = sorted([gainer] + others, key=lambda n: grid[n])
            calls.append({"kind": "lap1", "lap": 0, "reveal": s.start_lap,
                          "q": f"Who makes up the most places on lap {s.start_lap}?",
                          "ctx": ("Three cars from the back of the grid." if min(grid[n] for n in ids) >= 15 else
                                  "Three cars from further back on the grid.") + " Turn 1 decides a lot.",
                          "options": [{"id": str(n), "label": name(n),
                                       "sub": "From the pit lane" if s.from_pit_lane(n) else f"Starts P{grid[n]}"} for n in ids],
                          "answer": str(gainer),
                          "why": f"{name(gainer)}: P{slot[gainer]} among the cars that started to P{after1.index(gainer) + 1}, {top_gain} places on the {'opening lap' if s.start_lap == 1 else 'first lap of racing'}."})

    # half distance: who is in front
    half = total // 2
    L = max(3, round(total * 0.3))
    while L < half - 4 and (not free(L) or L in dead):
        L += 1
    if L < half - 4:
        top3 = order(L)[:3]
        lead = order(half)[0]
        calls.append({"kind": "half", "lap": L, "reveal": half,
                      "q": f"Who leads at half distance, on lap {half}?",
                      "ctx": f"Lap {L}. {name(top3[0])} leads {name(top3[1])} by {abs(gap(top3[1], top3[0], L) or 0):.1f}s.",
                      "options": [opt(n, L, top3[0]) for n in top3] + ([] if lead in top3 else
                                  [{"id": "other", "label": "Somebody else", "sub": "From further back"}]),
                      "answer": str(lead) if lead in top3 else "other",
                      "why": f"{name(lead)} leads on lap {half}."})
        used_laps.add(L)

    # box, box: does he come out ahead of the car behind?
    rejoins = 0
    for pn, pl in pits:
        L = pl - 1
        if rejoins >= 2 or L < 4 or L > total - 6 or any(l in dead for l in range(L, pl + 2)) or not free(L):
            continue
        o = order(L)
        if pn not in o:
            continue
        i = o.index(pn)
        if i > 9:
            continue
        # close to what a stop costs, or the context gives the answer away
        cost = econ["pitLoss"] if econ else 22
        rival = next((m for m in o[i + 1:i + 6]
                      if abs((gap(m, pn, L) or 0) - cost) < 5
                      and not any(q == m and L <= ql <= pl + 2 for q, ql in pits)), None)
        if not rival:
            continue
        # the first time they cross the line after the stop is where he came out;
        # two laps on he may have passed him on new tyres (Barcelona 2026)
        R = pl + 1
        if abs(gap(rival, pn, R) or 0) < 0.5:
            continue
        ahead = order(R).index(pn) < order(R).index(rival)
        g = gap(rival, pn, L)
        calls.append({"kind": "rejoin", "lap": L, "reveal": R, "cars": [pn, rival],
                      "q": f"Box, box. {name(pn)} pits from P{i + 1}. Does he come out ahead of {name(rival)}?",
                      "ctx": f"{name(rival)} is {g:.1f}s behind him. {loss}",
                      "options": [{"id": "yes", "label": "Yes, he stays ahead", "sub": f"Ahead of {name(rival)} after the stop"},
                                  {"id": "no", "label": "No, he drops behind", "sub": f"{name(rival)} gets the place"}],
                      "answer": "yes" if ahead else "no",
                      "why": (f"He came out ahead: still in front of {name(rival)} on lap {R}." if ahead else
                              f"He came out behind {name(rival)}, who had the place on lap {R}.")})
        used_laps.add(L)
        rejoins += 1

    # team-mates: who finishes ahead
    L = round(total * 0.6)
    while L < total - 8 and (not free(L) or L in dead):
        L += 1
    if L < total - 8:
        o = order(L)
        pairs = []
        teams: dict[str, list[int]] = {}
        for n in o:
            teams.setdefault(s.team(n), []).append(n)
        for t, ns in teams.items():
            if len(ns) == 2 and all(finish_of.get(n) for n in ns):
                a, b = ns
                g = abs(gap(a, b, L) or 99)
                if g < 10:
                    pairs.append((g, a, b, t))
        if pairs:
            g, a, b, t = min(pairs)
            first = a if finish_of[a] < finish_of[b] else b
            calls.append({"kind": "mates", "lap": L, "reveal": total,
                          "q": f"{team_name(t)} team-mates. Who finishes ahead?",
                          "ctx": f"Lap {L}. {name(a)} is P{o.index(a) + 1}, {name(b)} P{o.index(b) + 1}, {g:.1f}s apart.",
                          "options": [opt(a, L), opt(b, L)],
                          "answer": str(first),
                          "why": f"{name(first)}: P{finish_of[first]} at the flag, "
                                 f"{name(b if first == a else a)} P{finish_of[b if first == a else a]}."})
            used_laps.add(L)

    # the last point
    L = round(total * 0.75)
    while L < total - 5 and (not free(L) or L in dead):
        L += 1
    if L < total - 5:
        o = order(L)
        if len(o) > scoring + 1:
            n = o[scoring]
            fin = finish_of.get(n)
            calls.append({"kind": "points", "lap": L, "reveal": total,
                          "q": f"{name(n)} is P{scoring + 1} with {total - L} laps to go. Does he score?",
                          "ctx": f"{name(o[scoring - 1])} holds the last point, {abs(gap(n, o[scoring - 1], L) or 0):.1f}s up the road.",
                          "options": [{"id": "yes", "label": f"Yes, into the top {'ten' if scoring == 10 else 'eight'}", "sub": "Points on the board"},
                                      {"id": "no", "label": "No, no points", "sub": f"P{scoring + 1} or lower"}],
                          "answer": "yes" if fin and fin <= scoring else "no",
                          "why": (f"{name(n)} finished {ordinal(fin)}." if fin else f"{name(n)} did not finish.")})
            used_laps.add(L)

    # the last step of the podium
    L = total - 10
    while L < total - 5 and (not free(L) or L in dead):
        L += 1
    if L < total - 5 and total > 15:
        o = order(L)
        cand = o[2:5]
        third = next((r["driver_number"] for r in s.result if r.get("position") == 3), order(total)[2])
        calls.append({"kind": "third", "lap": L, "reveal": total,
                      "q": "Who finishes third?",
                      "ctx": f"Lap {L}. Three cars around the last place on the podium.",
                      "options": [opt(n, L, o[0]) for n in cand] + ([] if third in cand else
                                  [{"id": "other", "label": "Somebody else", "sub": ""}]),
                      "answer": str(third) if third in cand else "other",
                      "why": f"{name(third)} took P3."})
        used_laps.add(L)

    # closing in: inside a second at the flag?
    L = total - 12
    while L < total - 6 and (not free(L) or L in dead):
        L += 1
    late_neutral = any(nz["from"] > L for nz in neutral)
    if L < total - 6 and not late_neutral:
        o = order(L)
        for i in range(1, min(8, len(o))):
            a, b = o[i], o[i - 1]
            g = gap(a, b, L)
            gf = gap(a, b, total)
            if g is not None and 2 < g < 8 and gf is not None and not any(n in (a, b) and pl > L for n, pl in pits):
                calls.append({"kind": "closing", "lap": L, "reveal": total,
                              "q": f"{name(a)} is {g:.1f}s behind {name(b)}. Under a second at the flag?",
                              "ctx": f"{total - L} laps to go, both on the tyres they will finish on.",
                              "options": [{"id": "yes", "label": "Yes, he reels him in", "sub": "Under a second at the line"},
                                          {"id": "no", "label": "No, it stays open", "sub": "A second or more"}],
                              # past him counts: he did more than close in
                              "answer": "yes" if gf < 1 else "no",
                              "why": (f"He did more than that: {name(a)} passed {name(b)} and finished {abs(gf):.1f}s ahead."
                                      if gf <= 0 else f"At the flag: {gf:.1f}s between them.")})
                used_laps.add(L)
                break

    def pick(cs: list[dict], cap: int = 16) -> list[dict]:
        """At most `cap` calls, chosen by how much each one matters: the start,
        who wins, the safety car and the first of every kind always make it;
        a second fight or a second retirement only if there is room. Then
        back into race order."""
        rank = ["start", "finish", "neutral", "fight", "stops", "rejoin", "retire", "half",
                "mates", "third", "points", "closing", "lap1", "climber", "fastest"]
        seen: dict[str, int] = {}
        scored = []
        for i, c in enumerate(cs):
            k = seen.get(c["kind"], 0)
            seen[c["kind"]] = k + 1
            pri = (k, rank.index(c["kind"]) if c["kind"] in rank else 99)
            scored.append((pri, i, c))
        chosen = [c for _, _, c in sorted(scored)[:cap]]
        return sorted(chosen, key=lambda c: (c["lap"], cs.index(c)))

    calls.sort(key=lambda c: c["lap"])
    return {
        "laps": total,
        "lapTime": round(sorted(seq[-1] / (len(seq) - 1) for seq in cross.values() if len(seq) > 5)[len(cross) // 2], 2),
        "field": field,
        "neutral": neutral,
        "red": reds,
        "pits": [[n, l] for n, l in pits],
        "fastest": ({"num": best["driver_number"], "lap": best.get("lap_number")} if best else None),
        "unsure": sorted(unsure),
        "calls": pick(calls),
    }


if __name__ == "__main__":
    for slug in sys.argv[1:]:
        run(slug)
