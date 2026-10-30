"""
Your wall (activity 02, since 22/10/2026).

The pit wall, with what it was missing. You pick the driver instead of being
handed one, every stop option tells you where you would have come out of the
pit lane and behind whom, and the safety car is in it.

What it reuses from pitwall.py, unchanged: the race economics (what a stop
cost here, how each compound wore here), the stop and last-set calls, and
the trust rule (a race where the model disagrees with the real strategist by
more than three seconds is not shown).

What it adds:

  More seats. Every driver who finished on the lead lap, stopped, and whose
  calls the model can score, not only the tightest one.

  The rejoin. For every option, where he comes out of the lane, out of the
  real crossing times of the line: the whole field's real times at the end
  of the out-lap, against his own with the stops moved. It is an estimate
  (the other cars are left exactly as they really ran), and the real option
  is checked against the real order at that lap before anything is written.

  The safety car. Still not priced in seconds, for the reason pitwall.py
  gives, so it is a call without a number: box or stay out, then what the
  garage really did and the places it was worth, from the real order before
  the safety car and after the restart.

Usage: python pipeline/muro.py <slug> [slug ...]
Writes data/<slug>/muro_race.json (and removes it where there is no game).
"""
import json
import sys
from collections import defaultdict
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data"


def run(slug: str) -> None:
    # build_weekend reads the GP from argv when it is imported
    sys.argv = [sys.argv[0], slug]
    for m in [m for m in sys.modules if m in ("build_weekend",)]:
        del sys.modules[m]
    import build_weekend as bw
    from pitwall import race_economics, build_calls, _model_agrees, _gap_ladder, _stint_cost, _tyre
    from photos import photo

    target = DATA / slug / "muro_race.json"
    spec = next((x for x in bw.SESSIONS if x[2] == "race"), None)
    if not spec:
        print(f"{slug}: no race")
        return
    s = bw.Session(*spec)
    econ = race_economics(s) if s.result else None
    if not econ:
        target.unlink(missing_ok=True)
        print(f"{slug}: no game (tyre data does not hold up)")
        return
    loss = econ["pitLoss"]
    total = s.total_laps or 0
    dead = set(s.dead_laps)

    # when every car crossed the line at the end of every lap
    cross: dict[int, dict[int, float]] = defaultdict(dict)
    for l in s.laps:
        ts, d, ln = bw.parse_ts(l.get("date_start")), l.get("lap_duration"), l.get("lap_number")
        if ts and d and ln:
            cross[l["driver_number"]][ln] = ts.timestamp() + d

    def rejoin(num: int, x: int, stops: list[int]) -> dict | None:
        """Where a stop on lap x puts him, at the end of the out-lap."""
        lap = x + 1
        if lap in dead or lap not in cross[num]:
            return None
        mine = cross[num][lap] - loss * sum(1 for y in stops if y + 1 <= lap) + loss
        field = sorted((t[lap], n) for n, t in cross.items() if n != num and lap in t)
        ahead = [(t, n) for t, n in field if t < mine]
        behind = [(t, n) for t, n in field if t >= mine]
        out = {"pos": len(ahead) + 1}
        if ahead:
            out["ahead"] = [s.name(ahead[-1][1]), round(mine - ahead[-1][0], 1)]
        if behind:
            out["behind"] = [s.name(behind[0][1]), round(behind[0][0] - mine, 1)]
        return out

    checks, off = 0, 0
    seats = []
    ladder = _gap_ladder(s)
    # every finisher on the lead lap who stopped, not only the closest eight
    rows = []
    for row in ladder:
        num = next((r["driver_number"] for r in s.result if r.get("position") == row["pos"]), None)
        stops = s.pit_laps(num) if num else []
        if not stops:
            continue
        i = ladder.index(row)
        ahead = row["gap"] - ladder[i - 1]["gap"] if i else None
        behind = ladder[i + 1]["gap"] - row["gap"] if i + 1 < len(ladder) else None
        margin = min([g for g in (ahead, behind) if g is not None] or [999])
        rows.append({"number": num, "name": s.name(num), "team": s.team(num),
                     "pos": row["pos"], "stops": stops, "margin": round(margin, 3)})

    for seat in rows:
        calls = build_calls(s, seat, econ)
        # the trust rule, call by call (23/10/2026): a call where the real
        # strategist lands more than three seconds off the model's best is a
        # call the model got wrong, so that call goes; the rest of his race
        # can still be priced. One honest call is enough to play.
        calls = [c for c in calls if _model_agrees([c])]
        if not calls:
            continue
        num, stops = seat["number"], seat["stops"]
        for c in calls:
            c["scored"] = True
            if c["kicker"] == "The last set":
                continue
            real_lost = next((o["lost"] for o in c["options"] if o.get("real")), 0)
            for o in c["options"]:
                # what this option does to his race, against what he really did
                o["delta"] = round(o["lost"] - real_lost, 1)
                rj = rejoin(num, o["lap"], stops)
                if rj:
                    o["rejoin"] = rj
                if o.get("real") and rj:
                    real = next((p for p, n in s.order_at_lap(o["lap"] + 1) if n == num), None)
                    checks += 1
                    if real is not None and abs(real - rj["pos"]) > 1:
                        off += 1

        # the safety car: a call with no number on it
        for p in s.sc_periods:
            L, E = p.get("lap"), p.get("end_lap") or (p.get("lap") or 0) + 3
            if not L or L < 2 or L > total - 2:
                continue
            before = next((pos for pos, n in s.order_at_lap(L - 1) if n == num), None)
            if before is None:
                continue
            after_lap = min(E + 3, total)
            after = next((pos for pos, n in s.order_at_lap(after_lap) if n == num), None)
            running = [n for _, n in s.order_at_lap(L - 1)]
            boxed_all = {pp["driver_number"] for pp in s.real_pits if L <= (pp.get("lap_number") or 0) <= E}
            boxed = num in boxed_all
            comp, age = s.tyre_at_lap(num, L)
            facts = [["Running", f"P{before}"]]
            if comp and age:
                facts.append(["Tyre", f"{comp.lower()}, {age} laps old"])
            facts.append(["Laps left", str(total - L)])
            moved = (before - after) if after else None
            calls.append({
                "lap": L, "kicker": "Safety car", "scored": False,
                "question": f"Safety car on lap {L}. Box or stay out?",
                "facts": facts,
                "options": [{"label": "Box him", "lap": L, "lost": 0, "real": boxed,
                             "note": "Fresh tyres for a cheaper stop, and the places it costs to take it."},
                            {"label": "Stay out", "lap": L, "lost": 0, "real": not boxed,
                             "note": "Keep the track position and run the old set to the flag or the next window."}],
                "reading": (f"{len(boxed_all & set(running))} of {len(running)} cars boxed under it. "
                            f"His garage {'boxed' if boxed else 'kept him out'}: P{before} when it came out"
                            + (f", P{after} three laps after the restart" if after else "")
                            + (f" ({'+' if moved > 0 else ''}{moved} place{'s' if abs(moved) != 1 else ''})" if moved else "")
                            + ". The other road cannot be measured: a stop under a safety car is paid "
                              "in track position, not in seconds."),
                "moved": moved,
            })
        calls.sort(key=lambda c: (c["lap"], c["kicker"] == "The last set"))

        # the live ghost (24/10/2026): every lap of every trusted stop window,
        # priced the way pitwall.py prices its options, so a stop can be called
        # on any lap of the window, not only on the five laps offered
        stints = sorted([st for st in s.stints if st.get("driver_number") == num and st.get("lap_start")],
                        key=lambda x: x["lap_start"])
        windows = []
        for c in calls:
            if not c.get("scored") or c["kicker"] == "The last set":
                continue
            stop = c["lap"]
            if stop not in stops:
                continue
            i = stops.index(stop)
            comp, _ = s.tyre_at_lap(num, stop)
            nxt = next((st.get("compound") for st in stints if (st.get("lap_start") or 0) > stop), None)
            this = next((st for st in stints if (st.get("lap_start") or 0) <= stop <= (st.get("lap_end") or 0)), None)
            w0 = (this.get("lap_start") if this else None) or (stops[i - 1] if i else 1)
            w1 = stops[i + 1] if i + 1 < len(stops) else total
            if comp not in econ["tyres"] or nxt not in econ["tyres"]:
                continue
            cost = lambda x: _stint_cost(econ, comp, x - w0) + _stint_cost(econ, nxt, w1 - x)
            lo, hi = max(w0 + 3, stop - 12), min(w1 - 3, stop + 12)
            if hi - lo < 4:
                continue
            per = {}
            for x in range(lo, hi + 1):
                if x in dead:
                    continue
                entry = {"d": round(cost(x) - cost(stop), 1)}
                rj = rejoin(num, x, stops)
                if rj:
                    entry["rejoin"] = rj
                per[str(x)] = entry
            windows.append({"stop": stop, "lo": lo, "hi": hi, "from": w0, "comp": comp, "next": nxt,
                            "deg": _tyre(econ, comp)["deg"], "laps": per})
        # windows never overlap: the next one opens after this one shuts
        for a, b in zip(windows, windows[1:]):
            if a["hi"] >= b["lo"]:
                a["hi"] = b["lo"] - 1
                a["laps"] = {k: v for k, v in a["laps"].items() if int(k) <= a["hi"]}
        info = s.drivers.get(num, {})
        seats.append({
            "name": seat["name"], "number": num, "team": seat["team"],
            "colour": info.get("team_colour", ""), "headshot": photo(info),
            "start": s.start_grid().get(num), "finish": seat["pos"], "margin": seat["margin"],
            "calls": calls,
            "windows": windows,
            "stints": [[st.get("compound"), st["lap_start"], st.get("lap_end")] for st in stints],
        })

    if not seats:
        target.unlink(missing_ok=True)
        print(f"{slug}: no game (no seat the model can score)")
        return
    out = {"session": "Race", "laps": total, "economics": econ, "ladder": ladder,
           "seats": sorted(seats, key=lambda x: x["finish"])}
    target.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{slug}: {len(seats)} seats ({', '.join(x['name'] for x in out['seats'])}); "
          f"rejoin check {checks - off}/{checks} within a place")


if __name__ == "__main__":
    for slug in sys.argv[1:]:
        run(slug)
