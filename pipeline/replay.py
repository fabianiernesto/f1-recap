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
    raw: dict[int, dict[int, float]] = {}
    for l in s.laps:
        ts, d, ln = bw.parse_ts(l.get("date_start")), l.get("lap_duration"), l.get("lap_number")
        if ts and d and ln and ln <= total:
            raw.setdefault(l["driver_number"], {})[ln] = (ts - t0).total_seconds() + d
    # a stretch with nobody crossing for minutes is a stoppage: cut it out
    events = sorted(t for laps in raw.values() for t in laps.values())
    cuts, prev = [], 0.0
    for t in events:
        if t - prev > 240:
            cuts.append((prev, t - prev - 60))
        prev = t
    def warp(t: float) -> float:
        return t - sum(dur for at, dur in cuts if t > at)

    field, cross = [], {}
    for r in s.result:
        num = r["driver_number"]
        if r.get("dns") or num not in raw:
            continue
        laps = raw[num]
        last = max(laps)
        seq = [0.0] + [round(warp(laps[l]), 2) if l in laps else None for l in range(1, last + 1)]
        # a hole in the feed (a lap with no time) is filled in proportion
        for i in range(1, len(seq)):
            if seq[i] is None:
                j = next((k for k in range(i + 1, len(seq)) if seq[k] is not None), None)
                seq[i] = round(seq[i - 1] + ((seq[j] - seq[i - 1]) / (j - i + 1) if j else 95), 2)
        cross[num] = seq
        d = s.drivers.get(num, {})
        field.append({
            "num": num, "code": d.get("name_acronym") or s.name(num)[:3].upper(), "name": s.name(num),
            "team": s.team(num), "colour": (d.get("team_colour") or "888888").lstrip("#"),
            "photo": (photo(d) or "").replace("w_1000", "w_420"),
            "grid": grid.get(num), "finish": s.finish_pos(num) if not r.get("dnf") else None,
            "out": s.stop_lap(num) if r.get("dnf") else None, "cross": seq,
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
    neutral = []
    for p in s.sc_periods:
        if p.get("lap"):
            neutral.append({"kind": "SC", "from": p["lap"], "to": p.get("end_lap") or min(total, p["lap"] + 4)})
    for a, b in s.vsc_periods:
        la, lb = s.lap_of(a), s.lap_of(b)
        if la:
            neutral.append({"kind": "VSC", "from": la, "to": lb or la + 1})
    neutral.sort(key=lambda x: x["from"])
    reds = sorted(set(s.red_laps))
    best = s.best_lap
    retirements = sorted(((f["out"], f["num"]) for f in field if f["out"]), key=lambda x: x[0])

    calls = []
    used_laps: set[int] = set()

    def free(lap: int) -> bool:
        return all(abs(lap - u) >= 2 for u in used_laps)

    def opt(n: int, lap: int, lead: int | None = None, gap_lap: int | None = None) -> dict:
        pos = order(lap).index(n) + 1
        g = gap(n, lead, gap_lap if gap_lap is not None else lap) if lead and lead != n else None
        return {"id": str(n), "label": name(n), "sub": f"P{pos}" + (f" · +{g:.1f}s" if g else (" · leading" if pos == 1 else ""))}

    # the start
    front = sorted(((p, n) for n, p in grid.items() if n in cross), key=lambda x: x[0])[:3]
    if len(front) == 3 and total > 3:
        lead1 = order(1)[0]
        ids = [n for _, n in front]
        options = [{"id": str(n), "label": name(n), "sub": f"Starts P{p}"} for p, n in front]
        answer = str(lead1) if lead1 in ids else "other"
        if answer == "other":
            options.append({"id": "other", "label": "Somebody else", "sub": "From further back"})
        calls.append({"kind": "start", "lap": 0, "reveal": 1, "q": "Lights out. Who leads after lap 1?",
                      "ctx": f"{name(front[0][1])} on pole, {name(front[1][1])} alongside, {name(front[2][1])} third.",
                      "options": options, "answer": answer,
                      "why": f"{name(lead1)} led lap 1" + (f", from P{grid.get(lead1)} on the grid." if grid.get(lead1, 1) != 1 else ", from pole.")})
        used_laps.add(0)

    # the safety car (or the VSC)
    for nz in neutral:
        L = nz["from"]
        if L < 3 or L > total - 9 or any(L - 1 <= r <= L + 1 for r in reds) or not free(L):
            continue
        top3 = order(L)[:3]
        R = min(total, L + 8)
        lead = order(R)[0]
        boxed = [n for n in top3 if any(pn == n and L <= pl <= nz["to"] + 1 for pn, pl in pits)]
        why = (f"{name(lead)} leads on lap {R}. "
               + (f"Under it {', '.join(name(n) for n in boxed)} {'took a stop' if len(boxed) == 1 else 'stopped'}."
                  if boxed else "None of the top three stopped under it."))
        calls.append({"kind": "neutral", "lap": L, "reveal": R, "flag": nz["kind"],
                      "q": f"{'Safety car' if nz['kind'] == 'SC' else 'Virtual safety car'}. Who leads on lap {R}?",
                      # the gap on the lap before: on the lap it comes out the
                      # line times are half racing, half queueing
                      "ctx": f"{name(top3[0])} leads {name(top3[1])} by {abs(gap(top3[1], top3[0], L - 1) or 0):.1f}s. "
                             + ("A stop under it costs a lot less than in green." if nz["kind"] == "SC" else
                                "The gaps freeze, so a stop is cheap for whoever takes it."),
                      "options": [opt(n, L, top3[0], L - 1) for n in top3],
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
                ahead = order(R).index(a) < order(R).index(b)
                fights.append((i, L, a, b, gs[-1], R, ahead))
    # nearer the front is a better story; one fight per pair of cars
    seen_pairs = set()
    for _, L, a, b, g, R, ahead in sorted(fights):
        if sum(1 for c in calls if c["kind"] == "fight") >= 3:
            break
        if (a, b) in seen_pairs or not free(L):
            continue
        seen_pairs.add((a, b))
        pos_b = order(L).index(b) + 1
        calls.append({"kind": "fight", "lap": L, "reveal": R,
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
        if sum(1 for pl, pn in nxt if pl == first_lap) > 1:
            continue
        calls.append({"kind": "stops", "lap": L, "reveal": first_lap + 1,
                      "q": "Who of the top three stops first?",
                      "ctx": f"Lap {L}. " + ", ".join(
                          f"{name(n)} on {(s.tyre_at_lap(n, L)[0] or 'his').lower()}s, {s.tyre_at_lap(n, L)[1] or '?'} laps old"
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
        near = [n for n in o[max(0, i - 3): i + 4] if n != num and not any(f["num"] == n and f["out"] for f in field)][:2]
        if len(near) < 2:
            continue
        ids = sorted([num] + near, key=lambda n: o.index(n))
        calls.append({"kind": "retire", "lap": L, "reveal": out_lap,
                      "q": "One of these three does not see the flag. Who?",
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
                              "q": "Whose is the fastest lap of the race?",
                              "ctx": "Answered at the flag. Fresh tyres late on usually decide it.",
                              "options": [opt(n, fl) for n in sorted(ids, key=lambda n: order(fl).index(n))],
                              "answer": str(best["driver_number"]),
                              "why": f"{name(best['driver_number'])}, {bw.fmt(best['lap_duration'])} on lap {best.get('lap_number')}."})
                used_laps.add(fl)

    # the climber
    mid = int(total * 0.55)
    climbers = sorted(((f["grid"] - f["finish"], f["num"]) for f in field
                       if f["grid"] and f["finish"] and f["grid"] - f["finish"] >= 5), reverse=True)
    if climbers and free(mid):
        num = climbers[0][1]
        f = next(x for x in field if x["num"] == num)
        now = order(mid).index(num) + 1
        bucket = "podium" if f["finish"] <= 3 else "points" if f["finish"] <= 10 else "out"
        calls.append({"kind": "climber", "lap": mid, "reveal": total,
                      "q": f"{name(num)} started P{f['grid']}. Where does he finish?",
                      "ctx": f"Lap {mid}, and he is P{now}.",
                      "options": [{"id": "podium", "label": "On the podium", "sub": "P1 to P3"},
                                  {"id": "points", "label": "In the points", "sub": "P4 to P10"},
                                  {"id": "out", "label": "Out of the points", "sub": "P11 or lower"}],
                      "answer": bucket, "why": f"{name(num)}: P{f['grid']} on the grid, P{f['finish']} at the flag."})
        used_laps.add(mid)

    # the finish
    for back in (6, 7, 5, 8, 4):
        L = total - back
        if L in dead or not free(L) or L <= 0:
            continue
        top3 = order(L)[:3]
        win = order(total)[0]
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

    after1 = order(1)
    # what a stop really cost in this race, measured (pipeline/pitwall.py)
    try:
        from pitwall import race_economics
        econ = race_economics(s)
    except Exception:
        econ = None
    loss = f"A stop costs {econ['pitLoss']:.0f}s here, measured off this race." if econ else "A stop costs around twenty seconds."
    team_name = lambda t: t.replace(" F1 Team", "")
    finish_of = {f["num"]: f["finish"] for f in field}

    # the first lap: who makes up the most places
    gains = sorted(((grid.get(n, 99) - (after1.index(n) + 1), n) for n in after1 if grid.get(n)), reverse=True)
    if gains and gains[0][0] >= 3 and (len(gains) < 2 or gains[0][0] > gains[1][0]):
        top_gain, gainer = gains[0]
        others = [n for g, n in gains[1:] if grid.get(n, 0) >= 8][:2]
        if len(others) == 2:
            ids = sorted([gainer] + others, key=lambda n: grid[n])
            calls.append({"kind": "lap1", "lap": 0, "reveal": 1,
                          "q": "Who makes up the most places on lap 1?",
                          "ctx": "Three cars starting from the middle of the grid. Turn 1 decides a lot.",
                          "options": [{"id": str(n), "label": name(n), "sub": f"Starts P{grid[n]}"} for n in ids],
                          "answer": str(gainer),
                          "why": f"{name(gainer)}: P{grid[gainer]} to P{after1.index(gainer) + 1}, {top_gain} places on the opening lap."})

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
        if rejoins >= 2 or L < 4 or L > total - 6 or L in dead or pl in dead or not free(L):
            continue
        o = order(L)
        if pn not in o:
            continue
        i = o.index(pn)
        if i > 9:
            continue
        rival = next((m for m in o[i + 1:i + 6]
                      if (gap(m, pn, L) or 0) > 14 and (gap(m, pn, L) or 0) < 30
                      and not any(q == m and L < ql <= pl + 2 for q, ql in pits)), None)
        if not rival:
            continue
        R = pl + 2
        ahead = order(R).index(pn) < order(R).index(rival)
        g = gap(rival, pn, L)
        calls.append({"kind": "rejoin", "lap": L, "reveal": R,
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
        if len(o) > 11:
            n = o[10]
            fin = finish_of.get(n)
            calls.append({"kind": "points", "lap": L, "reveal": total,
                          "q": f"{name(n)} is P11 with {total - L} laps to go. Does he score?",
                          "ctx": f"{name(o[9])} holds the last point, {abs(gap(n, o[9], L) or 0):.1f}s up the road.",
                          "options": [{"id": "yes", "label": "Yes, into the top ten", "sub": "Points on the board"},
                                      {"id": "no", "label": "No, no points", "sub": "P11 or lower"}],
                          "answer": "yes" if fin and fin <= 10 else "no",
                          "why": (f"{name(n)} finished {ordinal(fin)}." if fin else f"{name(n)} did not finish.")})
            used_laps.add(L)

    # the last step of the podium
    L = total - 10
    while L < total - 5 and (not free(L) or L in dead):
        L += 1
    if L < total - 5 and total > 15:
        o = order(L)
        cand = o[2:5]
        third = order(total)[2]
        calls.append({"kind": "third", "lap": L, "reveal": total,
                      "q": "Who finishes third?",
                      "ctx": f"Lap {L}. The last step of the podium, and three cars after it.",
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
                              "q": f"{name(a)} is {g:.1f}s behind {name(b)}. Inside a second at the flag?",
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
        "calls": pick(calls),
    }


if __name__ == "__main__":
    for slug in sys.argv[1:]:
        run(slug)
