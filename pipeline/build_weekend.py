"""
Builds the whole Grand Prix weekend from the cached sessions.

  data/<slug>/weekend.json          the hub: sessions and their headlines
  data/<slug>/story_<session>.json  one deep story per session

Everyone gets the same, full analysis: no depth selector, no spoiler gate.
The detectors mine everything the feed carries -- sector times, the speed trap,
the gap to the car ahead, every flag, every stop -- so a race lands 20-30
moments and even a practice session has something honest to say.

Usage:  python build_weekend.py
"""
import json
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path
from statistics import mean, median

ROOT = Path(__file__).parent
CACHE = ROOT / "cache"
OUT = ROOT.parent / "data" / "silverstone-2026"

GP = {
    "slug": "silverstone-2026", "gp": "British Grand Prix 2026",
    "short": "British Grand Prix", "circuit": "Silverstone",
    "country": "Great Britain", "date": "05 JUL 2026", "laps": 52,
}

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


def fmt(seconds: float) -> str:
    m = int(seconds // 60)
    return f"{m}:{seconds - m * 60:06.3f}" if m else f"{seconds:.3f}"


def q_gap(r: dict) -> float | None:
    """In qualifying gap_to_leader is a list [Q1, Q2, Q3]."""
    g = r.get("gap_to_leader")
    if isinstance(g, list):
        vals = [x for x in g if isinstance(x, (int, float))]
        return vals[-1] if vals else None
    return g if isinstance(g, (int, float)) else None


class Session:
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
        self.intervals = load(skey, cache_name, "intervals")
        self.position = load(skey, cache_name, "position")
        self.grid = sorted(load(skey, cache_name, "starting_grid"),
                           key=lambda r: (r.get("position") or 99))
        self.total_laps = max((l.get("lap_number") or 0) for l in self.laps) if self.laps else 0
        starts: dict[int, list[datetime]] = defaultdict(list)
        for l in self.laps:
            ts = parse_ts(l.get("date_start"))
            if l.get("lap_number") and ts:
                starts[l["lap_number"]].append(ts)
        self.lap_index = sorted((ln, sorted(t)[len(t) // 2]) for ln, t in starts.items())

    # ---------- helpers ----------
    def name(self, num: int | None) -> str:
        d = self.drivers.get(num, {})
        return d.get("last_name") or d.get("name_acronym") or f"#{num}"

    def team(self, num: int | None) -> str:
        return self.drivers.get(num, {}).get("team_name", "")

    def lap_of(self, ts: datetime | None) -> int | None:
        if not ts:
            return None
        prev = None
        for ln, start in self.lap_index:
            if ts < start:
                return prev
            prev = ln
        return prev

    def timed_laps(self, num: int) -> list[dict]:
        return [l for l in self.laps
                if l.get("driver_number") == num and l.get("lap_duration")
                and not l.get("is_pit_out_lap")]

    @property
    def best_lap(self) -> dict | None:
        timed = [l for l in self.laps if l.get("lap_duration")]
        return min(timed, key=lambda l: l["lap_duration"]) if timed else None

    @property
    def dnfs(self) -> list[dict]:
        return [r for r in self.result if r.get("dnf")]

    @property
    def sc_laps(self) -> list[int]:
        return sorted({m["lap_number"] for m in self.rc
                       if "SAFETY CAR DEPLOYED" in (m.get("message") or "").upper()
                       and m.get("lap_number")})

    def messages(self, *needles: str) -> list[dict]:
        return [m for m in self.rc
                if any(n in (m.get("message") or "").upper() for n in needles)]

    def green_overtakes(self) -> list[tuple[int, dict]]:
        """Lap 1 and safety-car restarts are field shuffles, not passes."""
        sc = set(self.sc_laps)
        out = []
        for o in self.overtakes:
            ln = self.lap_of(parse_ts(o.get("date")))
            if ln and ln > 1 and not any(abs(ln - s) <= 2 for s in sc):
                out.append((ln, o))
        return out

    def speed_trap(self) -> tuple[int, int] | None:
        best = max((l for l in self.laps if l.get("st_speed")),
                   key=lambda l: l["st_speed"], default=None)
        return (best["driver_number"], int(best["st_speed"])) if best else None

    def sector_kings(self) -> list[tuple[str, str, float]]:
        out = []
        for i in (1, 2, 3):
            key = f"duration_sector_{i}"
            best = min((l for l in self.laps if l.get(key)),
                       key=lambda l: l[key], default=None)
            if best:
                out.append((f"Sector {i}", self.name(best["driver_number"]), best[key]))
        return out

    def battles(self, threshold: float = 1.0, min_samples: int = 25) -> list[tuple[int, int]]:
        """Drivers who sat within DRS range of the car ahead for a long stretch."""
        runs: dict[int, int] = Counter()
        current: dict[int, int] = defaultdict(int)
        for iv in sorted(self.intervals, key=lambda x: x.get("date") or ""):
            num, gap = iv.get("driver_number"), iv.get("interval")
            if isinstance(gap, (int, float)) and 0 < gap <= threshold:
                current[num] += 1
                runs[num] = max(runs[num], current[num])
            else:
                current[num] = 0
        return [(n, c) for n, c in runs.most_common(6) if c >= min_samples]

    def pace(self, num: int) -> float | None:
        """Median clean lap: a fairer read of pace than any single lap."""
        laps = [l["lap_duration"] for l in self.timed_laps(num)]
        return median(laps) if len(laps) >= 5 else None

    # ---------- freezing the race at a given lap ----------
    # Everything the interactive cards ask you to decide on has to be the real
    # state of the race at that moment, otherwise the question is a trick.

    def order_at_lap(self, lap: int) -> list[tuple[int, int]]:
        """[(position, driver)] as it stood on that lap."""
        latest: dict[int, int] = {}
        for p in sorted(self.position, key=lambda x: x.get("date") or ""):
            ln = self.lap_of(parse_ts(p.get("date")))
            if ln is not None and ln <= lap and p.get("position"):
                latest[p["driver_number"]] = p["position"]
        return sorted(((pos, num) for num, pos in latest.items()))

    def _interval_index(self) -> dict[int, list[tuple[int, float]]]:
        if getattr(self, "_iv_idx", None) is None:
            idx: dict[int, list[tuple[int, float]]] = defaultdict(list)
            for iv in sorted(self.intervals, key=lambda x: x.get("date") or ""):
                gap = iv.get("interval")
                if isinstance(gap, (int, float)):
                    ln = self.lap_of(parse_ts(iv.get("date")))
                    if ln is not None:
                        idx[iv["driver_number"]].append((ln, gap))
            self._iv_idx = idx
        return self._iv_idx

    def gap_at_lap(self, num: int, lap: int) -> float | None:
        """Gap to the car directly ahead, as of that lap."""
        vals = [g for ln, g in self._interval_index().get(num, []) if ln <= lap]
        return vals[-1] if vals else None

    def tyre_at_lap(self, num: int, lap: int) -> tuple[str | None, int | None]:
        for st in self.stints:
            if st.get("driver_number") != num:
                continue
            a, b = st.get("lap_start") or 0, st.get("lap_end") or 0
            if a <= lap <= b:
                return st.get("compound"), (st.get("tyre_age_at_start") or 0) + (lap - a)
        return None, None

    def pit_laps(self, num: int) -> list[int]:
        return sorted(p["lap_number"] for p in self.pits
                      if p.get("driver_number") == num and p.get("pit_duration")
                      and p.get("lap_number"))

    def finish_pos(self, num: int) -> int | None:
        return next((r.get("position") for r in self.result
                     if r["driver_number"] == num), None)

    def start_grid(self) -> dict[int, int]:
        """Where everybody started.

        Not every session publishes starting_grid, so when it is missing the
        first position each driver is given in the feed is the grid slot.
        """
        if self.grid:
            return {g["driver_number"]: g.get("position") for g in self.grid
                    if g.get("position")}
        first: dict[int, int] = {}
        for p in sorted(self.position, key=lambda x: x.get("date") or ""):
            if p.get("position") and p["driver_number"] not in first:
                first[p["driver_number"]] = p["position"]
        return first

    def stewards(self) -> list[dict]:
        """Incidents the stewards looked at, paired with the verdict they gave.

        Race control publishes the incident and the ruling as separate
        messages, so they are matched back by car number.
        """
        import re

        cases: list[dict] = []
        for m in self.rc:
            msg = (m.get("message") or "").upper()
            if "NOTED" not in msg or "INVESTIGATION" in msg:
                continue
            # race control always writes cars as "63 (RUS)"
            cars = [int(n) for n in re.findall(r"(\d+) \([A-Z]{3}\)", msg)]
            if not cars:
                continue
            lap = m.get("lap_number") or 0
            head, _, tail = msg.partition("NOTED")
            # the trailing "(15:57:46)" is a clock stamp, not part of the offence
            reason = re.sub(r"\(\d{2}:\d{2}:\d{2}\)", "", tail).strip(" -")
            where = head.split("INCIDENT")[0].strip() if "INCIDENT" in head else ""
            verdict, secs = "NO ACTION", 0
            for v in self.rc:
                vm = (v.get("message") or "").upper()
                if (v.get("lap_number") or 0) < lap or "STEWARDS" not in vm:
                    continue
                if not any(f"CAR {c}" in vm for c in cars):
                    continue
                pen = re.search(r"(\d+) SECOND TIME PENALTY", vm)
                if pen and "SERVED" not in vm:
                    verdict, secs = f"{pen.group(1)}S PENALTY", int(pen.group(1))
                    break
                if "NO FURTHER" in vm:
                    verdict, secs = "NO ACTION", 0
                    break
            cases.append({"lap": lap, "cars": cars, "where": where.title(),
                          "reason": reason.title(), "verdict": verdict, "secs": secs,
                          "raw": (m.get("message") or "")})
        return cases


# ------------------------------------------------------------- predictions
# Called before the fact or they are worth nothing, so each one is anchored a
# few laps ahead of the card that gives it away. Three per race, always with a
# right answer, which is what separates them from the decision cards.

def prediction_cards(s: Session) -> list[dict]:
    if not s.result:
        return []
    out: list[dict] = []
    add = out.append
    grid_pos = s.start_grid()
    finishers = [r["driver_number"] for r in s.result if not r.get("dnf")]

    def decoys(right: int, n: int = 2) -> list[int]:
        """Plausible wrong answers: drivers who finished near the front."""
        return [d for d in finishers if d != right][:n]

    def options(nums: list[int]) -> list[str]:
        # sorted by car number so the right answer is not always in slot one
        return [s.name(n) for n in sorted(nums)]

    # --- the climb: asked on lap 2, answered at the flag
    gains = [((grid_pos.get(r["driver_number"]) or 99) - (r.get("position") or 99),
              r["driver_number"]) for r in s.result
             if not r.get("dnf") and grid_pos.get(r["driver_number"])]
    if gains:
        climb, num = max(gains)
        start, end = grid_pos[num], s.finish_pos(num)
        if climb > 1 and start and end:
            band = ("On the podium" if end <= 3 else
                    "Somewhere in the points" if end <= 10 else "Out of the points")
            add({"type": "prediction", "lap": 2,
                 "kicker": "Call it before it happens",
                 "title": f"{s.name(num)} starts P{start}. Where does he finish?",
                 "text": "He is in a car that belongs further up the road than this, "
                         "and he has the whole afternoon to prove it.",
                 "options": ["On the podium", "Somewhere in the points",
                             "Out of the points"],
                 "answer": band,
                 "reveal": f"P{start} to P{end}, {climb} places, and almost none of it "
                           "on television. This is the drive nobody will talk about "
                           "on Monday."})

    # --- the fastest lap: asked well before it lands
    best = s.best_lap
    if best and len(finishers) >= 3:
        right = best["driver_number"]
        lap_of_best = best.get("lap_number") or s.total_laps
        add({"type": "prediction", "lap": max(2, int(lap_of_best * 0.55)),
             "kicker": "Call it before it happens",
             "title": "Who has the fastest lap on the board at the flag?",
             "text": "It almost always lands late, when the car is light and the track "
                     "has rubber all over it, and it is worth a point to whoever "
                     "finishes in the top ten.",
             "options": options([right] + decoys(right)),
             "answer": s.name(right),
             "reveal": f"{s.name(right)} on lap {lap_of_best}, {fmt(best['lap_duration'])}, "
                       f"in a {s.team(right)}."})

    # --- somebody stops: asked before the car actually lets go
    if s.dnfs and len(finishers) >= 2:
        r = s.dnfs[0]
        num = r["driver_number"]
        out_lap = max((l.get("lap_number") or 0) for l in s.laps
                      if l.get("driver_number") == num) or 0
        if out_lap > 5:
            add({"type": "prediction", "lap": max(2, out_lap - 5),
                 "kicker": "Call it before it happens",
                 "title": "One of these three does not see the chequered flag. Who?",
                 "text": "Nothing on the timing screens says it is coming. That is "
                         "rather the point of mechanical failure.",
                 "options": options([num] + decoys(num)),
                 "answer": s.name(num),
                 "reveal": f"{s.name(num)}, on lap {out_lap} of {s.total_laps}, the "
                           f"{s.team(num)} car stopping without warning."})

    return out


# -------------------------------------------------------- you make the call
# The recap is not a documentary. At the real forks of the race it stops and
# hands the decision to the reader, with the same information the pit wall had
# and no more. Every state on these cards is read from the data, never invented.

def decision_cards(s: Session) -> list[dict]:
    out: list[dict] = []
    add = out.append

    # --- the stewards' seat: a real incident, judged before the verdict shows
    cases = [c for c in s.stewards() if c["lap"]]
    if cases:
        # the juiciest case is the one involving two cars up at the sharp end
        def juice(c: dict) -> tuple:
            pos = min((s.finish_pos(n) or 99) for n in c["cars"])
            return (-len(c["cars"]), pos)

        c = sorted(cases, key=juice)[0]
        who = " and ".join(s.name(n) for n in c["cars"])
        where = f" at {c['where'].title()}" if c["where"] else ""
        if len(c["cars"]) >= 2:
            headline = f"contact between {who}{where}"
            reported = f"Incident{where}, {len(c['cars'])} cars"
        else:
            headline = f"{(c['reason'] or 'an incident').lower()}, {who}"
            reported = (c["reason"] or "Incident").title()
        add({"type": "decision", "lap": c["lap"], "kicker": "You are the steward",
             "title": f"Lap {c['lap']}: {headline}. What do you give?",
             "text": "Race control has flagged it and the whole thing lands on your "
                     "desk while the cars keep circulating. Same call the stewards "
                     "had to make, same three seconds to think about it.",
             "state": [["Lap", f"{c['lap']} of {s.total_laps}"],
                       ["Cars involved", who],
                       ["Reported as", reported]],
             "choices": [
                 {"id": "none", "label": "No further action",
                  "sub": "Racing incident, let them race"},
                 {"id": "5", "label": "5 second penalty", "sub": "Mild advantage gained"},
                 {"id": "10", "label": "10 second penalty", "sub": "Clearly at fault"}],
             "actual": {"NO ACTION": "none", "5S PENALTY": "5",
                        "10S PENALTY": "10"}.get(c["verdict"], "none"),
             "outcomes": {
                 "none": "You let it go. Nobody loses a place at a desk, and the "
                         "driver behind spends the rest of the afternoon on the radio.",
                 "5": "Five seconds gets added at the next stop, or to the final time "
                      "if they never stop again. Usually one position, sometimes none.",
                 "10": "Ten seconds is a real punishment and it almost always costs "
                       "track position, which is why teams argue so hard about it."},
             "reveal": f"The stewards went with {c['verdict'].lower()}."
                       + (f" {s.name(c['cars'][0])} served it and still finished "
                          f"P{s.finish_pos(c['cars'][0])}."
                          if c["secs"] and s.finish_pos(c["cars"][0]) else "")})

    # --- the safety car gamble: the biggest free lottery in the sport
    for sc in s.sc_laps[:1]:
        left = s.total_laps - sc
        if left < 1:
            continue
        order = s.order_at_lap(sc)
        if not order:
            continue
        leader = order[0][1]
        comp, age = s.tyre_at_lap(leader, sc)
        boxed = [n for _, n in order[:6] if any(abs(p - sc) <= 1 for p in s.pit_laps(n))]
        add({"type": "decision", "lap": sc, "kicker": "Your call on the pit wall",
             "title": f"Safety car with {left} laps left. You are leading. Box or stay out?",
             "text": "The pack is bunched up behind you and a stop costs you far less "
                     "than usual, except that everybody behind can copy you and the "
                     "one who does not gets the lead.",
             "state": [["Running", f"P1, {s.name(leader)}"],
                       ["Laps left", str(left)],
                       ["Tyres", f"{(comp or 'unknown').title()}, {age} laps old"
                                 if age is not None else (comp or "unknown").title()],
                       ["Gap to P2", "Wiped out by the safety car"]],
             "choices": [
                 {"id": "box", "label": "Box for fresh tyres",
                  "sub": "Grip for the restart, hand over track position"},
                 {"id": "stay", "label": "Stay out and defend",
                  "sub": "Keep the lead on tyres that are done"}],
             "actual": "box" if leader in boxed else "stay",
             "outcomes": {
                 "box": "New rubber under a safety car is close to free, and it only "
                        "works if the cars behind stay out. If they all follow you in, "
                        "you have spent your lead for nothing.",
                 "stay": "You keep the lead and you restart on tyres with nothing left, "
                         "with a queue of fresher cars in your mirrors and no gap to "
                         "hide in."},
             "reveal": (f"{s.name(leader)} came in. " if leader in boxed
                        else f"{s.name(leader)} stayed out. ")
                       + f"At the flag it was "
                       + ", ".join(f"P{r['position']} {s.name(r['driver_number'])}"
                                   for r in s.result[:3]) + "."})

    # --- the undercut: the quiet decision that decides most modern races
    real_pits = [p for p in s.pits if p.get("pit_duration") and p.get("lap_number")]
    if real_pits and s.position:
        window = int(median(p["lap_number"] for p in real_pits))
        order = s.order_at_lap(window)
        pair = None
        for i in range(1, min(6, len(order))):
            chaser, ahead = order[i][1], order[i - 1][1]
            gap = s.gap_at_lap(chaser, window)
            if gap and gap <= 3.0:
                pair = (chaser, ahead, gap)
                break
        if pair:
            chaser, ahead, gap = pair
            chaser_pos = next(p for p, n in order if n == chaser)
            comp, age = s.tyre_at_lap(chaser, window)
            pit_loss = median(p["pit_duration"] for p in real_pits)
            stops = s.pit_laps(chaser)
            next_stop = next((p for p in stops if p >= window), None)
            add({"type": "decision", "lap": window, "kicker": "Your call on the pit wall",
                 "title": f"You are {s.name(chaser)}, {gap:.1f}s behind "
                          f"{s.name(ahead)} and going nowhere. Now what?",
                 "text": "Stuck in dirty air your tyres cook and your car will not turn. "
                         "Stopping first gives you clean track for two or three laps, "
                         "which is the whole trick behind the undercut.",
                 "state": [["Running", f"P{chaser_pos}"],
                           ["Gap ahead", f"{gap:.1f}s to {s.name(ahead)}"],
                           ["Tyres", f"{(comp or 'unknown').title()}, {age} laps old"
                                     if age is not None else (comp or "unknown").title()],
                           ["Pit lane costs", f"about {pit_loss:.0f}s today"]],
                 "choices": [
                     {"id": "box", "label": "Box now and undercut",
                      "sub": "Fresh tyres, clean air, two laps to make it pay"},
                     {"id": "wait", "label": "Stay out and overcut",
                      "sub": "Let him stop first, then push on an empty track"},
                     {"id": "attack", "label": "Forget strategy, pass him",
                      "sub": "Send it and take the risk"}],
                 "actual": "box" if next_stop and next_stop <= window + 2 else "wait",
                 "outcomes": {
                     "box": f"You lose about {pit_loss:.0f}s in the lane and come out in "
                            "traffic, betting that two fast laps on new tyres are worth "
                            "more than the place you just gave up.",
                     "wait": "You stay on old rubber while he gets new ones, and you need "
                             "clean air plus a mistake from him to make it work.",
                     "attack": "Passing a car with the same tyres on the same fuel is the "
                               "hardest thing in the sport, and running into the back of "
                               "him ends both afternoons."},
                 "reveal": (f"{s.name(chaser)} came in on lap {next_stop}, "
                            f"{next_stop - window} lap"
                            f"{'s' if next_stop - window != 1 else ''} after this."
                            if next_stop else
                            f"{s.name(chaser)} never stopped again from here.")
                           + f" He finished P{s.finish_pos(chaser)}"
                           + (f", {s.name(ahead)} P{s.finish_pos(ahead)}."
                              if s.finish_pos(ahead) else ".")})

    # --- what if: the counterfactual you cannot look up anywhere
    if s.dnfs:
        r = s.dnfs[0]
        num = r["driver_number"]
        out_lap = max((l.get("lap_number") or 0) for l in s.laps
                      if l.get("driver_number") == num) or 0
        order = s.order_at_lap(max(1, out_lap - 1))
        was = next((p for p, n in order if n == num), None)
        his = s.pace(num)
        rivals = [(s.pace(x["driver_number"]), x["driver_number"]) for x in s.result[:5]
                  if s.pace(x["driver_number"]) and x["driver_number"] != num]
        beaten = [n for t, n in rivals if his and t > his]
        winner_num = s.result[0]["driver_number"]
        winner_pace = s.pace(winner_num)
        win_delta = (his - winner_pace) if (his and winner_pace) else None
        if was and his:
            add({"type": "decision", "lap": out_lap, "kicker": "What if",
                 "title": f"{s.name(num)} was running P{was} when the car gave up. "
                          "Where does he finish if it holds together?",
                 "text": "Nobody can answer this one for certain, which is exactly why "
                         "it is still being argued about. You have his own lap times to "
                         "go on and nothing else.",
                 "state": [["Out on lap", f"{out_lap} of {s.total_laps}"],
                           ["Running", f"P{was}"],
                           ["His median lap", fmt(his)],
                           ["Quicker than", f"{len(beaten)} of the eventual top five"]],
                 "choices": [
                     {"id": "win", "label": "He wins it", "sub": "Pace was there"},
                     {"id": "podium", "label": "Podium, not the win",
                      "sub": "Close, but the leader had it covered"},
                     {"id": "midfield", "label": "Swallowed by the pack",
                      "sub": "Traffic and tyres get him anyway"}],
                 "actual": "",
                 "outcomes": {
                     "win": "For this to happen he needs the leader to have nothing left, "
                            "and leaders rarely do.",
                     "podium": "The safe read, and the boring one. Track position plus "
                               "his pace usually lands you here.",
                     "midfield": "It takes one bad restart or one long stint to fall "
                                 "through the field, and it happens more than people think."},
                 "reveal": (
                     f"Our read from his own lap times, not a fact. "
                     + (f"He was lapping {abs(win_delta):.2f}s a lap "
                        f"{'quicker' if win_delta < 0 else 'slower'} than "
                        f"{s.name(winner_num)}, who went on to win it, "
                        if win_delta is not None else "")
                     + f"and he was ahead of {len(beaten)} of the five drivers who "
                       f"ended up at the front. Take {out_lap} laps of that and P"
                       f"{max(1, was - 1) if win_delta is not None and win_delta < 0 else was}"
                       " is the honest guess. The car had other ideas and nobody gets "
                       "to check.")})

    # --- guess the number: the margin nobody ever remembers right
    if len(s.result) > 1:
        gap = q_gap(s.result[1])
        if gap:
            # the slider has to be winnable: a 0.4s answer inside a 0-30s range is
            # a lottery, so the scale follows the size of the real margin
            top = max(2.0, round(gap * 4, 1))
            step = 0.05 if top <= 5 else (0.1 if top <= 20 else 0.5)
            lane = median(p["pit_duration"] for p in s.pits
                          if p.get("pit_duration")) if s.pits else None
            add({"type": "guess", "lap": s.total_laps, "kicker": "Guess it",
                 "title": f"How far behind was {s.name(s.result[1]['driver_number'])} "
                          "at the flag?",
                 "text": f"{s.total_laps} laps, the best part of two hours of racing, "
                         "and the whole thing comes down to this one number.",
                 "unit": "s", "min": 0, "max": top, "step": step,
                 "target": round(gap, 3), "close": max(0.3, gap * 0.4),
                 "reveal": f"{gap:.3f} seconds after {s.total_laps} laps."
                           + (f" A single trip down the pit lane costs about {lane:.0f}s "
                              f"today, which is {lane / gap:.0f} times the margin this "
                              "race was decided by."
                              if lane and gap else "")})

    return out


# ------------------------------------------------------------- the mate
# The cards are the museum. This is the friend who watched it and is texting
# you about it, and who will answer whatever you want to ask him. Every number
# he uses comes from the same data as the cards, so he can be casual without
# being wrong.

def mate_thread(s: Session) -> dict:
    beats: list[dict] = []
    add = beats.append
    green = s.green_overtakes()
    winner = s.result[0]["driver_number"] if s.result else None

    add({"lap": 0,
         "msgs": ["yo", "you missed a good one honestly",
                  f"{s.total_laps} laps, {len(green)} proper overtakes and "
                  + (f"{len(s.sc_laps)} safety car"
                     f"{'s' if len(s.sc_laps) > 1 else ''}"
                     if s.sc_laps else "no safety car")],
         "asks": [
             {"q": "just tell me who won", "a": [
                 f"{s.name(winner)} 🏆" if winner else "nobody, weirdly",
                 f"{s.team(winner)}. and he did it the boring way, out front and gone"
                 if winner else ""]},
             {"q": "was it actually good or are you being nice", "a": [
                 "bit of both lol",
                 f"the racing in the midfield was mental, {len(green)} passes, "
                 "the front was quieter"]},
             {"q": "i know nothing about f1, start there", "a": [
                 "ok so 20 cars, everyone starts in the order they qualified on saturday",
                 "everyone has to stop at least once to change tyres, and that stop "
                 "costs you about 25 seconds",
                 "the whole sport is basically deciding WHEN to lose those 25 seconds"]}]})

    lap1 = [o for o in s.overtakes if s.lap_of(parse_ts(o.get("date"))) in (None, 1)]
    add({"lap": 1,
         "msgs": ["lights out and it was chaos immediately",
                  f"{len(lap1)} position changes before they even finished lap 1"],
         "asks": [
             {"q": "why is the start always so mad", "a": [
                 "cold tyres, cold brakes, full fuel tank and 20 people who all think "
                 "they can make the same gap work",
                 "it's the only moment of the race where everyone is genuinely equal"]},
             {"q": "does the start decide the race", "a": [
                 "more than anyone admits",
                 "track position is everything on most circuits, you lose 3 places on "
                 "lap 1 and you spend the next hour stuck behind someone slower"]}]})

    if green:
        lap, n = Counter(ln for ln, _ in green).most_common(1)[0]
        add({"lap": lap,
             "msgs": [f"lap {lap} was the busiest of the whole race",
                      f"{n} overtakes on that lap alone, everyone woke up at once"],
             "asks": [
                 {"q": "why do they all overtake at the same time", "a": [
                     "because they all pitted around the same time",
                     "you come out on new tyres next to someone on old ones and it's "
                     "basically a free pass. it stacks up"]},
                 {"q": "what's DRS", "a": [
                     "a flap on the rear wing that opens on the straights and makes the "
                     "car faster",
                     "you only get it if you're within a second of the car ahead at a "
                     "certain point. it's an artificial help to make passing possible",
                     "purists hate it. i'm fine with it, the alternative was processions"]}]})

    if s.sc_laps:
        sc = s.sc_laps[0]
        add({"lap": sc,
             "msgs": [f"SAFETY CAR on lap {sc}", "and there goes the whole race",
                      f"{s.total_laps - sc} laps left and every gap just got deleted"],
             "asks": [
                 {"q": "explain safety car like i'm five", "a": [
                     "something's on track that shouldn't be, so a road car comes out "
                     "and everyone has to queue up behind it at half speed",
                     "if you'd built a 20 second lead, congrats, it's gone. the guy in "
                     "P2 is now right behind you",
                     "it's the most unfair thing in the sport and also the best thing "
                     "that happens to a boring race"]},
                 {"q": "so is pitting under it free", "a": [
                     "close to it. everyone's going slow so you lose way less time in "
                     "the pit lane",
                     "the catch is everyone behind you can do the same thing, and "
                     "whoever doesn't follow you inherits the lead"]}]})

    real_pits = [p for p in s.pits if p.get("pit_duration") and p.get("lap_number")]
    if real_pits:
        window = int(median(p["lap_number"] for p in real_pits))
        add({"lap": window,
             "msgs": ["this is where it actually got decided btw",
                      "not a single overtake involved, just people stopping at "
                      "different times"],
             "asks": [
                 {"q": "why not just stop early every time", "a": [
                     "new tyres are quick for about 3 laps, then they start going off",
                     "stop too early and you're on dead rubber at the end with everyone "
                     "hunting you. stop too late and someone's already jumped you"]},
                 {"q": "what's an undercut", "a": [
                     "you pit before the guy ahead, do two really fast laps on new "
                     "tyres while he's still out there on old ones",
                     "when he finally stops he comes out behind you. you never passed "
                     "him on track, you passed him in the pit lane"]}]})

    if s.dnfs:
        r = s.dnfs[0]
        num = r["driver_number"]
        out_lap = max((l.get("lap_number") or 0) for l in s.laps
                      if l.get("driver_number") == num) or 0
        add({"lap": out_lap,
             "msgs": [f"and {s.name(num)} is out", f"lap {out_lap}, car just stopped",
                      "you could hear the team on the radio, brutal"],
             "asks": [
                 {"q": "what actually broke", "a": [
                     "honestly not sure, they never say on the day",
                     "the data only tells me he stopped, not why. teams sit on that "
                     "stuff for weeks"]},
                 {"q": "does he get any points", "a": [
                     "nope. you have to finish, and you have to be in the top 10",
                     f"zero points on a weekend like this is how championships quietly "
                     "get lost"]}]})

    best = s.best_lap
    if best:
        add({"lap": best.get("lap_number") or s.total_laps - 1,
             "msgs": [f"fastest lap of the race went to {s.name(best['driver_number'])}",
                      fmt(best["lap_duration"])],
             "asks": [
                 {"q": "is fastest lap worth anything", "a": [
                     "one point, and only if you finish top 10",
                     "so at the end you get people pitting for fresh tyres just to nick "
                     "it. it's a bit silly and i love it"]},
                 {"q": "why is it always at the end", "a": [
                     "car's light, almost no fuel left, and the track has rubber all "
                     "over it by then",
                     "a lap 1 time and a lap 50 time are basically different sports"]}]})

    if s.result:
        top = s.result[:3]
        add({"lap": s.total_laps,
             "msgs": ["chequered flag",
                      " · ".join(f"P{r['position']} {s.name(r['driver_number'])}"
                                 for r in top),
                      "go watch the last 5 laps at least, they were worth it"],
             "asks": [
                 {"q": "was the winner just in the fastest car", "a": [
                     "partly, always. but look at the median lap times, that's the "
                     "honest read on who had the pace",
                     "the card above with the true pace ranking is the one i'd trust"]},
                 {"q": "when's the next one", "a": [
                     "two weeks, they almost never race back to back",
                     "and the teams bring upgrades between races so the order can just "
                     "change completely. that's why nobody can predict this sport"]}]})

    return {"session": s.label, "beats": beats}


# ------------------------------------------------------------------ race
def race_story(s: Session) -> list[dict]:
    if not s.result:
        return []
    cards: list[dict] = []
    green = s.green_overtakes()
    ov_by_driver = Counter(o["overtaking_driver_number"] for _, o in green)
    grid_pos = s.start_grid()
    winner = s.result[0]
    add = cards.append

    add({"type": "cover", "lap": 0,
         "kicker": f"{GP['short']} · {s.label} · {s.total_laps} laps",
         "title": "Everything that happened, in order",
         "text": f"{len(green)} on-track passes, {len(s.pits)} pit stops, "
                 f"{len(s.dnfs)} cars that never finished"
                 + (f" and {len(s.sc_laps)} safety car"
                    f"{'s' if len(s.sc_laps) > 1 else ''}." if s.sc_laps else ".")})

    # --- the start ---
    lap1 = [o for o in s.overtakes if s.lap_of(parse_ts(o.get("date"))) in (None, 1)]
    add({"type": "moment", "lap": 1, "kicker": "Lap 1 · Lights out",
         "title": f"{len(lap1)} places changed hands before the first lap was done",
         "text": "Twenty cars funnelling into the first corner on cold tyres. "
                 "Most of this is the pack sorting itself out, and some of it "
                 "decides the afternoon."})

    # --- busiest green-flag laps ---
    for lap, n in Counter(ln for ln, _ in green).most_common(3):
        movers = Counter(o["overtaking_driver_number"] for ln, o in green if ln == lap)
        add({"type": "moment", "lap": lap, "kicker": f"Lap {lap} · Traffic",
             "title": f"{n} overtakes on this lap alone",
             "text": "The pack compressed and everyone had a go: "
                     + ", ".join(s.name(num) for num, _ in movers.most_common(3)) + ".",
             "dato": {"label": f"Passes on lap {lap}",
                      "rows": [[s.name(num), c] for num, c in movers.most_common()]}})

    # --- fights for the lead ---
    lead = [(ln, o) for ln, o in green if (o.get("position") or 99) == 1]
    if lead:
        ln, o = lead[0]
        add({"type": "moment", "lap": ln, "kicker": f"Lap {ln} · For the lead",
             "title": f"{s.name(o['overtaking_driver_number'])} takes the lead from "
                      f"{s.name(o['overtaken_driver_number'])}",
             "text": f"The lead changed hands {len(lead)} time"
                     f"{'s' if len(lead) > 1 else ''} on track today, which is "
                     "rarer than it sounds."})

    # --- the busiest driver ---
    if ov_by_driver:
        num, n = ov_by_driver.most_common(1)[0]
        add({"type": "moment", "lap": max(2, s.total_laps // 3),
             "kicker": "The one doing the passing",
             "title": f"{s.name(num)}: {n} overtakes",
             "text": f"More than anybody else out there, in a {s.team(num)}.",
             "dato": {"label": "Most overtakes",
                      "rows": [[s.name(d), c] for d, c in ov_by_driver.most_common(6)]}})

    # --- battles that never resolved ---
    stuck = s.battles()
    if stuck:
        add({"type": "moment", "lap": max(2, int(s.total_laps * 0.55)),
             "kicker": "Stuck within a second",
             "title": f"{s.name(stuck[0][0])} spent the race in somebody's mirrors",
             "text": "Close enough for DRS for long stretches and still no way "
                     "through. This is what modern F1 traffic actually looks like, "
                     "and it happened to "
                     + (f"{len(stuck)} drivers today." if len(stuck) > 1 else "him alone today."),
             "dato": {"label": "Longest spells within a second",
                      "rows": [[s.name(n), f"{c} samples"] for n, c in stuck]}})

    # --- pit strategy ---
    real_pits = [p for p in s.pits if p.get("pit_duration")]
    if real_pits:
        window = int(median(p["lap_number"] for p in real_pits if p.get("lap_number")))
        fastest = min(real_pits, key=lambda p: p["pit_duration"])
        by_lap = Counter(p["lap_number"] for p in real_pits)
        busiest_lap, busiest_n = by_lap.most_common(1)[0]
        add({"type": "moment", "lap": window, "kicker": f"Lap {window} · Pit window",
             "title": f"{len(real_pits)} stops, and the busiest lap saw {busiest_n} of them",
             "text": f"Once one car blinks, everybody has to answer. The quickest "
                     f"trip down the lane belonged to {s.name(fastest['driver_number'])} "
                     f"at {fastest['pit_duration']:.1f}s.",
             "dato": {"label": "Stops per lap",
                      "rows": [[f"Lap {l}", c] for l, c in sorted(by_lap.items())[:8]]}})

        stops_per_driver = Counter(p["driver_number"] for p in real_pits)
        odd = [n for n, c in stops_per_driver.items() if c >= 3]
        if odd:
            add({"type": "moment", "lap": window + 4, "kicker": "Off the script",
                 "title": f"{s.name(odd[0])} stopped {stops_per_driver[odd[0]]} times",
                 "text": "Three stops when the field is doing one or two means "
                         "something went wrong, or somebody gambled."})

    # --- tyres ---
    if s.stints:
        compounds = Counter(st.get("compound") for st in s.stints if st.get("compound"))
        longest = max(s.stints, key=lambda st: (st.get("lap_end") or 0) - (st.get("lap_start") or 0))
        span = (longest.get("lap_end") or 0) - (longest.get("lap_start") or 0)
        add({"type": "moment", "lap": longest.get("lap_end") or s.total_laps // 2,
             "kicker": "Tyres", "title": f"{s.name(longest['driver_number'])} nursed one "
                                         f"set for {span} laps",
             "text": f"On the {(longest.get('compound') or '').lower()}s. Every lap you "
                     "stretch is a lap you do not lose in the pits, until the rubber "
                     "gives up.",
             "dato": {"label": "Stints by compound",
                      "rows": [[c, n] for c, n in compounds.most_common()]}})

    # --- safety cars ---
    for lap in s.sc_laps:
        ended = next((m["lap_number"] for m in s.messages("SAFETY CAR IN THIS LAP")
                      if (m.get("lap_number") or 0) >= lap), None)
        add({"type": "moment", "lap": lap,
             "kicker": f"Lap {lap} of {s.total_laps} · Safety Car",
             "title": "Every gap on track, erased",
             "text": (f"Neutralised until lap {ended}. " if ended else "")
                     + "Whatever anybody had built up to here was wiped out, and the "
                       "race restarted nose to tail."})

    # --- flags and stewards ---
    yellows = [m for m in s.rc if m.get("flag") in ("YELLOW", "DOUBLE YELLOW")]
    if yellows:
        sectors = Counter(m.get("message", "").split("SECTOR")[-1].strip()
                          for m in yellows if "SECTOR" in (m.get("message") or ""))
        add({"type": "moment", "lap": yellows[len(yellows) // 2].get("lap_number") or 1,
             "kicker": "Yellow flags", "title": f"{len(yellows)} yellow flag calls",
             "text": "Debris, spins and cars parked in dangerous places. Every one "
                     "of them costs lap time to whoever is unlucky enough to arrive.",
             "dato": {"label": "Most affected sectors",
                      "rows": [[f"Sector {k}", v] for k, v in sectors.most_common(4) if k]}})

    blues = [m for m in s.rc if m.get("flag") == "BLUE"]
    if len(blues) > 20:
        add({"type": "moment", "lap": int(s.total_laps * 0.6), "kicker": "Blue flags",
             "title": f"{len(blues)} blue flags waved",
             "text": "That is how often a backmarker had to move aside. Lapped "
                     "traffic decides more races than anybody admits."})

    investigations = s.messages("INVESTIGATION", "NOTED")
    if investigations:
        add({"type": "moment", "lap": investigations[0].get("lap_number") or s.total_laps,
             "kicker": "Stewards", "title": f"{len(investigations)} incidents looked at",
             "text": (investigations[0].get("message") or "").title() + ".",
             "dato": {"label": "Under investigation",
                      "rows": [[f"Lap {m.get('lap_number') or '-'}",
                                (m.get("message") or "")[:44]] for m in investigations[:5]]}})

    penalties = s.messages("PENALTY")
    if penalties:
        add({"type": "moment", "lap": penalties[0].get("lap_number") or s.total_laps,
             "kicker": "Penalties", "title": f"{len(penalties)} penalty calls",
             "text": "Time added, places lost, and in some cases a result rewritten "
                     "after the flag."})

    deleted = s.messages("DELETED")
    if deleted:
        add({"type": "moment", "lap": deleted[0].get("lap_number") or 1,
             "kicker": "Track limits", "title": f"{len(deleted)} lap times deleted",
             "text": "The white line is the track. Run wide and the lap simply "
                     "stops counting."})

    # --- retirements ---
    for r in s.dnfs:
        num = r["driver_number"]
        out_lap = max((l.get("lap_number") or 0) for l in s.laps
                      if l.get("driver_number") == num) or 0
        add({"type": "moment", "lap": out_lap, "kicker": f"Lap {out_lap} · Retirement",
             "title": f"{s.name(num)} is out",
             "text": f"The {s.team(num)} stops after {out_lap} laps. "
                     "Zero points weekends are where title fights quietly bleed."})

    # --- pace and speed ---
    best = s.best_lap
    if best:
        add({"type": "moment", "lap": best.get("lap_number"),
             "kicker": f"Lap {best.get('lap_number')} · Fastest lap",
             "title": f"{s.name(best['driver_number'])}: {fmt(best['lap_duration'])}",
             "text": f"The quickest anybody went all afternoon, in a "
                     f"{s.team(best['driver_number'])}.",
             "dato": {"label": "Best sector times",
                      "rows": [[f"{sec} · {who}", f"{t:.3f}s"]
                               for sec, who, t in s.sector_kings()]}})

    trap = s.speed_trap()
    if trap:
        add({"type": "moment", "lap": int(s.total_laps * 0.45), "kicker": "Speed trap",
             "title": f"{s.name(trap[0])} hit {trap[1]} km/h",
             "text": "Top speed says as much about wing level and tow as it does "
                     "about the engine."})

    # --- pace ranking, the honest one ---
    ranked = sorted(((s.pace(r["driver_number"]), r["driver_number"])
                     for r in s.result if s.pace(r["driver_number"])), key=lambda x: x[0])
    if len(ranked) >= 5:
        add({"type": "moment", "lap": int(s.total_laps * 0.7), "kicker": "True pace",
             "title": f"{s.name(ranked[0][1])} had the quickest car underneath him",
             "text": "Ranked on median clean lap, which strips out traffic, safety "
                     "cars and one-off heroics. It does not always match the result.",
             "dato": {"label": "Median clean lap",
                      "rows": [[s.name(n), fmt(t)] for t, n in ranked[:6]]}})

    # --- movers ---
    gains = [((grid_pos.get(r["driver_number"]) or 99) - (r.get("position") or 99),
              r["driver_number"]) for r in s.result
             if not r.get("dnf") and grid_pos.get(r["driver_number"])]
    if gains:
        climb, num = max(gains)
        if climb > 1:
            add({"type": "moment", "lap": max(2, s.total_laps - 4),
                 "kicker": "The drive nobody talked about",
                 "title": f"{s.name(num)}: P{grid_pos[num]} on the grid, "
                          f"P{next(r.get('position') for r in s.result if r['driver_number'] == num)} at the flag",
                 "text": f"{climb} places gained, one pass at a time, most of them "
                         "nowhere near a TV camera."})
        drop, dnum = min(gains)
        if drop < -1:
            add({"type": "moment", "lap": max(3, s.total_laps - 6), "kicker": "Backwards",
                 "title": f"{s.name(dnum)} went the other way: {abs(drop)} places lost",
                 "text": "Strategy, damage or simply a car that would not do what it "
                         "did on Saturday."})

    # --- weather ---
    if s.weather:
        track = [w["track_temperature"] for w in s.weather if w.get("track_temperature")]
        air = [w["air_temperature"] for w in s.weather if w.get("air_temperature")]
        if track:
            add({"type": "moment", "lap": int(s.total_laps * 0.3), "kicker": "Conditions",
                 "title": f"Track at {max(track):.0f}°C, and falling to {min(track):.0f}°C",
                 "text": "Hot tarmac punishes tyres and rewards whoever is gentlest "
                         "with them. As it cools, the picture flips."
                         + (" It stayed dry." if not any(w.get("rainfall") for w in s.weather) else ""),
                 "dato": {"label": "Conditions",
                          "rows": [["Track temp", f"{min(track):.0f}-{max(track):.0f} °C"],
                                   ["Air temp", f"{min(air):.0f}-{max(air):.0f} °C" if air else "-"],
                                   ["Rain", "Yes" if any(w.get("rainfall") for w in s.weather) else "No"]]}})

    # --- the flag ---
    podium = s.result[:3]
    add({"type": "moment", "lap": s.total_laps, "kicker": "Chequered flag",
         "title": f"{s.name(winner['driver_number'])} wins it",
         "text": " · ".join(f"P{r['position']} {s.name(r['driver_number'])}" for r in podium)
                 + f". {s.name(podium[1]['driver_number'])} finished "
                   f"{q_gap(podium[1]) or 0:.3f}s behind." if len(podium) > 1 else "",
         "dato": {"label": "Points scored",
                  "rows": [[s.name(r["driver_number"]), f"{r.get('points') or 0:.0f}"]
                           for r in s.result[:10]]}})

    head = [c for c in cards if c["type"] == "cover"]
    body = sorted([c for c in cards if c["type"] == "moment"]
                  + prediction_cards(s) + decision_cards(s),
                  key=lambda c: c.get("lap") or 0)
    return head + body


# ------------------------------------------------------------------ quali
def quali_story(s: Session) -> list[dict]:
    if not s.result:
        return []
    cards: list[dict] = []
    add = cards.append
    pole = s.result[0]
    margin = q_gap(s.result[1]) if len(s.result) > 1 else None

    add({"type": "cover", "lap": 0, "kicker": f"{GP['short']} · {s.label}",
         "title": "One lap decides the whole Sunday",
         "text": "Three rounds, five cars knocked out each time, and a grid that "
                 "shapes everything the race can become."})

    add({"type": "moment", "lap": 1, "kicker": "Pole position",
         "title": f"{s.name(pole['driver_number'])} takes it",
         "text": (f"By {margin:.3f}s over {s.name(s.result[1]['driver_number'])}. "
                  "Less time than a blink." if margin
                  else f"For {s.team(pole['driver_number'])}."),
         "dato": {"label": "Top ten",
                  "rows": [[f"P{r['position']} {s.name(r['driver_number'])}",
                            s.team(r["driver_number"])] for r in s.result[:10]]}})

    for lo, hi, rnd, note in ((16, 20, "Q1", "Out before it got serious"),
                              (11, 15, "Q2", "So close to the top ten")):
        out = [r for r in s.result if lo <= (r.get("position") or 99) <= hi]
        if out:
            add({"type": "moment", "lap": 2 if rnd == "Q1" else 3,
                 "kicker": f"{rnd} · The cut", "title": note,
                 "text": ", ".join(f"{s.name(r['driver_number'])} (P{r['position']})"
                                   for r in out) + ".",
                 "dato": {"label": f"Knocked out in {rnd}",
                          "rows": [[s.name(r["driver_number"]), f"P{r['position']}"]
                                   for r in out]}})

    deleted = s.messages("DELETED")
    if deleted:
        add({"type": "moment", "lap": 4, "kicker": "Track limits",
             "title": f"{len(deleted)} laps thrown in the bin",
             "text": "In qualifying a deleted lap can be the difference between "
                     "Q3 and going home early.",
             "dato": {"label": "Deleted laps",
                      "rows": [[(m.get("message") or "")[:40], "deleted"]
                               for m in deleted[:5]]}})

    trap = s.speed_trap()
    if trap:
        add({"type": "moment", "lap": 5, "kicker": "Speed trap",
             "title": f"{s.name(trap[0])} was quickest through the trap: {trap[1]} km/h",
             "text": "Qualifying trim, wings trimmed back, nothing to lose."})

    kings = s.sector_kings()
    if kings:
        add({"type": "moment", "lap": 6, "kicker": "Sector by sector",
             "title": "Nobody owned the whole lap",
             "text": "The perfect lap of the day was never actually driven: it lives "
                     "in three different cars.",
             "dato": {"label": "Fastest sectors",
                      "rows": [[f"{sec} · {who}", f"{t:.3f}s"] for sec, who, t in kings]}})

    yellows = [m for m in s.rc if m.get("flag") in ("YELLOW", "DOUBLE YELLOW")]
    if yellows:
        add({"type": "moment", "lap": 7, "kicker": "Interruptions",
             "title": f"{len(yellows)} yellow flag calls during the session",
             "text": "A yellow in the wrong sector at the wrong moment ends "
                     "somebody's lap, and sometimes their session."})

    add({"type": "moment", "lap": 8, "kicker": "The grid",
         "title": "How Sunday starts",
         "text": " · ".join(f"P{r['position']} {s.name(r['driver_number'])}"
                            for r in s.result[:6])})
    return cards


# ------------------------------------------------------------------ practice
def practice_story(s: Session) -> list[dict]:
    cards: list[dict] = []
    add = cards.append
    best = s.best_lap
    laps_by_driver = Counter(l["driver_number"] for l in s.laps if l.get("lap_duration"))

    add({"type": "cover", "lap": 0, "kicker": f"{GP['short']} · {s.label}",
         "title": "Practice, honestly",
         "text": f"{len(s.laps)} laps run and nothing at stake. What it does tell "
                 "you is who looks comfortable and who is fighting the car."})

    if best:
        add({"type": "moment", "lap": 1,
             "kicker": f"Fastest of the session · lap {best.get('lap_number')}",
             "title": f"{s.name(best['driver_number'])}: {fmt(best['lap_duration'])}",
             "text": f"In a {s.team(best['driver_number'])}. Take practice times with "
                     "salt: fuel loads are secret and nobody shows their hand."})

    if laps_by_driver:
        num, n = laps_by_driver.most_common(1)[0]
        add({"type": "moment", "lap": 2, "kicker": "Who did the work",
             "title": f"{s.name(num)} racked up {n} laps",
             "text": "Track time is the currency of a Friday. Whoever runs most "
                     "learns most, and burns the most rubber doing it.",
             "dato": {"label": "Laps completed",
                      "rows": [[s.name(d), c] for d, c in laps_by_driver.most_common(6)]}})

    # long runs tell you far more than a single lap
    runs = []
    for num in laps_by_driver:
        laps = s.timed_laps(num)
        if len(laps) >= 6:
            runs.append((mean(l["lap_duration"] for l in laps), num, len(laps)))
    if len(runs) >= 3:
        runs.sort()
        add({"type": "moment", "lap": 3, "kicker": "Long-run pace",
             "title": f"{s.name(runs[0][1])} looked strongest over a stint",
             "text": "Average clean lap across the session. This is the number teams "
                     "actually care about on a Friday, not the headline time.",
             "dato": {"label": "Average clean lap",
                      "rows": [[s.name(n), fmt(t)] for t, n, _ in runs[:6]]}})

    if s.stints:
        compounds = Counter(st.get("compound") for st in s.stints if st.get("compound"))
        add({"type": "moment", "lap": 4, "kicker": "Tyres",
             "title": "What they ran, and on what",
             "text": "Compound choice on a Friday is a rehearsal for Sunday's plan.",
             "dato": {"label": "Stints by compound",
                      "rows": [[c, n] for c, n in compounds.most_common()]}})

    trap = s.speed_trap()
    if trap:
        add({"type": "moment", "lap": 5, "kicker": "Speed trap",
             "title": f"{s.name(trap[0])} topped the trap at {trap[1]} km/h",
             "text": "Early wing choices show up here before anybody admits to them."})

    incidents = [m for m in s.rc if m.get("flag") in ("YELLOW", "DOUBLE YELLOW", "RED")]
    add({"type": "moment", "lap": 6, "kicker": "Interruptions",
         "title": f"{len(incidents)} flag calls" if incidents else "A clean session",
         "text": ("Every interruption costs somebody a run they had planned."
                  if incidents else
                  "No red flags, no drama. Rare and quietly useful for everyone.")})

    if s.weather:
        track = [w["track_temperature"] for w in s.weather if w.get("track_temperature")]
        if track:
            add({"type": "moment", "lap": 7, "kicker": "Conditions",
                 "title": f"Track between {min(track):.0f}°C and {max(track):.0f}°C",
                 "text": "Friday conditions rarely match Sunday, which is why the "
                         "times you see here mislead so often."})
    return cards


# ------------------------------------------------------------------ build
def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    sessions_meta = []

    for skey, cache_name, slug, label, kind in SESSIONS:
        s = Session(skey, cache_name, slug, label, kind)
        if not s.laps and not s.result:
            print(f"[skip] {label}: no cached data")
            continue

        cards = (race_story(s) if kind == "race" else
                 quali_story(s) if kind == "quali" else practice_story(s))

        story = {"gp": GP["gp"], "session": label, "sessionSlug": slug,
                 "circuit": GP["circuit"], "laps": s.total_laps or GP["laps"],
                 "generated": "build_weekend", "cards": cards}

        if slug == "race" and s.result:
            w = s.result[0]
            story["result"] = {
                "date": GP["date"],
                "podium": [{"pos": i + 1, "number": r["driver_number"],
                            "first": s.drivers.get(r["driver_number"], {}).get("first_name", ""),
                            "last": s.name(r["driver_number"]),
                            "team": s.team(r["driver_number"]),
                            "colour": s.drivers.get(r["driver_number"], {}).get("team_colour", ""),
                            "headshot": s.drivers.get(r["driver_number"], {}).get("headshot_url", "")}
                           for i, r in enumerate(s.result[:3])],
                "fastest": ({"time": round(s.best_lap["lap_duration"], 3),
                             "last": s.name(s.best_lap["driver_number"]),
                             "number": s.best_lap["driver_number"], "first": "",
                             "team": s.team(s.best_lap["driver_number"]),
                             "colour": "", "headshot": ""} if s.best_lap else None)}
            (OUT / "race_story.json").write_text(
                json.dumps(story, ensure_ascii=False, indent=2), encoding="utf-8")

        (OUT / f"story_{slug}.json").write_text(
            json.dumps(story, ensure_ascii=False, indent=2), encoding="utf-8")

        if kind == "race":
            (OUT / f"mate_{slug}.json").write_text(
                json.dumps(mate_thread(s), ensure_ascii=False, indent=2),
                encoding="utf-8")

        if kind == "practice":
            headline = f"{len(s.laps)} laps run, no points at stake"
        elif kind == "quali":
            headline = (f"{s.name(s.result[0]['driver_number'])} on pole"
                        if s.result else label)
        else:
            headline = (f"{len(s.green_overtakes())} on-track passes"
                        + (f", {len(s.sc_laps)} safety car" if s.sc_laps else ""))

        sessions_meta.append({"slug": slug, "label": label, "kind": kind,
                              "headline": headline, "moments": len(cards),
                              "laps": s.total_laps})
        print(f"[OK] {label}: {len(cards)} cards")

    weekend = {**GP, "sessions": sessions_meta, "rating": None, "heat": []}
    (OUT / "weekend.json").write_text(
        json.dumps(weekend, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[OK] weekend.json · {sum(m['moments'] for m in sessions_meta)} cards total")


if __name__ == "__main__":
    main()
