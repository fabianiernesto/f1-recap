"""
Builds the whole Grand Prix weekend from the cached sessions.

  data/<slug>/weekend.json          the hub: sessions and their headlines
  data/<slug>/story_<session>.json  one deep story per session

Everyone gets the same, full analysis: no depth selector, no spoiler gate.
The detectors mine everything the feed carries -- sector times, the speed trap,
the gap to the car ahead, every flag, every stop -- so a race lands 20-30
moments and even a practice session has something honest to say.

Usage:  python build_weekend.py [gp-slug]      (default: silverstone-2026)
"""
import json
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from pathlib import Path
from statistics import mean, median

from blind import blind_rounds
from brain import race_brain
from gps import DEFAULT, weekend_of
from photos import photo
from pitwall import pitwall_race

ROOT = Path(__file__).parent
CACHE = ROOT / "cache"

# which weekend is being built. The analysis below never mentions a circuit by
# name: everything it needs comes out of these three.
SLUG = sys.argv[1] if len(sys.argv) > 1 else DEFAULT
GP, SESSIONS = weekend_of(SLUG)
OUT = ROOT.parent / "data" / SLUG


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


def close_thoughts(cards: list[dict]) -> list[dict]:
    """Lifts a trailing reflection out of the bullet list and into its own line.

    A list is for facts. The sentence at the end of these cards is an opinion
    about the facts, and it reads as one more item when it is really the point,
    so it moves under the list as prose. A reflection is recognisable: it
    carries no numbers and it is long enough to be a thought.
    """
    def is_thought(line: str) -> bool:
        return len(line) >= 40 and not any(ch.isdigit() for ch in line)

    for c in cards:
        bl = list(c.get("bullets") or [])
        lifted: list[str] = []
        # a card can end on two reflections in a row, and splitting them across
        # a bullet and a paragraph reads worse than either on its own
        while len(bl) > 1 and is_thought(bl[-1]):
            lifted.insert(0, bl.pop())
        if lifted:
            note = " ".join(t if t.endswith(".") else t + "." for t in lifted)
            c["note"], c["bullets"] = note, bl
    return cards


def names_list(names: list[str], cap: int = 3) -> str:
    """Three names read as a sentence; twelve read as a spreadsheet."""
    shown = names[:cap]
    rest = len(names) - len(shown)
    if not shown:
        return ""
    if rest > 0:                      # "A, B, C and 9 others", never two ands
        return ", ".join(shown) + f" and {rest} other{'s' if rest != 1 else ''}"
    return shown[0] if len(shown) == 1 else ", ".join(shown[:-1]) + " and " + shown[-1]


def plural(n: int, word: str, many: str | None = None) -> str:
    return f"{n} {word if n == 1 else (many or word + 's')}"


def tie_names(s, counter: Counter) -> tuple[list[int], int]:
    """Everybody level on the top count, not just the first one found."""
    if not counter:
        return [], 0
    top = max(counter.values())
    return [d for d, c in counter.items() if c == top], top


def duration_words(a, b) -> str | None:
    if not (a and b):
        return None
    mins = round((b - a).total_seconds() / 60)
    if mins < 50:
        return f"about {mins} minutes"
    h, m = divmod(mins, 60)
    return f"{h} hour{'s' if h > 1 else ''} {m} minutes" if m else f"{h} hour{'s' if h > 1 else ''}"


def session_day(s) -> str:
    """The weekday the session ran on, in track time."""
    starts = [parse_ts(l.get("date_start")) for l in s.laps if l.get("date_start")]
    starts = [t for t in starts if t]
    if not starts:
        return "the day"
    t = min(starts) + timedelta(hours=s.clock_offset)
    return t.strftime("%A")


def flag_events(msgs: list[dict]) -> int:
    """Times a flag came out. Race control announces one yellow in two or
    three track sectors at once (Baku FP3 2026: 49 messages); that is one."""
    ts = sorted(t for t in (parse_ts(m.get("date")) for m in msgs) if t)
    n, last = 0, None
    for t in ts:
        if last is None or (t - last).total_seconds() > 60:
            n += 1
        last = t
    return n


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
        if not self.drivers:
            # a session whose driver list never came down borrows the one of
            # another session of the same weekend (same cars, same names)
            for k2, n2, *_ in SESSIONS:
                other = load(k2, n2, "drivers")
                if other:
                    self.drivers = {d["driver_number"]: d for d in other}
                    break
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
        fed = max((l.get("lap_number") or 0) for l in self.laps) if self.laps else 0
        classified = next((r.get("number_of_laps") for r in self.result
                           if r.get("position") == 1 and r.get("number_of_laps")), None)
        self.total_laps = min(fed, classified) if classified and kind == "race" else fed
        starts: dict[int, list[datetime]] = defaultdict(list)
        for l in self.laps:
            ts = parse_ts(l.get("date_start"))
            if l.get("lap_number") and ts:
                starts[l["lap_number"]].append(ts)
        # the leader's lap, as race control numbers it: the median car is often
        # a lap down late in a race and put the VSC on lap 68 when it was 70.
        # The second earliest start guards against a single bad timestamp.
        def lead(ts):
            ts = sorted(ts)
            return ts[1] if len(ts) >= 2 and (ts[1] - ts[0]).total_seconds() > 60 else ts[0]
        self.lap_index = sorted((ln, lead(t)) for ln, t in starts.items())
        self._align_laps(lead)

    def _align_laps(self, lead) -> None:
        """Albert Park 2026: the laps feed skips its lap 2 and every row after
        it is one lap behind race control (the winner's "lap 58" starts at the
        chequered flag). When race control disagrees by the same lap on nearly
        every message, the rows are renumbered to match it."""
        if self.kind != "race" or not self.rc or not self.lap_index:
            return
        diff = Counter()
        for m in self.rc:
            t, ln = parse_ts(m.get("date")), m.get("lap_number")
            if t and ln and ln >= 4:
                raw = self.lap_of(t)
                if raw:
                    diff[ln - raw] += 1
        if not diff:
            return
        off, n = diff.most_common(1)[0]
        if off == 0 or n < 0.9 * sum(diff.values()) or n < 20:
            return
        for l in self.laps:
            if (l.get("lap_number") or 0) > 1:
                l["lap_number"] += off
        # the pit and stints feeds count with the same rows
        for p in self.pits:
            if (p.get("lap_number") or 0) > 1:
                p["lap_number"] += off
        for st in self.stints:
            for key in ("lap_start", "lap_end"):
                if (st.get(key) or 0) > 1:
                    st[key] += off
        starts = defaultdict(list)
        for l in self.laps:
            ts = parse_ts(l.get("date_start"))
            if l.get("lap_number") and ts:
                starts[l["lap_number"]].append(ts)
        self.lap_index = sorted((ln, lead(t)) for ln, t in starts.items())
        fed = max((l.get("lap_number") or 0) for l in self.laps)
        classified = next((r.get("number_of_laps") for r in self.result
                           if r.get("position") == 1 and r.get("number_of_laps")), None)
        self.total_laps = min(fed, classified) if classified else fed

    # ---------- helpers ----------
    def name(self, num: int | None) -> str:
        d = self.drivers.get(num, {})
        n = d.get("last_name") or d.get("name_acronym") or f"#{num}"
        # the feed writes a few surnames in capitals ("ARON"); a name is a name
        return n.title() if n.isupper() and len(n) > 3 else n

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
        """The quickest lap whose sectors add up to it (Miami FP1 2026: a
        1:00.351 in the feed whose sectors add to 3:22)."""
        timed = []
        for l in self.laps:
            t = l.get("lap_duration")
            secs = [l.get(f"duration_sector_{i}") for i in (1, 2, 3)]
            if not t:
                continue
            if all(secs) and abs(sum(secs) - t) > 1.0:
                continue
            timed.append(l)
        return min(timed, key=lambda l: l["lap_duration"]) if timed else None

    @property
    def dnfs(self) -> list[dict]:
        """Started and did not finish. A car that never started is not a
        retirement (Albert Park 2026: Piastri and Hulkenberg were DNS)."""
        return [r for r in self.result if r.get("dnf") and not r.get("dns")]

    @property
    def starters(self) -> int:
        grid = self.start_grid()
        dns = {r["driver_number"] for r in self.result if r.get("dns")}
        return len([n for n in grid if n not in dns]) or len(self.result)

    def completed_laps(self, num: int) -> int | None:
        return next((r.get("number_of_laps") for r in self.result
                     if r["driver_number"] == num), None)

    def stop_lap(self, num: int) -> int:
        """The lap a retired car stopped on: the one after the last he finished."""
        done = self.completed_laps(num)
        if done is not None:
            return done + 1
        return max(((l.get("lap_number") or 0) for l in self.laps
                    if l.get("driver_number") == num), default=0)

    def lap_start_ts(self, lap: int):
        return next((t for ln, t in self.lap_index if ln == lap), None)

    def leader_by_lap(self) -> dict[int, int]:
        """Who led each lap: the first car to start the next one. The winner
        leads the last. Straight from the timing, not the position feed."""
        if getattr(self, "_lead", None) is not None:
            return self._lead
        first: dict[int, tuple] = {}
        for l in self.laps:
            ts, ln = parse_ts(l.get("date_start")), l.get("lap_number")
            if ts and ln and (ln not in first or ts < first[ln][0]):
                first[ln] = (ts, l["driver_number"])
        out = {n: first[n + 1][1] for n in range(1, self.total_laps) if n + 1 in first}
        if self.result and self.total_laps:
            out[self.total_laps] = self.result[0]["driver_number"]
        self._lead = out
        return out

    def own_lap_ts(self, num: int, lap: int):
        """When this driver began that lap (not the field's start of it)."""
        return next((parse_ts(l.get("date_start")) for l in self.laps
                     if l.get("driver_number") == num and l.get("lap_number") == lap
                     and l.get("date_start")), None)

    def clock_ts(self, m: dict):
        """When the thing a message reports happened, from the last clock time
        written inside it ("LAP 5 16:39:39", "(15:03:08)"), else when posted.
        Deleted laps are often posted after the flag for laps set before it."""
        t = parse_ts(m.get("date"))
        hits = re.findall(r"(?<![\d:.])(\d{1,2}):(\d{2}):(\d{2})(?![\d.])", m.get("message") or "")
        if not (hits and t):
            return t
        h, mi, se = (int(x) for x in hits[-1])
        loc = t.replace(hour=h, minute=mi, second=se, microsecond=0)
        ts = loc - timedelta(hours=self.clock_offset)
        if ts > t + timedelta(hours=1):
            ts -= timedelta(days=1)
        elif ts < t - timedelta(hours=23):
            ts += timedelta(days=1)
        return ts

    def live_at(self, t) -> bool:
        return bool(t) and (not self.running_windows
                            or any(a <= t <= b for a, b in self.running_windows))

    @property
    def unclassified(self) -> list[dict]:
        """Running at the end but too far behind to be classified."""
        return [r for r in self.result
                if not r.get("dns") and not r.get("dnf") and not r.get("dsq") and not r.get("position")]

    def typical_stops(self) -> int:
        """What most of the field did, counting the cars that never stopped."""
        per = Counter(p["driver_number"] for p in self.real_pits)
        counts = Counter(per.get(r["driver_number"], 0) for r in self.result if not r.get("dns"))
        return counts.most_common(1)[0][0] if counts else 0

    def racing_time(self) -> str | None:
        """Lights out to the flag, less any time the session stood still."""
        a, b = self.race_start_ts, self.race_end_ts
        if not (a and b):
            return None
        stopped = 0.0
        wins = sorted(self.running_windows)
        for (x1, y1), (x2, y2) in zip(wins, wins[1:]):
            gap_a, gap_b = max(y1 - timedelta(seconds=45), a), min(x2, b)
            if gap_b > gap_a:
                stopped += (gap_b - gap_a).total_seconds()
        return duration_words(a, b - timedelta(seconds=stopped))

    # ---------- the clock ----------
    @property
    def race_start_ts(self):
        return self.lap_start_ts(1)

    @property
    def race_end_ts(self):
        """The first chequered flag after the start."""
        st = self.race_start_ts
        flags = sorted(t for t in (parse_ts(m.get("date")) for m in self.rc
                                   if m.get("flag") == "CHEQUERED") if t and (not st or t > st))
        return flags[0] if flags else None

    @property
    def clock_offset(self) -> int:
        """Hours between the track-local clock race control prints inside its
        messages, "(15:03:49)", and the UTC every record is stamped with."""
        if getattr(self, "_off", None) is None:
            offs = []
            for m in self.rc:
                st = re.search(r"\((\d{1,2}):(\d{2}):{1,2}(\d{2})\)", m.get("message") or "")
                t = parse_ts(m.get("date"))
                if st and t:
                    loc = t.replace(hour=int(st.group(1)), minute=int(st.group(2)),
                                    second=int(st.group(3)), microsecond=0)
                    h = (loc - t).total_seconds() / 3600
                    h = h - 24 if h > 12 else h + 24 if h < -12 else h
                    offs.append(round(h))
            self._off = Counter(offs).most_common(1)[0][0] if offs else 0
        return self._off

    def stamp_ts(self, m: dict):
        """When an incident happened, from the clock inside the message; the
        message itself is often posted laps later."""
        st = re.search(r"\((\d{1,2}):(\d{2}):{1,2}(\d{2})\)", m.get("message") or "")
        t = parse_ts(m.get("date"))
        if not (st and t):
            return None
        loc = t.replace(hour=int(st.group(1)), minute=int(st.group(2)),
                        second=int(st.group(3)), microsecond=0)
        ts = loc - timedelta(hours=self.clock_offset)
        if ts > t + timedelta(hours=1):
            ts -= timedelta(days=1)
        elif ts < t - timedelta(hours=23):
            ts += timedelta(days=1)
        return ts

    def in_session(self, ts) -> bool:
        a, b = self.race_start_ts, self.race_end_ts
        return bool(ts) and (not a or ts >= a - timedelta(minutes=2)) and (not b or ts <= b)

    @property
    def sc_periods(self) -> list[dict]:
        """One entry per neutralisation behind the safety car.

        Race control can call "SAFETY CAR IN THIS LAP" and redeploy it seconds
        later (Silverstone 2026, eight seconds): that is one safety car, and
        the race finished behind it. A safety car that turns into a red flag
        is the red flag's story, so it is kept out of here."""
        if getattr(self, "_sc", None) is not None:
            return self._sc
        ev = []
        for m in self.rc:
            u, t = (m.get("message") or "").upper(), parse_ts(m.get("date"))
            if t and "VIRTUAL" not in u and ("SAFETY CAR DEPLOYED" in u or "SAFETY CAR IN THIS LAP" in u):
                ev.append((t, u, m.get("lap_number")))
        periods: list[dict] = []
        for t, u, ln in sorted(ev):
            if "DEPLOYED" in u:
                cur = periods[-1] if periods else None
                if cur and cur["end_ts"] and (t - cur["end_ts"]).total_seconds() <= 120:
                    cur["end_ts"], cur["end_lap"] = None, None
                elif not cur or cur["end_ts"]:
                    periods.append({"lap": ln, "ts": t, "end_lap": None, "end_ts": None})
            elif periods and not periods[-1]["end_ts"]:
                periods[-1]["end_lap"], periods[-1]["end_ts"] = ln, t
        reds = [parse_ts(m.get("date")) for m in self.rc
                if re.search(r"(?<![A-Z])RED FLAG", (m.get("message") or "").upper())]
        reds = [r for r in reds if r]
        kept = [p for p in periods
                if not any(p["ts"] <= r <= (p["end_ts"] or p["ts"]) + timedelta(minutes=6)
                           for r in reds)]
        for p in kept:
            p["red"] = False
            if not p["end_ts"]:
                # Monaco 2026: out on lap 60, never called in, red flag on lap 67
                r = min((r for r in reds if r > p["ts"]), default=None)
                if r and (not self.race_end_ts or r < self.race_end_ts):
                    p["end_ts"], p["end_lap"], p["red"] = r, self.lap_of(r), True
        self._sc = kept
        return self._sc

    @property
    def sc_laps(self) -> list[int]:
        return [p["lap"] for p in self.sc_periods if p["lap"]]

    @property
    def vsc_laps(self) -> list[int]:
        """Lap each virtual safety car was called. Not a safety car: the
        gaps freeze instead of vanishing, so it gets its own card and its
        own count, and it never inflates the safety-car number."""
        return sorted({m["lap_number"] for m in self.rc
                       if "VSC DEPLOYED" in (m.get("message") or "").upper()
                       and m.get("lap_number")})

    @property
    def vsc_periods(self) -> list[tuple]:
        """(deploy ts, end ts) of each virtual safety car."""
        out, cur = [], None
        for m in sorted(self.rc, key=lambda x: x.get("date") or ""):
            u, t = (m.get("message") or "").upper(), parse_ts(m.get("date"))
            if t and "VSC DEPLOYED" in u:
                cur = t
            elif t and "VSC ENDING" in u and cur:
                out.append((cur, t)); cur = None
        if cur:
            out.append((cur, self.race_end_ts or cur + timedelta(minutes=3)))
        return out

    @property
    def neutral_windows(self) -> list[tuple]:
        """Stretches of time in which a change of place is not a pass: behind
        the safety car until a lap after it comes in, under a VSC, and from a
        red flag to a lap after the restart."""
        if getattr(self, "_nw", None) is not None:
            return self._nw
        w = []
        for p in self.sc_periods:
            w.append((p["ts"], (p["end_ts"] or self.race_end_ts or p["ts"]) + timedelta(seconds=150)))
        for a, b in self.vsc_periods:
            w.append((a, b + timedelta(seconds=30)))
        red, resume = None, None
        for m in sorted(self.rc, key=lambda x: x.get("date") or ""):
            u, t = (m.get("message") or "").upper(), parse_ts(m.get("date"))
            if not t:
                continue
            if re.search(r"(?<![A-Z])RED FLAG", u) and red is None:
                red = t
            elif red and any(k in u for k in ("STANDING START", "ROLLING START")):
                w.append((red - timedelta(seconds=30), t + timedelta(minutes=4)))
                red = None
        if red:
            w.append((red - timedelta(seconds=30), self.race_end_ts or red + timedelta(hours=3)))
        self._nw = w
        return w

    def neutralised(self, ts) -> bool:
        return bool(ts) and any(a <= ts <= b for a, b in self.neutral_windows)

    def neutral_kind(self, ts) -> str | None:
        """'the safety car', 'the virtual safety car' or None."""
        if not ts:
            return None
        for p in self.sc_periods:
            end = (p["end_ts"] or self.race_end_ts or p["ts"]) + timedelta(seconds=150)
            if p["ts"] <= ts <= end:
                return "the safety car"
        for a, b in self.vsc_periods:
            if a <= ts <= b + timedelta(seconds=30):
                return "the virtual safety car"
        return None

    def vsc_end(self, lap: int) -> int | None:
        return next((m["lap_number"] for m in self.messages("VSC ENDING")
                     if (m.get("lap_number") or 0) >= lap), None)

    @property
    def running_windows(self) -> list[tuple]:
        """When the session was actually running: from each SESSION STARTED to
        the next SESSION FINISHED or chequered flag. Race control also carries
        the support races before and after (Miami 2026: none of the sprint's
        "28 yellow flags" fell while the sprint was running)."""
        if getattr(self, "_runw", None) is not None:
            return self._runw
        out, start = [], None
        for m in sorted(self.rc, key=lambda x: x.get("date") or ""):
            u, t = (m.get("message") or "").upper(), parse_ts(m.get("date"))
            if not t:
                continue
            if "SESSION STARTED" in u or "SESSION RESUMED" in u:
                start = start or t
            elif start and ("SESSION FINISHED" in u or m.get("flag") == "CHEQUERED"
                            or "SESSION ABORTED" in u or "SESSION SUSPENDED" in u):
                out.append((start, t + timedelta(seconds=45)))
                start = None
        if start:
            out.append((start, start + timedelta(hours=3)))
        if not out and self.race_start_ts:
            out = [(self.race_start_ts, self.race_end_ts or self.race_start_ts + timedelta(hours=3))]
        self._runw = out
        return out

    def live(self, m: dict) -> bool:
        t = parse_ts(m.get("date"))
        return bool(t) and (not self.running_windows
                            or any(a <= t <= b for a, b in self.running_windows))

    @property
    def rc_live(self) -> list[dict]:
        return [m for m in self.rc if self.live(m)]

    def messages(self, *needles: str) -> list[dict]:
        return [m for m in self.rc
                if any(n in (m.get("message") or "").upper() for n in needles)]

    def deleted_in_session(self) -> list[dict]:
        """Deleted laps set while the session ran, whenever they were posted."""
        if self.kind == "race":
            a, b = self.race_start_ts, self.race_end_ts
            chk = lambda t: bool(t) and (not a or t >= a - timedelta(minutes=2)) and \
                (not b or t <= b + timedelta(minutes=3))
        else:
            chk = self.live_at
        return [m for m in self.deleted_laps() if chk(self.clock_ts(m))]

    def deleted_laps(self) -> list[dict]:
        """Deleted lap times, once each (Miami 2026 deleted one lap four times,
        once per corner), less the ones race control reinstated."""
        out, seen = [], set()
        back = [(m.get("message") or "").upper() for m in self.rc if "REINSTATED" in (m.get("message") or "").upper()]
        for m in self.rc:
            u = (m.get("message") or "").upper()
            if "DELETED" not in u:
                continue
            car = re.search(r"CAR (\d+)", u)
            tm = re.search(r"TIME (\d+:\d\d\.\d+)", u)
            lp = re.search(r"LAP (\d+)", u)
            key = (car.group(1) if car else "", tm.group(1) if tm else "", lp.group(1) if lp else u)
            if key in seen:
                continue
            if car and lp and any(f"CAR {car.group(1)} " in b and f"LAP {lp.group(1)} " in b + " " for b in back):
                continue
            seen.add(key)
            out.append(m)
        return out

    @property
    def red_laps(self) -> list[int]:
        """Laps the race was stopped for, from the red flag to the restart.

        Monza 2026 was red-flagged on lap 3 and restarted from a standing start
        on lap 5. Read naively, that half hour looks like twenty-one pit stops
        of thirty minutes each and a restart that counts as ninety overtakes,
        and the pipeline built cards around both. A stoppage is not a strategy.
        """
        # a word boundary, not a substring: "CHEQUERED FLAG" contains "RED FLAG",
        # and matching it made every race end with a stoppage on its last lap.
        # The same trap already bit the web's card variants once.
        reds = [m["lap_number"] for m in self.rc
                if m.get("lap_number")
                and re.search(r"(?<![A-Z])RED FLAG", (m.get("message") or "").upper())]
        if not reds:
            return []
        starts = [m["lap_number"] for m in self.messages("STANDING START", "ROLLING START",
                                                          "RACE WILL RESUME")
                  if m.get("lap_number") and m["lap_number"] >= min(reds)]
        end = max(starts) if starts else min(reds)
        return list(range(min(reds), end + 1))

    @property
    def restart_laps(self) -> list[int]:
        """The lap of each restart after a stoppage, and the one after it.

        The position feed catches up a lap late, so the reshuffle of a standing
        restart on lap 5 lands in the data as passes on lap 6.
        """
        out: set[int] = set()
        for m in self.messages("STANDING START", "ROLLING START"):
            ln = m.get("lap_number")
            if ln and ln > 1:
                out.update((ln, ln + 1))
        return sorted(out)

    @property
    def dead_laps(self) -> set[int]:
        """Laps on which a change of position is not a pass anybody made."""
        if getattr(self, "_dead", None) is not None:
            return self._dead
        dead = set(self.red_laps) | set(self.restart_laps)
        for p in self.sc_periods:
            end = p["end_lap"] or self.total_laps
            dead.update(range(max(2, (p["lap"] or 2) - 1), end + 2))
        for v in self.vsc_laps:
            dead.update(range(v, (self.vsc_end(v) or v) + 2))
        self._dead = dead
        return dead

    def _tyres_changed(self, d: int, ln: int, used: set | None = None):
        """True if the car left the lane on a different set, False if it went
        through on the same one, None if the stints feed cannot say. Each
        change in the stints feed pays for one visit only (Suzuka 2026: Albon
        in on laps 45 and 46 matched the same new set twice)."""
        sts = sorted((st for st in self.stints if st.get("driver_number") == d),
                     key=lambda st: st.get("lap_start") or 0)
        matched = False
        for off in (1, 0, 2):
            for i, nxt in enumerate(sts):
                if not i or (nxt.get("lap_start") or 0) != ln + off:
                    continue
                key = (d, nxt.get("lap_start"))
                matched = True
                if used is not None and key in used:
                    continue
                prev = sts[i - 1]
                worn = (prev.get("tyre_age_at_start") or 0) + \
                       ((nxt.get("lap_start") or 0) - (prev.get("lap_start") or 0))
                age = nxt.get("tyre_age_at_start") or 0
                changed = (nxt.get("compound") != prev.get("compound")
                           or age < worn - 2 or (age == 0 and worn >= 1))
                if changed and used is not None:
                    used.add(key)
                if changed:
                    return True
            if matched:
                # the nearest stint boundary decides; a farther one belongs to
                # the next visit (Suzuka 2026: Albon's lap 48 visit is not the
                # lap 49 change)
                return False
        if matched:
            return False      # the feed has the stint and it is the same set
        # one stint running straight through the visit: the same set
        if any((st.get("lap_start") or 0) <= ln and (st.get("lap_end") or 0) >= ln + 2
               and st.get("compound") not in (None, "UNKNOWN") for st in sts):
            return False
        return None

    def _compound_changed(self, d: int, ln: int) -> bool:
        sts = sorted((st for st in self.stints if st.get("driver_number") == d),
                     key=lambda st: st.get("lap_start") or 0)
        for i, nxt in enumerate(sts):
            if i and (nxt.get("lap_start") or 0) in (ln, ln + 1, ln + 2):
                a, b = sts[i - 1].get("compound"), nxt.get("compound")
                if a not in (None, "UNKNOWN") and b not in (None, "UNKNOWN") and a != b:
                    return True
        return False

    @property
    def penalty_serves(self) -> list[tuple]:
        """(driver, called at) for every drive-through and stop-and-go: the
        first lane visit after the call is the penalty, not a stop."""
        out = []
        for m in self.rc:
            u = (m.get("message") or "").upper()
            mm = re.search(r"(DRIVE[- ]THROUGH|STOP[- ]AND[- ]GO|STOP[- ]GO) PENALTY FOR CAR (\d+)", u)
            if mm and "SERVED" not in u:
                out.append((int(mm.group(2)), parse_ts(m.get("date"))))
        return out

    @property
    def lane_visits(self) -> list[dict]:
        """Every trip down the pit lane, once each. The feed repeats some
        entries seconds apart under a different lap (Albert Park 2026: five
        of them), and a car in the lane for half an hour under a red flag is
        parked, not stopping."""
        if getattr(self, "_visits", None) is not None:
            return self._visits
        out = []
        for p in sorted(self.pits, key=lambda p: p.get("date") or ""):
            ts = parse_ts(p.get("date"))
            if not (p.get("lap_number") and p.get("pit_duration")):
                continue
            if any(q["driver_number"] == p["driver_number"] and q["ts"] and ts
                   and abs((ts - q["ts"]).total_seconds()) < 60 for q in out):
                continue
            out.append({**p, "ts": ts})
        self._visits = out
        return out

    @property
    def real_pits(self) -> list[dict]:
        """Pit stops that were pit stops: a new set of tyres, fitted in racing
        conditions. Out go the red-flag stays, the laps the safety car was
        routed down the pit lane (Monaco 2026, twice), drive-throughs and
        stop-and-gos, and duplicate rows."""
        if getattr(self, "_real", None) is not None:
            return self._real
        red = set(self.red_laps)
        # "ALL CARS THROUGH THE PIT LANE" until "WILL USE START/FINISH STRAIGHT":
        # a time window, since lapped cars carry another lap number (Monaco 2026)
        windows = []
        for m in sorted(self.messages("ALL CARS THROUGH THE PIT LANE"), key=lambda x: x.get("date") or ""):
            t = parse_ts(m.get("date"))
            if not t:
                continue
            end = min((parse_ts(x.get("date")) for x in self.messages("START/FINISH STRAIGHT")
                       if parse_ts(x.get("date")) and parse_ts(x.get("date")) > t),
                      default=t + timedelta(minutes=6))
            windows.append((t - timedelta(seconds=120), end))
        serves = list(self.penalty_serves)
        used: set = set()
        in_win = lambda ts: next((w for w in windows if ts and w[0] <= ts <= w[1]), None)
        base: dict = {}
        for w in windows:
            durs = sorted(p["pit_duration"] for p in self.lane_visits if p["ts"] and w[0] <= p["ts"] <= w[1])
            if durs:
                base[w] = durs[len(durs) // 2]
        out = []
        for p in self.lane_visits:
            d, ln, ts = p["driver_number"], p["lap_number"], p["ts"]
            if ln in red:
                continue
            if p["pit_duration"] >= 300:
                continue      # a red-flag wait or a garage repair, not a pit stop
            w = in_win(ts)
            if w and p["pit_duration"] < base[w] + 4:
                continue      # the field routed through the lane, and this one never stopped
            served = next((sv for sv in serves if sv[0] == d and sv[1] and ts and ts >= sv[1]), None)
            if served:
                serves.remove(served)
                continue
            if w:
                out.append(p)  # clearly stationary while the field went through
                continue
            changed = self._tyres_changed(d, ln, used)
            if changed is False:
                continue
            if p["pit_duration"] >= 120 and changed is not True:
                continue
            out.append(p)
        if self.kind == "race":
            out += self.inferred_stops()
        self._real = sorted(out, key=lambda p: (p.get("lap_number") or 0))
        return self._real

    def inferred_stops(self) -> list[dict]:
        """A change of tyres the stints feed shows and the pit feed does not
        (Hungary 2026: Norris's stop at the end of lap 39). No lane time, so
        it counts as a stop and never as the quickest or slowest one."""
        have = {(p["driver_number"], p["lap_number"]) for p in self.lane_visits}
        out = []
        for d in {st.get("driver_number") for st in self.stints}:
            sts = sorted((st for st in self.stints if st.get("driver_number") == d),
                         key=lambda st: st.get("lap_start") or 0)
            for prev, nxt in zip(sts, sts[1:]):
                ln = (nxt.get("lap_start") or 0) - 1
                if ln < 1 or ln in set(self.red_laps):
                    continue
                if any(dd == d and abs(l - ln) <= 2 for dd, l in have):
                    continue
                worn = (prev.get("tyre_age_at_start") or 0) + ((nxt.get("lap_start") or 0) - (prev.get("lap_start") or 0))
                if nxt.get("compound") in (None, "UNKNOWN") and prev.get("compound") not in (None, "UNKNOWN"):
                    changed = True
                else:
                    changed = (nxt.get("compound") != prev.get("compound")
                               or (nxt.get("tyre_age_at_start") or 0) < worn - 2)
                t_in = self.lap_start_ts(ln + 1)
                if changed and ln >= self.total_laps:
                    changed = False
                if changed and self.race_end_ts and t_in and t_in >= self.race_end_ts:
                    changed = False   # Spa 2026: a set fitted after the chequered flag
                if changed:
                    out.append({"driver_number": d, "lap_number": ln, "pit_duration": None,
                                "ts": self.lap_start_ts(ln + 1), "inferred": True})
        return out

    @property
    def timed_stops(self) -> list[dict]:
        """Real stops with a lane time under a minute: the ones fit to compare."""
        return [p for p in self.real_pits if p.get("pit_duration") and p["pit_duration"] < 60]

    def stops_between(self, a, b) -> list[dict]:
        return [p for p in self.real_pits if p["ts"] and a <= p["ts"] <= b]

    def _clean_passes(self, keep_lap1: bool) -> list[tuple[int, dict]]:
        """Changes of place that were a car going past another on track.

        The overtakes feed logs every change of order. Most of them are not
        passes: Barcelona 2026 had 232 "green" ones and 36 were on track. The
        rest were cars going past someone in the pit lane (168) or past a car
        on its way to retirement (28). Out also go changes behind the safety
        car, the VSC or the red flag, anything after the chequered flag, a
        car that never started, same-moment reciprocal pairs (feed flicker),
        and four or more cars going past one in half a minute (a spin, an
        off or a car slowing: an incident, not four passes)."""
        dead = self.dead_laps
        end = self.race_end_ts
        lap_s = median([l["lap_duration"] for l in self.laps if l.get("lap_duration")] or [90])
        lane = [(v["driver_number"], v["ts"] - timedelta(seconds=40),
                 v["ts"] + timedelta(seconds=min(v["pit_duration"], 60) + lap_s * 0.6))
                for v in self.lane_visits if v["ts"]]
        lane += [(p["driver_number"], p["ts"] - timedelta(seconds=lap_s),
                  p["ts"] + timedelta(seconds=lap_s))
                 for p in self.real_pits if p.get("inferred") and p.get("ts")]
        gone = {}
        for r in self.result:
            if r.get("dns"):
                gone[r["driver_number"]] = self.race_start_ts
            elif r.get("dnf"):
                done = r.get("number_of_laps") or 0
                gone[r["driver_number"]] = self.lap_start_ts(max(1, done)) if done else self.race_start_ts
        raw = []
        for o in self.overtakes:
            ts = parse_ts(o.get("date"))
            if not ts:
                continue
            ln = self.lap_of(ts) or (1 if self.race_start_ts and ts >= self.race_start_ts - timedelta(seconds=30) else None)
            if not ln or (ln == 1 and not keep_lap1) or (ln > 1 and ln in dead):
                continue
            if end and ts > end:
                continue
            if ln > 1 and self.neutralised(ts):
                continue
            v = o.get("overtaken_driver_number")
            if any(d == v and a <= ts <= b for d, a, b in lane):
                continue
            if gone.get(v) and ts >= gone[v] - timedelta(seconds=5):
                continue
            raw.append((ln, ts, o))
        keep = [(ln, ts, o) for ln, ts, o in raw
                if not any(o2["overtaking_driver_number"] == o["overtaken_driver_number"]
                           and o2["overtaken_driver_number"] == o["overtaking_driver_number"]
                           and abs((t2 - ts).total_seconds()) <= 10 for _, t2, o2 in raw)]
        # one car "passing" three or more in the same instant is the position
        # feed losing him and finding him again (Suzuka 2026: Lawson, four
        # times; Zandvoort: Lindblad twelve places in one second)
        jumps = set()
        for ln, ts, o in keep:
            a = o["overtaking_driver_number"]
            same = [o2 for _, t2, o2 in keep if o2["overtaking_driver_number"] == a
                    and abs((t2 - ts).total_seconds()) <= 2]
            if len(same) >= 3:
                jumps.add((a, ts.replace(microsecond=0)))
        keep = [(ln, ts, o) for ln, ts, o in keep
                if not any(o["overtaking_driver_number"] == a and abs((ts.replace(microsecond=0) - t).total_seconds()) <= 2
                           for a, t in jumps)
                and not any(o["overtaken_driver_number"] == a and 0 <= (ts - t).total_seconds() <= 120
                            for a, t in jumps)]
        out = []
        for ln, ts, o in keep:
            v = o["overtaken_driver_number"]
            burst = {o2["overtaking_driver_number"] for _, t2, o2 in keep
                     if o2["overtaken_driver_number"] == v and abs((t2 - ts).total_seconds()) <= 30}
            if len(burst) >= 4 and ln > 1:
                continue
            out.append((ln, o))
        return out

    def green_overtakes(self) -> list[tuple[int, dict]]:
        if getattr(self, "_green", None) is None:
            self._green = [(ln, o) for ln, o in self._clean_passes(False) if ln > 1]
        return self._green

    def lap1_passes(self) -> list[dict]:
        """Lap-1 passes, less the field streaming past a car that has gone off
        under a yellow (Shanghai 2026: Hadjar spun at the end of lap 1 and
        twelve cars "passed" him in ten seconds under a double yellow). A bad
        getaway with no flag out is a real loss of places and stays."""
        out = [o for ln, o in self._clean_passes(True) if ln == 1]
        yellows = [parse_ts(m.get("date")) for m in self.rc
                   if m.get("flag") in ("YELLOW", "DOUBLE YELLOW")]
        yellows = [t for t in yellows if t]
        drop = set()
        by_victim: dict[int, list[dict]] = defaultdict(list)
        for o in out:
            by_victim[o["overtaken_driver_number"]].append(o)
        for v, ps in by_victim.items():
            ps = sorted(ps, key=lambda o: o.get("date") or "")
            for i, o in enumerate(ps):
                t0 = parse_ts(o.get("date"))
                burst = [q for q in ps[i:] if parse_ts(q.get("date")) and t0
                         and (parse_ts(q["date"]) - t0).total_seconds() <= 30]
                if len({q["overtaking_driver_number"] for q in burst}) < 4:
                    continue
                t1 = parse_ts(burst[-1]["date"])
                if any(t0 - timedelta(seconds=10) <= y <= t1 + timedelta(seconds=5) for y in yellows):
                    drop.update(id(q) for q in burst)
        return [o for o in out if id(o) not in drop]

    def speed_trap(self) -> tuple[list[int], int] | None:
        """([drivers level on the top speed], km/h)."""
        speeds = [(int(l["st_speed"]), l["driver_number"]) for l in self.laps if l.get("st_speed")]
        if not speeds:
            return None
        top = max(v for v, _ in speeds)
        who = []
        for v, d in speeds:
            if v == top and d not in who:
                who.append(d)
        return who, top

    def clean_sector_laps(self) -> list[dict]:
        """Laps whose three sectors add up to the lap time (Miami FP1 2026)."""
        out = []
        for l in self.laps:
            secs = [l.get(f"duration_sector_{i}") for i in (1, 2, 3)]
            if l.get("lap_duration") and all(secs) and abs(sum(secs) - l["lap_duration"]) <= 1.0:
                out.append(l)
        return out

    def sector_kings(self) -> list[tuple[str, str, float]]:
        out = []
        laps = self.clean_sector_laps()
        for i in (1, 2, 3):
            key = f"duration_sector_{i}"
            best = min((l for l in laps if l.get(key)), key=lambda l: l[key], default=None)
            if best:
                top = round(best[key], 3)
                who = []
                for l in laps:
                    if l.get(key) and round(l[key], 3) == top and self.name(l["driver_number"]) not in who:
                        who.append(self.name(l["driver_number"]))
                out.append((f"Sector {i}", " and ".join(who), best[key]))
        return out

    def battles(self, threshold: float = 1.0, min_laps: int = 5) -> list[tuple[int, int, int, int]]:
        """(driver, laps, from lap, to lap): the longest unbroken run each
        driver spent within a second of the car ahead in racing conditions.
        Behind the safety car everybody is within a second, so those samples
        break the run instead of feeding it."""
        best: dict[int, tuple[int, int, int]] = {}
        cur: dict[int, int] = {}
        for iv in sorted(self.intervals, key=lambda x: x.get("date") or ""):
            num, gap, ts = iv.get("driver_number"), iv.get("interval"), parse_ts(iv.get("date"))
            ln = self.lap_of(ts)
            ok = (isinstance(gap, (int, float)) and 0 < gap <= threshold and ln and ln > 1
                  and ln not in self.dead_laps and not self.neutralised(ts))
            if not ok:
                cur.pop(num, None)
                continue
            start = cur.setdefault(num, ln)
            span = ln - start + 1
            if span > best.get(num, (0, 0, 0))[0]:
                best[num] = (span, start, ln)
        runs = [(n, v[0], v[1], v[2]) for n, v in best.items() if v[0] >= min_laps]
        return sorted(runs, key=lambda x: -x[1])

    def pace(self, num: int) -> float | None:
        """Median racing lap: no lap 1, no in- or out-laps, nothing behind the
        safety car, the VSC or a red flag (Miami 2026: a median built on two
        safety-car laps made one car look nineteen seconds a lap slow)."""
        stops = {p["lap_number"] for p in self.lane_visits if p["driver_number"] == num}
        laps = []
        for l in self.timed_laps(num):
            ln = l.get("lap_number") or 0
            if ln <= 1 or ln in stops or ln in self.dead_laps:
                continue
            if self.kind == "race" and self.neutralised(parse_ts(l.get("date_start"))):
                continue
            laps.append(l["lap_duration"])
        if len(laps) < 5:
            return None
        m = median(laps)
        laps = [x for x in laps if x <= m * 1.07]
        return median(laps) if len(laps) >= 5 else None

    # ---------- freezing the race at a given lap ----------
    # Everything the interactive cards ask you to decide on has to be the real
    # state of the race at that moment, otherwise the question is a trick.

    def order_at_lap(self, lap: int) -> list[tuple[int, int]]:
        """[(position, driver)] as it stood on that lap.

        A car that never changes place has one position record, stamped
        before the start. Dropping pre-start records made the leader vanish:
        at Monaco and Baku 2026 "the leader" was really P2."""
        latest: dict[int, int] = {}
        first = self.lap_index[0][1] if self.lap_index else None
        for p in sorted(self.position, key=lambda x: x.get("date") or ""):
            ts = parse_ts(p.get("date"))
            ln = self.lap_of(ts)
            if ln is None and ts and first and ts < first:
                ln = 0
            if ln is not None and ln <= lap and p.get("position"):
                latest[p["driver_number"]] = p["position"]
        out = [(pos, num) for num, pos in latest.items()]
        gone = {r["driver_number"] for r in self.result
                if r.get("dns") or (r.get("dnf") and (r.get("number_of_laps") or 0) < lap)}
        return sorted(x for x in out if x[1] not in gone)

    def order_at_ts(self, when) -> list[tuple[int, int]]:
        """[(position, driver)] at an exact moment, for the cards that name the
        leader when something was called (Spa 2026: the VSC came out while
        Antonelli led; by the end of that lap Leclerc did)."""
        latest: dict[int, int] = {}
        for p in sorted(self.position, key=lambda x: x.get("date") or ""):
            ts = parse_ts(p.get("date"))
            if ts and when and ts <= when and p.get("position"):
                latest[p["driver_number"]] = p["position"]
        return sorted((pos, num) for num, pos in latest.items())

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
        """The set he was on going into that lap: a stint that starts on it
        was fitted during it (Monaco 2026: "4 laps old" softs were the ones
        he got at the stop, not the ones he came in on)."""
        sts = [st for st in self.stints if st.get("driver_number") == num]
        for strict in (True, False):
            for st in sts:
                a, b = st.get("lap_start") or 0, st.get("lap_end") or 0
                if (a < lap <= b) if strict else (a <= lap <= b):
                    if st.get("compound") in (None, "UNKNOWN"):
                        return None, None
                    return st.get("compound"), (st.get("tyre_age_at_start") or 0) + (lap - a)
        return None, None

    def pit_laps(self, num: int) -> list[int]:
        """The laps he stopped on. Red-flag entries are not stops: see real_pits."""
        return sorted(p["lap_number"] for p in self.real_pits
                      if p.get("driver_number") == num)

    def finish_pos(self, num: int) -> int | None:
        """Where he finished, if he finished. A classified retirement is not a
        finish (Barcelona 2026: "He finished P16" about a car out on lap 62)."""
        r = next((r for r in self.result if r["driver_number"] == num), None)
        if not r or r.get("dnf") or r.get("dns") or r.get("dsq"):
            return None
        return r.get("position")

    def penalties(self) -> list[dict]:
        """Every penalty given, once each, on the car the verdict names: time
        penalties, drive-throughs and stop-and-gos."""
        out, seen = [], set()
        for m in self.rc:
            u = (m.get("message") or "").upper()
            if "STEWARDS" not in u or "SERVED" in u or "PENALTY" not in u:
                continue
            t = re.search(r"(\d+) SECOND TIME PENALTY FOR CAR (\d+)", u)
            dt = re.search(r"(DRIVE[- ]THROUGH|STOP[- ]AND[- ]GO|STOP[- ]GO) PENALTY FOR CAR (\d+)", u)
            if not (t or dt):
                continue
            key = re.sub(r"^.*?STEWARDS:\s*", "", u)
            if key in seen:
                continue
            seen.add(key)
            tail = re.sub(r"\s*\(\d{1,2}:\d{2}:{1,2}\d{2}\)", "", u)
            bits = [b.strip(" -–") for b in re.split(r"\s[-–]\s", tail) if b.strip(" -–")]
            reason = bits[-1] if len(bits) > 1 and "PENALTY" not in bits[-1] else ""
            reason = re.sub(r"RACE DIRECTORS? INSTRUCTIONS", "THE RACE DIRECTOR'S INSTRUCTIONS", reason)
            if t:
                out.append({"car": int(t.group(2)), "secs": int(t.group(1)), "kind": f"{t.group(1)}s",
                            "reason": reason.lower(), "lap": m.get("lap_number")})
            else:
                kind = "a drive-through" if "DRIVE" in dt.group(1) else "a stop-and-go"
                out.append({"car": int(dt.group(2)), "secs": 0, "kind": kind,
                            "reason": reason.lower(), "lap": m.get("lap_number")})
        return out

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
        """Incidents the stewards looked at, once each, dated by when they
        happened, paired with the verdict if one was published.

        verdict: "NO ACTION", "5S PENALTY", "10S PENALTY", "WARNING",
        "DRIVE THROUGH", "STOP AND GO", or "PENDING" when race control only
        says it will be looked at after the race."""
        if getattr(self, "_stw", None) is not None:
            return self._stw
        cases: list[dict] = []
        seen = set()
        for m in self.rc:
            msg = (m.get("message") or "").upper()
            if "NOTED" not in msg or "INVESTIGATION" in msg:
                continue
            cars = [int(n) for n in re.findall(r"(\d+) \([A-Z]{3}\)", msg)]
            if not cars:
                continue
            when = self.stamp_ts(m)
            stamped = when is not None
            if not when:
                # the first report often has no clock in it; the update, the
                # investigation and the verdict about the same cars do
                # (Baku 2026: the Turn 1 crash was lap 36, reported on lap 38)
                turn0 = re.search(r"TURN (\d+)", msg)
                later = [self.stamp_ts(v) for v in self.rc
                         if (v.get("date") or "") >= (m.get("date") or "")
                         and set(int(n) for n in re.findall(r"(\d+) \([A-Z]{3}\)", (v.get("message") or "").upper())) == set(cars)
                         and (not turn0 or f"TURN {turn0.group(1)} " in (v.get("message") or "").upper() + " ")]
                later = [t for t in later if t and t <= (parse_ts(m.get("date")) or t)]
                stamped = bool(later)
                when = min(later) if later else parse_ts(m.get("date"))
            if self.kind == "race" and when and self.race_start_ts and when < self.race_start_ts - timedelta(minutes=1):
                continue      # before the start: not an incident of this race
            if self.kind == "race" and stamped and when and self.race_end_ts and when > self.race_end_ts:
                continue      # stamped after the flag: the in-lap is not the race
            lap = self.lap_of(when) if when else None
            if lap is None and when and self.race_start_ts and when <= self.race_start_ts:
                lap = 1       # a false start happens seconds before lap 1 is stamped
            lap = lap or m.get("lap_number") or 0
            if not stamped:
                lap = None    # only the posting time: the lap it happened is unknown
            head, _, tail = msg.partition("NOTED")
            reason = re.sub(r"\(\d{1,2}:\d{2}:{1,2}\d{2}\)", "", tail).strip(" -")
            reason = re.sub(r"\s+[-–—]\s+", ": ", reason)
            reason = re.sub(r"RACE DIRECTORS? INSTRUCTIONS", "THE RACE DIRECTOR'S INSTRUCTIONS", reason)
            turn = re.search(r"TURN (\d+)", head)
            where = f"Turn {turn.group(1)}" if turn else ""
            offence = re.sub(r"\(\d{1,2}:\d{2}:{1,2}\d{2}\)", "", tail).strip(" -").split(" - ")[0].strip()
            key = (tuple(sorted(cars)), when.replace(microsecond=0) if when else lap)
            if msg.lstrip().startswith("UPDATE"):
                # "UPDATE: TURN 5 INCIDENT INVOLVING CARS 11 (PER) AND 22 (TSU)" is
                # the Turn 5 case already open for car 22 (Madrid 2026)
                prev = next((c for c in reversed(cases)
                             if set(c["cars"]) & set(cars)
                             and (c["where"] == where or c["offence"] == offence or not c["offence"])), None)
                if prev:
                    prev["cars"] = list(dict.fromkeys(prev["cars"] + cars))
                    if offence and not prev["offence"]:
                        prev["offence"] = offence
                    continue
            if key in seen:
                prev = next(c for c in cases if c["_key"] == key)
                if offence and not prev["offence"]:
                    # the update names the offence the first report left out
                    prev["offence"] = offence
                    r2 = re.sub(r"\(\d{1,2}:\d{2}:{1,2}\d{2}\)", "", tail).strip(" -")
                    r2 = re.sub(r"\s+[-\u2013\u2014]\s+", ": ", r2)
                    prev["reason"] = r2.title().replace("Director'S", "Director's") or prev["reason"]
                continue
            seen.add(key)
            verdict, secs, penalised, verdict_msg = "PENDING", 0, None, None
            for v in self.rc:
                vm = (v.get("message") or "").upper()
                if (v.get("date") or "") < (m.get("date") or "") or "STEWARDS" not in vm or v is m:
                    continue
                vcars = {int(n) for n in re.findall(r"(\d+) \([A-Z]{3}\)", vm)}
                if not vcars & set(cars):
                    continue
                if offence and offence not in vm:
                    continue
                pen = re.search(r"(\d+) SECOND TIME PENALTY FOR CAR (\d+)", vm)
                dt = re.search(r"(DRIVE[- ]THROUGH|STOP[- ]AND[- ]GO|STOP[- ]GO) PENALTY FOR CAR (\d+)", vm)
                warn = re.search(r"WARNING FOR CAR (\d+)", vm)
                if pen and "SERVED" not in vm:
                    verdict, secs = f"{pen.group(1)}S PENALTY", int(pen.group(1))
                    penalised, verdict_msg = int(pen.group(2)), vm
                    break
                if dt and "SERVED" not in vm:
                    verdict = "DRIVE THROUGH" if "DRIVE" in dt.group(1) else "STOP AND GO"
                    penalised, verdict_msg = int(dt.group(2)), vm
                    break
                if warn:
                    verdict, penalised, verdict_msg = "WARNING", int(warn.group(1)), vm
                    break
                if "NO FURTHER" in vm:
                    verdict = "NO ACTION"
                    break
            if not reason and verdict_msg:
                t2 = re.sub(r"\(\d{1,2}:\d{2}:{1,2}\d{2}\)", "", verdict_msg)
                bits = [b.strip(" -–") for b in re.split(r"\s[-–]\s", t2) if b.strip(" -–")]
                if len(bits) > 1 and "PENALTY" not in bits[-1]:
                    reason = bits[-1]
            cases.append({"_key": key, "lap": lap, "cars": cars, "where": where, "when": when,
                          "penalised": penalised, "verdict_msg": verdict_msg,
                          "reason": reason.title().replace("Director'S", "Director's"),
                          "offence": offence, "verdict": verdict, "secs": secs,
                          "raw": (m.get("message") or "")})
        cases.sort(key=lambda c: (c["when"] is None, c["when"] or 0))
        self._stw = cases
        return cases

    def incident_on(self, num: int, lap: int) -> dict | None:
        """A race-control incident involving this car on this lap or the one
        before: what the feed says instead of an invented failure."""
        for c in self.stewards():
            if num in c["cars"] and c["lap"] and lap - 1 <= c["lap"] <= lap:
                return c
        return None


CAR_NOUN = {"Red Bull Racing": "Red Bull", "Haas F1 Team": "Haas", "Racing Bulls": "Racing Bulls car",
            "Kick Sauber": "Sauber"}


def car(team: str) -> str:
    """The team as a car: 'the Red Bull', not 'the Red Bull Racing'."""
    return CAR_NOUN.get(team, team) if team else "car"


def a_team(team: str) -> str:
    """'a Mercedes', 'an Aston Martin', 'a Red Bull', 'a Haas'."""
    if not team:
        return "their car"
    noun = car(team)
    return ("an " if noun[:1].upper() in "AEIOU" else "a ") + noun


def ratio_words(r: float) -> str:
    """22s against a 15s margin is not '1 times' anything."""
    if r < 0.75:
        return "well under"
    if r < 1.25:
        return "about the same as"
    if r < 2:
        return f"{r:.1f} times"
    return f"{r:.0f} times"


def deleted_row(s: Session, raw: str) -> list[str]:
    """'CAR 1 (NOR) TIME 1:39.935 DELETED - TRACK LIMITS AT TURN 4' as a row:
    the driver, and the time he lost. Where the feed gives no time, the corner."""
    car = re.search(r"CAR (\d+)", raw.upper())
    who = s.name(int(car.group(1))) if car else "Somebody"
    t = re.search(r"TIME (\d+:\d\d\.\d+)", raw.upper())
    turn = re.search(r"TURN (\d+)", raw.upper())
    secs = None
    if t:
        mm, ss = t.group(1).split(":")
        secs = int(mm) * 60 + float(ss)
    # a "7:27.050" is an out-lap or a crawl back, not a flying lap anybody lost
    what = (t.group(1) if t and secs < 150 else
            f"at turn {turn.group(1)}" if turn else "a lap")
    return [who, what]


def plain_incident(s: Session, raw: str) -> str:
    """A race-control line as a sentence.

    The feed says things like "INCIDENT INVOLVING CAR 11 (PER) NOTED - FAILING
    TO FOLLOW RACE DIRECTORS INSTRUCTIONS - PRACTICE START INFRINGEMENT (13:02:11)".
    Title-casing that produced a bullet with a clock stamp, a car number and a
    dash in it, none of which a reader needs.
    """
    text = re.sub(r"\s*\(\d{2}:\d{2}:\d{2}\)", "", raw)
    cars = [int(n) for n in re.findall(r"(\d+) \([A-Z]{3}\)", text.upper())]
    who = names_list([s.name(n) for n in cars]) if cars else "somebody"
    # the reason is whatever follows the last separator
    parts = [p.strip(" -–—") for p in re.split(r"\s[-–—]\s", text) if p.strip(" -–—")]
    reason = parts[-1].lower() if len(parts) > 1 else "an incident"
    reason = reason.replace("race directors", "the race director's")
    verb = "noted" if "NOTED" in text.upper() else "under investigation"
    return f"{who}, {verb}: {reason}"


def place_swings(s: Session, grid_pos: dict[int, int]) -> list[tuple[int, int]]:
    """(places gained, driver) for everyone who finished and was classified.

    Both halves have to be real. A driver who is running at the flag but too
    far down to be classified -- Albon came home eleven laps adrift at
    Barcelona, outside the 90% of the winner's distance the rules ask for --
    is given no finishing position by the feed at all, and standing a 99 in
    for it turned his quiet afternoon into "81 places lost" on a card.
    """
    return [(grid_pos[r["driver_number"]] - r["position"], r["driver_number"])
            for r in s.result
            if not r.get("dnf") and r.get("position")
            and grid_pos.get(r["driver_number"])]


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
    finishers = [r["driver_number"] for r in s.result if s.finish_pos(r["driver_number"])]
    sprint = s.label.startswith("Sprint")

    def decoys(right: int, n: int = 2) -> list[int]:
        """Plausible wrong answers: drivers who finished near the front."""
        return [d for d in finishers if d != right][:n]

    def options(nums: list[int]) -> list[str]:
        # sorted by car number so the right answer is not always in slot one
        return [s.name(n) for n in sorted(nums)]

    # --- the climb: asked on lap 2, answered at the flag
    gains = place_swings(s, grid_pos)
    if gains:
        climb, num = max(gains)
        start, end = grid_pos[num], s.finish_pos(num)
        if climb > 1 and start and end:
            band = ("On the podium" if end <= 3 else
                    "Somewhere in the points" if end <= (8 if sprint else 10) else "Out of the points")
            add({"type": "prediction", "lap": 2,
                 "kicker": "Call it before it happens",
                 "title": f"{s.name(num)} starts P{start}. Where does he finish?",
                 "text": f"{s.total_laps} laps to make up ground from there.",
                 "options": ["On the podium", "Somewhere in the points", "Out of the points"],
                 "answer": band,
                 "reveal": f"P{start} to P{end}, {plural(climb, 'place')} gained."})

    # --- the fastest lap: asked well before it lands
    best = s.best_lap
    if best and len(finishers) >= 3:
        right = best["driver_number"]
        lap_of_best = best.get("lap_number") or s.total_laps
        add({"type": "prediction", "lap": max(2, int(lap_of_best * 0.55)),
             "kicker": "Call it before it happens",
             "title": "Who has the fastest lap on the board at the flag?",
             "text": "It usually lands late, when the car is light and the track has "
                     "rubber all over it.",
             "options": options([right] + decoys(right)),
             "answer": s.name(right),
             "reveal": f"{s.name(right)} on lap {lap_of_best}, {fmt(best['lap_duration'])}, "
                       f"in {a_team(s.team(right))}."})

    # --- somebody stops: asked before the car actually stops
    if s.dnfs and len(finishers) >= 2:
        r = s.dnfs[0]
        num = r["driver_number"]
        stop = s.stop_lap(num)
        if stop > 5:
            inc = s.incident_on(num, stop)
            add({"type": "prediction", "lap": max(2, stop - 5),
                 "kicker": "Call it before it happens",
                 "title": "One of these three does not see the chequered flag. Who?",
                 "text": "Nothing on the timing screens says it is coming.",
                 "options": options([num] + decoys(num)),
                 "answer": s.name(num),
                 "reveal": f"{s.name(num)}, on lap {stop} of {s.total_laps}. "
                           + (f"Race control had logged an incident involving "
                              f"{names_list([s.name(n) for n in inc['cars']])}"
                              + (f" at {inc['where']}" if inc["where"] else "") + f" on lap {inc['lap']}."
                              if inc else "The timing feed records that he stopped, not why.")})

    return out


# -------------------------------------------------------- you make the call
# The recap is not a documentary. At the real forks of the race it stops and
# hands the decision to the reader, with the same information the pit wall had
# and no more. Every state on these cards is read from the data, never invented.

def decision_cards(s: Session) -> list[dict]:
    out: list[dict] = []
    add = out.append
    sprint = s.label.startswith("Sprint")

    # --- the stewards' seat: a real incident with a real verdict
    cases = [c for c in s.stewards()
             if c["lap"] and c["verdict"] in ("NO ACTION", "5S PENALTY", "10S PENALTY")]
    if cases:
        def juice(c: dict) -> tuple:
            pos = min((s.finish_pos(n) or 99) for n in c["cars"])
            return (-len(c["cars"]), pos)

        c = sorted(cases, key=juice)[0]
        who = names_list([s.name(n) for n in c["cars"]])
        where = f" at {c['where']}" if c["where"] else ""
        offence = (c["reason"] or "").split(":")[0].strip().lower()
        if len(c["cars"]) >= 2:
            headline = (f"contact between {who}{where}" if "collision" in offence
                        else f"an incident between {who}{where}")
        else:
            headline = f"{offence or 'an incident'}, {who}"
        add({"type": "decision", "lap": c["lap"], "kicker": "You are the steward",
             "title": f"Lap {c['lap']}: {headline}. What do you give?",
             "text": "Race control has flagged it and it lands on your desk. Same "
                     "call the stewards had to make.",
             "state": [["Lap", f"{c['lap']} of {s.total_laps}"],
                       ["Cars involved", who],
                       ["Reported as", (c["reason"] or "Incident").split(":")[0].strip().title()
                        + (f"{where}" if where else "")]],
             "choices": [
                 {"id": "none", "label": "No further action",
                  "sub": "Racing incident, let them race"},
                 {"id": "5", "label": "5 second penalty", "sub": "Mild advantage gained"},
                 {"id": "10", "label": "10 second penalty", "sub": "Clearly at fault"}],
             "actual": {"NO ACTION": "none", "5S PENALTY": "5", "10S PENALTY": "10"}[c["verdict"]],
             "outcomes": {
                 "none": "You let it go. Nobody loses a place at a desk, and the "
                         "driver behind spends the rest of the race on the radio.",
                 "5": "Five seconds gets added at the next stop, or to the final time "
                      "if there is no stop left. Usually one position, sometimes none.",
                 "10": "Ten seconds is a real punishment and it almost always costs "
                       "track position, which is why teams argue so hard about it."},
             "reveal": (f"The stewards gave {s.name(c['penalised'])} a {c['secs']}s penalty."
                        + (f" He still finished P{s.finish_pos(c['penalised'])}."
                           if s.finish_pos(c["penalised"]) else
                           " He did not reach the flag." if c["penalised"] in {r['driver_number'] for r in s.dnfs}
                           else "")
                        if c["secs"] else "The stewards took no further action.")})

    # --- the safety car gamble
    for p in s.sc_periods[:1]:
        sc = p["lap"]
        left = s.total_laps - (sc or 0)
        if not sc or left < 2 or not p["end_ts"]:
            continue          # finished behind it, or no time left to decide anything
        order = s.order_at_ts(p["ts"])
        if not order:
            continue
        leader = order[0][1]
        comp, age = s.tyre_at_lap(leader, sc)
        if age is not None and age < 5:
            continue          # a leader on fresh tyres has no decision to make
        dived = {q["driver_number"] for q in s.stops_between(p["ts"], p["end_ts"] + timedelta(seconds=100))}
        add({"type": "decision", "lap": sc, "kicker": "Your call on the pit wall",
             "title": f"Safety car with {left} laps left. You are leading. Box or stay out?",
             "text": "The pack is bunched up behind you and a stop costs far less than "
                     "usual, except that everybody behind can copy you and the one who "
                     "does not gets the lead.",
             "state": [["Running", f"P1, {s.name(leader)}"], ["Laps left", str(left)]]
                      + ([["Tyres", f"{comp.title()}, {age} laps old"]] if comp and age is not None else [])
                      + [["Gap to P2", "Wiped out by the safety car"]],
             "choices": [
                 {"id": "box", "label": "Box for fresh tyres",
                  "sub": "Grip for the restart, hand over track position"},
                 {"id": "stay", "label": "Stay out and defend",
                  "sub": "Keep the lead on older tyres"}],
             "actual": "box" if leader in dived else "stay",
             "outcomes": {
                 "box": "New rubber under a safety car is close to free, and it only "
                        "works if the cars behind stay out. If they all follow you in, "
                        "you have spent your lead for nothing.",
                 "stay": "You keep the lead and restart on older tyres, with a queue of "
                         "fresher cars in your mirrors and no gap to hide in."},
             "reveal": (f"{s.name(leader)} came in. " if leader in dived
                        else f"{s.name(leader)} stayed out. ")
                       + "At the flag it was "
                       + ", ".join(f"P{r['position']} {s.name(r['driver_number'])}"
                                   for r in s.result[:3]) + "."})

    # --- the undercut: a green-flag call, only where there were green stops
    green_pits = [p for p in s.timed_stops
                  if p["lap_number"] not in s.dead_laps and not s.neutralised(p["ts"])]
    if len(green_pits) >= 4 and s.position:
        window = int(median(p["lap_number"] for p in green_pits))
        order = s.order_at_lap(window - 1)
        pair = None
        for i in range(1, min(6, len(order))):
            chaser, ahead = order[i][1], order[i - 1][1]
            if any(window - 3 <= l < window for l in s.pit_laps(chaser) + s.pit_laps(ahead)):
                continue      # one of them has only just stopped: no decision left
            gap = s.gap_at_lap(chaser, window - 1)
            comp, age = s.tyre_at_lap(chaser, window)
            if gap and gap <= 3.0 and age is not None and age >= 5:
                pair = (chaser, ahead, gap, comp, age)
                break
        if pair and window not in s.dead_laps:
            chaser, ahead, gap, comp, age = pair
            chaser_pos = next(p for p, n in order if n == chaser)
            lane = median(p["pit_duration"] for p in green_pits)
            stops = s.pit_laps(chaser)
            next_stop = next((l for l in stops if l >= window), None)
            ahead_next = next((l for l in s.pit_laps(ahead) if l >= window), None)
            fin = s.finish_pos(chaser)
            add({"type": "decision", "lap": window, "kicker": "Your call on the pit wall",
                 "title": f"You are {s.name(chaser)}, {gap:.1f}s behind "
                          f"{s.name(ahead)} and going nowhere. Now what?",
                 "text": "Stuck behind another car your tyres overheat and the car will "
                         "not turn. Stopping first gives you clean track for two or three "
                         "laps, which is the whole trick behind the undercut.",
                 "state": [["Running", f"P{chaser_pos}"],
                           ["Gap ahead", f"{gap:.1f}s to {s.name(ahead)}"],
                           ["Tyres", f"{comp.title()}, {age} laps old"],
                           ["Time in the pit lane", f"about {lane:.0f}s today"]],
                 "choices": [
                     {"id": "box", "label": "Box now and undercut",
                      "sub": "Fresh tyres, clean air, two laps to make it pay"},
                     {"id": "wait", "label": "Stay out and overcut",
                      "sub": "Let him stop first, then push on an empty track"},
                     {"id": "attack", "label": "Forget strategy, pass him",
                      "sub": "Send it and take the risk"}],
                 "actual": ("box" if next_stop and (ahead_next is None or next_stop <= ahead_next)
                            else "wait"),
                 "outcomes": {
                     "box": f"You spend about {lane:.0f}s in the lane and come out in "
                            "traffic, betting that two fast laps on new tyres are worth "
                            "more than the place you just gave up.",
                     "wait": "You stay on old rubber while he gets new ones, and you need "
                             "clean air plus a mistake from him to make it work.",
                     "attack": "Passing a car with the same tyres on the same fuel is the "
                               "hardest thing in the sport, and running into the back of "
                               "him ends both races."},
                 "reveal": ((f"{s.name(chaser)} came in that same lap."
                             if next_stop == window else
                             f"{s.name(chaser)} came in on lap {next_stop}, "
                             f"{plural(next_stop - window, 'lap')} after this"
                             + (lambda k: f", under {k}." if k else ".")(s.neutral_kind(next(
                                 (p['ts'] for p in s.real_pits if p['driver_number'] == chaser
                                  and p['lap_number'] == next_stop), None))))
                            if next_stop else
                            (f"{s.name(chaser)} did not stop again." if stops
                             else f"{s.name(chaser)} did not stop."))
                           + (f" He finished P{fin}" if fin else " He did not reach the flag")
                           + (f", {s.name(ahead)} P{s.finish_pos(ahead)}."
                              if s.finish_pos(ahead) else ".")})

    # --- what if: the counterfactual, labelled as one
    if s.dnfs:
        r = s.dnfs[0]
        num = r["driver_number"]
        stop = s.stop_lap(num)
        t_was = s.own_lap_ts(num, stop - 1) if stop > 2 else None
        was = next((p for p, n in s.order_at_ts(t_was) if n == num), None) if t_was else None
        left = s.total_laps - stop
        his = s.pace(num)
        rivals = [(s.pace(x["driver_number"]), x["driver_number"]) for x in s.result[:5]
                  if s.pace(x["driver_number"]) and x["driver_number"] != num]
        beaten = [n for t, n in rivals if his and t > his]
        winner_num = s.result[0]["driver_number"]
        winner_pace = s.pace(winner_num)
        win_delta = (his - winner_pace) if (his and winner_pace) else None
        if was and his and left >= 3:
            if was <= 3:
                choices = [("win", "He wins it", "The pace was there"),
                           ("podium", "Podium, not the win", "Close, but not enough"),
                           ("drop", "He drops back", "Tyres or traffic get him")]
                guess_id = "win" if win_delta is not None and win_delta < 0 else "podium"
            elif was <= (8 if sprint else 10):
                choices = [("podium", "He reaches the podium", "Enough pace to climb"),
                           ("points", "He keeps it in the points", "Holds roughly where he was"),
                           ("drop", "He drops out of the points", "Tyres or traffic get him")]
                guess_id = "points"
            else:
                choices = [("points", "He fights into the points", "A climb from there"),
                           ("hold", "He stays about where he was", "No pace to move"),
                           ("drop", "He drops further back", "Tyres or traffic get him")]
                guess_id = "hold"
            inc = s.incident_on(num, stop)
            add({"type": "decision", "lap": stop, "kicker": "What if",
                 "title": f"{s.name(num)} was P{was} a lap before his {'sprint' if sprint else 'race'} ended on lap {stop}. "
                          "Where does he finish if it had not?",
                 "text": "Nobody can answer this one for certain. You have his own lap "
                         "times to go on and nothing else.",
                 "state": [["Out on lap", f"{stop} of {s.total_laps}"],
                           [f"Start of lap {stop - 1}", f"P{was}"],
                           ["His median racing lap", fmt(his)],
                           ["Quicker than", f"{len(beaten)} of the eventual top five"]],
                 "choices": [{"id": i, "label": l, "sub": sub} for i, l, sub in choices],
                 "actual": "",
                 "outcomes": {i: sub + "." for i, l, sub in choices},
                 "reveal": (
                     "Our read from his own lap times, not a fact. "
                     + (f"He was lapping {abs(win_delta):.2f}s a lap "
                        f"{'quicker' if win_delta < 0 else 'slower'} than "
                        f"{s.name(winner_num)}, who went on to win it. "
                        if win_delta is not None else "")
                     + f"With {left} laps left, \"{next(l for i, l, _ in choices if i == guess_id).lower()}\" "
                       "is the honest guess, and nobody gets to check."
                     + (f" Race control had logged an incident involving "
                        f"{names_list([s.name(n) for n in inc['cars']])} on lap {inc['lap']}."
                        if inc else ""))})

    # --- guess the number
    if len(s.result) > 1:
        gap = q_gap(s.result[1])
        if gap:
            top = max(2.0, round(gap * 4, 1))
            step = 0.05 if top <= 5 else (0.1 if top <= 20 else 0.5)
            lane = median(p["pit_duration"] for p in green_pits) if len(green_pits) >= 3 else None
            dur = s.racing_time()
            add({"type": "guess", "lap": s.total_laps, "kicker": "Guess it",
                 "title": f"How far behind was {s.name(s.result[1]['driver_number'])} "
                          "at the flag?",
                 "text": f"{s.total_laps} laps" + (f", {dur} of racing" if dur else "")
                         + ", and it comes down to this one number.",
                 "unit": "s", "min": 0, "max": top, "step": step,
                 "target": round(gap, 3), "close": max(0.3, gap * 0.4),
                 "reveal": f"{gap:.3f} seconds after {s.total_laps} laps."
                           + (f" A trip down the pit lane took about {lane:.0f}s today, "
                              f"which is {ratio_words(lane / gap)} the margin this "
                              f"{'sprint' if sprint else 'race'} was decided by."
                              if lane and gap else "")})

    return out


# ------------------------------------------------------------- the mate
# The cards are the museum. This is the friend who watched it and is texting
# you about it, and who will answer whatever you want to ask him. Every number
# he uses comes from the same data as the cards, so he can be casual without
# being wrong.

def neutral_summary(s: Session) -> str:
    """'2 safety cars, a virtual safety car and a red flag', from the data."""
    bits = []
    reds = [parse_ts(m.get("date")) for m in s.rc
            if re.search(r"(?<![A-Z])RED FLAG", (m.get("message") or "").upper())]
    deployed = [parse_ts(m.get("date")) for m in s.messages("SAFETY CAR DEPLOYED")
                if "VIRTUAL" not in (m.get("message") or "").upper()]
    turned = sum(1 for r in reds[:1] if r and any(d and d <= r <= d + timedelta(minutes=15)
                                                  and not any(p["ts"] == d for p in s.sc_periods)
                                                  for d in deployed))
    n_sc = len(s.sc_periods) + turned
    if n_sc:
        bits.append(plural(n_sc, "safety car"))
    if s.vsc_periods:
        n = len(s.vsc_periods)
        bits.append("a virtual safety car" if n == 1 else f"{n} virtual safety cars")
    if s.red_laps:
        bits.append("a red flag")
    if not bits:
        return "no safety car"
    return bits[0] if len(bits) == 1 else ", ".join(bits[:-1]) + " and " + bits[-1]


def mate_thread(s: Session) -> dict:
    beats: list[dict] = []
    add = beats.append
    green = s.green_overtakes()
    winner = s.result[0]["driver_number"] if s.result else None
    sprint = s.label.startswith("Sprint")
    event = "sprint" if sprint else "race"
    grid_pos = s.start_grid()
    lane_times = [p["pit_duration"] for p in s.timed_stops
                  if p["lap_number"] not in s.dead_laps and not s.neutralised(p["ts"])]
    lane = median(lane_times) if len(lane_times) >= 3 else None
    scs = s.sc_periods
    wet_start = any((st.get("lap_start") or 0) == 1 and st.get("compound") in ("INTERMEDIATE", "WET")
                    for st in s.stints)

    rules = (["there's no compulsory stop in a sprint, so plenty of cars go the distance "
              "on one set"] if sprint else
             ["it started wet, so the usual two-compound rule didn't apply today"] if wet_start else
             ["in a dry race everyone has to use two different tyre types, so everyone "
              "stops at least once"
              + (f", and you spend about {lane:.0f} seconds in the pit lane when you do"
                 if lane else ""),
              "the whole sport is basically deciding WHEN to lose that time"])
    add({"lap": 0,
         "msgs": ["yo", f"you missed the {event}",
                  f"{s.total_laps} laps, {plural(len(green), 'pass', 'passes')} on track and "
                  + neutral_summary(s)],
         "asks": [
             {"q": "just tell me who won", "a": [
                 f"{s.name(winner)} 🏆" if winner else "nobody, weirdly",
                 (f"{car(s.team(winner))}, from P{grid_pos[winner]} on the grid"
                  if winner and grid_pos.get(winner) else s.team(winner) if winner else "")]},
             {"q": "was it actually good or are you being nice", "a": [
                 "you tell me lol",
                 f"{plural(len(green), 'pass', 'passes')} on track, not counting the ones in the "
                 "pit lane"]},
             {"q": "i know nothing about f1, start there", "a": [
                 f"ok so {s.starters} cars, lined up roughly in qualifying order, less any "
                 "grid penalties"] + rules}]})

    lap1 = s.lap1_passes()
    add({"lap": 1,
         "msgs": ["lights out",
                  f"{plural(len(lap1), 'place')} changed hands before they even finished lap 1"
                  if lap1 else "and everybody kept their place through lap 1, rare"],
         "asks": [
             {"q": "why is the start always so mad", "a": [
                 "cold tyres, cold brakes, full fuel tank and everybody going for the "
                 "same gap",
                 f"it's the only moment of the {event} where the whole field is that close"]},
             {"q": f"does the start decide the {event}", "a": [
                 "more than anyone admits",
                 "track position is everything on most circuits, you lose places on "
                 "lap 1 and you can spend a long time stuck behind someone slower"]}]})

    by_lap = Counter(ln for ln, _ in green)
    if by_lap:
        lap, n = by_lap.most_common(1)[0]
        near = sum(1 for p in s.real_pits if abs(p["lap_number"] - lap) <= 1)
        if n >= 5:
            add({"lap": lap,
                 "msgs": [f"lap {lap} was the busiest of the whole {event}",
                          f"{n} passes on that lap alone"],
                 "asks": ([{"q": "why do they all overtake at the same time", "a": [
                     f"{near} cars had just stopped around then",
                     "you come out on new tyres next to someone on old ones and passing "
                     "gets a lot easier"]}] if near >= 3 else [])
                         + [{"q": "are those real passes", "a": [
                             "yeah, only moves made on track count here",
                             "swaps in the pit lane and stuff behind the safety car are "
                             "left out"]}]})

    if scs:
        p = scs[0]
        sc = p["lap"] or s.lap_of(p["ts"]) or 1
        add({"lap": sc,
             "msgs": [f"SAFETY CAR on lap {sc}",
                      f"{s.total_laps - sc} laps left and every gap just got deleted"
                      if p["end_ts"] else f"and the {event} finished behind it"]
                     + (["and then it turned into a red flag"] if p.get("red") else []),
             "asks": [
                 {"q": "explain safety car like i'm five", "a": [
                     "something's on track that shouldn't be, so a road car comes out "
                     "and everyone has to queue up behind it at reduced speed",
                     "if you'd built a big lead, it's gone. the guy in P2 is now right "
                     "behind you"]},
                 {"q": "so is pitting under it free", "a": [
                     "close to it. everyone's going slow so you lose way less time "
                     "stopping",
                     "the catch is everyone behind you can do the same thing, and "
                     "whoever doesn't follow you inherits the lead"]}]})

    stops = s.real_pits
    if len(stops) >= 5:
        window = int(median(p["lap_number"] for p in stops))
        close = sum(1 for p in stops if abs(p["lap_number"] - window) <= 3)
        if close * 2 >= len(stops):
            add({"lap": window,
                 "msgs": [f"most of the stops came around lap {window}",
                          "this is the bit TV makes look boring and where a lot gets decided"],
                 "asks": [
                     {"q": "why not just stop early every time", "a": [
                         "new tyres are quickest for the first few laps, then they start "
                         "going off",
                         "stop too early and you're on worn rubber at the end with everyone "
                         "hunting you. stop too late and someone's already jumped you"]},
                     {"q": "what's an undercut", "a": [
                         "you pit before the guy ahead, do fast laps on new tyres while he's "
                         "still out there on old ones",
                         "if it works he comes out behind you after his stop. you never "
                         "passed him on track, you passed him in the pit lane"]}]})

    if s.dnfs:
        r = s.dnfs[0]
        num = r["driver_number"]
        stop = s.stop_lap(num)
        inc = s.incident_on(num, stop)
        pts = r.get("points") or 0
        add({"lap": stop,
             "msgs": [f"and {s.name(num)} is out", f"lap {stop}, his {event} ended there"],
             "asks": [
                 {"q": "what happened", "a": (
                     [f"race control logged an incident with "
                      f"{names_list([s.name(n) for n in inc['cars']])} on lap {inc['lap']}",
                      "that's all the data says, teams give the detail later"]
                     if inc else
                     ["honestly not sure, the data only tells me he stopped, not why",
                      "teams give the detail later, if at all"])},
                 {"q": "does he get any points", "a": (
                     [f"actually yes, he'd done enough laps to be classified, "
                      f"{pts:.0f} point{'s' if pts != 1 else ''}"] if pts else
                     ["nope, not today"])}]})

    best = s.best_lap
    if best:
        bl = best.get("lap_number") or s.total_laps
        late = bl >= s.total_laps * 0.8
        add({"lap": bl,
             "msgs": [f"fastest lap of the {event} went to {s.name(best['driver_number'])}",
                      f"{fmt(best['lap_duration'])}, on lap {bl}"],
             "asks": [
                 {"q": "is fastest lap worth anything", "a": (
                     ["no points for it in a sprint, never has been"] if sprint else
                     ["not anymore, there's been no point for it since 2025",
                      "it's bragging rights now"])}]
                     + ([{"q": f"why is it late in the {event}", "a": [
                         "car's light, almost no fuel left, and the track has rubber all "
                         "over it by then"]}] if late else [])})

    if s.result:
        top = s.result[:3]
        add({"lap": s.total_laps,
             "msgs": ["chequered flag",
                      " · ".join(f"P{r['position']} {s.name(r['driver_number'])}"
                                 for r in top)],
             "asks": [
                 {"q": "was the winner just in the fastest car", "a": [
                     "partly, always. the median lap times are the honest read on who "
                     "had the pace",
                     "the true pace card is the one i'd trust"]}]})

    beats.sort(key=lambda b: b["lap"])
    return {"session": s.label, "beats": beats}


# ------------------------------------------------------------------ race
def merged_stints(s: Session) -> list[dict]:
    """One entry per set of tyres. The feed splits a set into two stints at a
    lane visit where the tyres were not changed; that is still one set."""
    out = []
    by: dict[int, list[dict]] = defaultdict(list)
    for st in s.stints:
        by[st.get("driver_number")].append(st)
    for d, sts in by.items():
        sts = sorted(sts, key=lambda st: st.get("lap_start") or 0)
        cur = None
        for st in sts:
            a, b = st.get("lap_start") or 0, st.get("lap_end") or 0
            if not a or not b or st.get("compound") in (None, "UNKNOWN"):
                cur = None
                continue
            if cur and st.get("compound") == cur["compound"] and \
                    (st.get("tyre_age_at_start") or 0) >= cur["age"] + (cur["end"] - cur["start"] + 1) - 2 \
                    and a <= cur["end"] + 1:
                cur["end"] = min(b, s.total_laps)
                continue
            cur = {"driver_number": d, "compound": st.get("compound"), "start": a, "end": min(b, s.total_laps),
                   "age": st.get("tyre_age_at_start") or 0}
            out.append(cur)
    return out


def race_story(s: Session) -> list[dict]:
    if not s.result:
        return []
    cards: list[dict] = []
    green = s.green_overtakes()
    ov_by_driver = Counter(o["overtaking_driver_number"] for _, o in green)
    grid_pos = s.start_grid()
    winner = s.result[0]
    add = cards.append
    sprint = s.label.startswith("Sprint")
    event = "sprint" if sprint else "race"
    scs = s.sc_periods
    vscs = s.vsc_periods

    red_msgs = [m for m in s.rc
                if re.search(r"(?<![A-Z])RED FLAG", (m.get("message") or "").upper())
                and s.in_session(parse_ts(m.get("date")))]

    add({"type": "cover", "lap": 0,
         "kicker": f"{GP['short']} · {s.label} · {s.total_laps} laps",
         "title": "Everything that happened, in order",
         "text": f"{plural(len(green), 'on-track pass', 'on-track passes')}, "
                 f"{plural(len(s.real_pits), 'pit stop')}, "
                 ""
                 + (f"{plural(len(s.dnfs), 'car')} that never finished" if s.dnfs
                    else "" if s.unclassified else "every starter at the flag")
                 + ((", " if s.dnfs else "") + f"{plural(len(s.unclassified), 'car')} not classified"
                    if s.unclassified else "")
                 + (f", {plural(len(scs), 'safety car')}" if scs else "")
                 + (f", {plural(len(vscs), 'virtual safety car')}" if vscs else "")
                 + (" and a red flag that stopped the race" if red_msgs else "")
                 + "."})

    # --- the start ---
    lap1 = s.lap1_passes()
    after1 = {n: p for p, n in s.order_at_lap(1)}
    gainers = sorted(((grid_pos[n] - p, n) for n, p in after1.items()
                      if grid_pos.get(n) and grid_pos[n] - p > 0), reverse=True)
    sc_lap1 = any((p["lap"] or 0) <= 1 for p in scs)
    add({"type": "moment", "lap": 1, "kicker": "Lap 1 · Lights out",
         "title": (f"{plural(len(lap1), 'place')} changed hands on track before the first lap was done"
                   if lap1 else "The order held through the first lap"),
         "text": f"{s.starters} cars into the first corner on cold tyres and full tanks.",
         "bullets": ((lambda tops, g: [
                         f"{names_list([s.name(n) for n in tops])} gained the most by the end of it, "
                         f"{plural(g, 'place')}" + (" each" if len(tops) > 1 else "")
                         if len(tops) <= 3 else
                         f"{len(tops)} drivers gained {plural(g, 'place')} each, the most of anybody"])(
                         [n for g, n in gainers if g == gainers[0][0]], gainers[0][0])
                     if gainers else [])
                    + (["The safety car came out on the opening lap"] if sc_lap1 else [])
                    + (lambda wet: [f"{plural(len(wet), 'car')} started on "
                                    + ("intermediates" if all(c == "INTERMEDIATE" for c in wet.values())
                                       else "wet-weather tyres")] if wet else [])(
                        {st["driver_number"]: st.get("compound") for st in s.stints
                         if (st.get("lap_start") or 0) == 1 and st.get("compound") in ("INTERMEDIATE", "WET")})
                    + ["Most of this is the pack sorting itself out. Some of it "
                       f"decides the {event}"]})

    # --- busiest green-flag laps ---
    for lap, n in Counter(ln for ln, _ in green).most_common(3):
        if n < 5:
            continue
        movers = Counter(o["overtaking_driver_number"] for ln, o in green if ln == lap)
        near = sum(1 for p in s.real_pits if abs(p["lap_number"] - lap) <= 1)
        note = (f"{plural(near, 'car')} stopped within a lap of it, and new tyres against "
                "old ones make passing far easier"
                if near >= 3 else
                "A couple of laps after the restart, with the field still sorting "
                "itself out" if any(0 < lap - r <= 3 for r in s.restart_laps) else
                "Early on, with full tanks and the order still settling" if lap <= 8 else
                "Every one of them on track, with no stops around it")
        add({"type": "moment", "lap": lap, "kicker": f"Lap {lap} · Traffic",
             "title": f"{n} passes on this lap alone",
             "text": "Only moves made on track count here, at racing speed.",
             "bullets": [f"Made by {names_list([s.name(num) for num, _ in movers.most_common(3)])}"
                         if len(movers) <= 3 else
                         f"{len(movers)} different drivers gained a place on this lap",
                         note]})

    # --- fights for the lead ---
    lead = [(ln, o) for ln, o in green if (o.get("position") or 99) == 1]
    if lead and len(lead) <= 6:
        ln, o = lead[0]
        add({"type": "moment", "lap": ln, "kicker": f"Lap {ln} · For the lead",
             "title": f"{s.name(o['overtaking_driver_number'])} takes the lead from "
                      f"{s.name(o['overtaken_driver_number'])}",
             "text": "A pass for the lead, made on track at racing speed."})

    # --- the busiest driver ---
    if ov_by_driver and max(ov_by_driver.values()) >= 2:
        top_d, n = tie_names(s, ov_by_driver)
        num = top_d[0]
        who = names_list([s.name(d) for d in top_d])
        fin = s.finish_pos(num)
        add({"type": "moment", "lap": max(2, s.total_laps // 3),
             "kicker": "The one doing the passing",
             "title": f"{who}: {plural(n, 'pass', 'passes')} {'each' if len(top_d) > 1 else ''}".strip(),
             "text": (f"Level on the most passes on track." if len(top_d) > 1
                      else f"More than anybody else out there, in {a_team(s.team(num))}."),
             "bullets": ([f"P{grid_pos[num]} on the grid, "
                          + (f"P{fin} at the flag" if fin else "and did not reach the flag")]
                         if len(top_d) == 1 and grid_pos.get(num) else [])
                        + ["Only moves made on track count, with the car ahead at "
                           "racing speed"],
             "dato": {"label": "Most passes",
                      "rows": [[s.name(d), c] for d, c in ov_by_driver.most_common(6)]}})

    # --- long runs within a second ---
    stuck = s.battles()
    if stuck:
        num, laps, a, b = stuck[0]
        add({"type": "moment", "lap": b, "kicker": "Within a second",
             "title": f"{s.name(num)}: {laps} laps within a second of the car ahead",
             "text": f"The longest unbroken run like it in the {event}, from lap {a} to lap {b}, "
                     "at racing speed.",
             "bullets": ([f"{plural(len(stuck) - 1, 'other driver')} had a run of five laps "
                          "or more like it"] if len(stuck) > 1 else [])
                        + ["Following closely costs the car downforce and cooks the "
                           "front tyres, so sitting there is harder than it looks"]})

    # --- pit strategy ---
    real_pits = s.real_pits
    timed = s.timed_stops
    by_lap = Counter(p["lap_number"] for p in real_pits)
    window = int(median(p["lap_number"] for p in real_pits)) if real_pits else 0
    if real_pits and by_lap and by_lap.most_common(1)[0][1] >= 2:
        busiest_lap, busiest_n = by_lap.most_common(1)[0]
        tied_laps = [l for l, c in by_lap.items() if c == busiest_n]
        kinds = [s.neutral_kind(p["ts"]) for p in real_pits if p["lap_number"] == busiest_lap]
        n_under = sum(1 for k in kinds if k)
        under = next((k for k in kinds if k), None)
        tail = (f" under {under}" if under and n_under == busiest_n else
                f", {n_under} of them under {under}" if under and n_under * 2 > busiest_n else "")
        bullets = [(f"Busiest single lap was {busiest_lap}, with {busiest_n} cars in" + tail)
                   if len(tied_laps) == 1 else
                   f"{busiest_n} cars in on each of laps "
                   + names_list([str(l) for l in sorted(tied_laps)], cap=5)]
        if len(timed) >= 2:
            lo = min(p["pit_duration"] for p in timed)
            hi = max(p["pit_duration"] for p in timed)
            los = [s.name(p["driver_number"]) for p in timed if round(p["pit_duration"], 1) == round(lo, 1)]
            his = [s.name(p["driver_number"]) for p in timed if round(p["pit_duration"], 1) == round(hi, 1)]
            bullets += [f"Shortest time in the pit lane: {names_list(list(dict.fromkeys(los)))}, {lo:.1f}s",
                        f"Longest: {names_list(list(dict.fromkeys(his)))}, {hi:.1f}s",
                        "Pit lane time runs from the entry line to the exit line, stop "
                        "included"]
        add({"type": "moment", "lap": window, "kicker": f"Lap {window} · Pit window",
             "title": (f"{plural(len(real_pits), 'stop')}, all of them on lap {busiest_lap}"
                       if busiest_n == len(real_pits) else
                       f"{plural(len(real_pits), 'stop')}, and the busiest lap saw {busiest_n} of them"),
             "text": "Once one car stops, the cars around it have to answer.",
             "bullets": bullets})

    if real_pits:
        stops_per_driver = Counter(p["driver_number"] for p in real_pits)
        typical = s.typical_stops()
        most_d, most_n = tie_names(s, stops_per_driver)
        if len(most_d) == 1 and most_n >= 3 and most_n > typical:
            most = most_d[0]
            words = {3: "Three", 4: "Four", 5: "Five", 6: "Six"}
            laps_in = s.pit_laps(most)
            neut = sum(1 for p in real_pits if p["driver_number"] == most and s.neutralised(p["ts"]))
            add({"type": "moment", "lap": min(window + 4, s.total_laps), "kicker": "Off the script",
                 "title": f"{s.name(most)} stopped {most_n} times",
                 "text": f"{words.get(most_n, str(most_n))} stops when most of the field "
                         f"made {typical if typical else 'none'}.",
                 "bullets": [f"In on laps {names_list([str(l) for l in laps_in], cap=6)}"]
                            + ([("All of them" if neut == most_n else
                                 "One of them" if neut == 1 else f"{neut} of them")
                                + " under a safety car or VSC"] if neut else [])})

    # --- tyres ---
    sets = merged_stints(s)
    finishers = [r["driver_number"] for r in s.result if not r.get("dns") and not r.get("dnf")]
    stopped = {p["driver_number"] for p in real_pits}
    never = [n for n in finishers if n not in stopped]
    if len(never) >= 4 and len(never) * 2 >= len(finishers):
        firsts = {}
        for st in sorted(s.stints, key=lambda st: st.get("lap_start") or 0):
            if st.get("driver_number") in never and st["driver_number"] not in firsts \
                    and st.get("compound") not in (None, "UNKNOWN"):
                firsts[st["driver_number"]] = st["compound"]
        by_c = Counter(firsts.values())
        split = [(f"{c.lower()}s for {names_list([s.name(n) for n in firsts if firsts[n] == c])}"
                  if k <= 2 else f"{c.lower()}s for {k}") for c, k in by_c.most_common()]
        add({"type": "moment", "lap": s.total_laps, "kicker": "Tyres",
             "title": f"{len(never)} of {s.starters} cars never stopped",
             "text": ("Nobody who finished needed a second set." if len(never) == len(finishers)
                      else "One set of tyres took most of the field to the flag."),
             "bullets": ([("On one set the whole way: " + ", ".join(split)).replace(": m", ": M").replace(": s", ": S").replace(": h", ": H")]
                         if split else [])
                        + ["Every lap you stretch is a lap you do not lose in the pit lane"]})
    elif sets:
        span_of = lambda st: st["end"] - st["start"] + 1
        top = max(span_of(st) for st in sets)
        longest = [st for st in sets if span_of(st) == top]
        first = longest[0]
        same = all(st["compound"] == first["compound"] and st["start"] == first["start"] for st in longest)
        red = set(s.red_laps)
        free = bool(red) and (first["start"] - 1) in red and same
        who = names_list(list(dict.fromkeys(s.name(st["driver_number"]) for st in longest)))
        add({"type": "moment", "lap": first["end"],
             "kicker": "Tyres",
             "title": f"{who} ran one set for {top} laps" + (" each" if len(longest) > 1 else ""),
             "text": "The longest anybody stayed out on one set.",
             "bullets": ([f"On the {first['compound'].lower()}s, lap {first['start']} to lap {first['end']}"]
                         if same else
                         [f"{s.name(st['driver_number'])}: {st['compound'].lower()}s, lap {st['start']} to {st['end']}"
                          for st in longest[:4]])
                        + ([f"The set already had {plural(first['age'], 'lap')} on it when it went on"]
                           if first["age"] and len(longest) == 1 else [])
                        + (["Fitted while the race was stopped under the red flag, "
                            "and then never changed"]
                           if free else
                           ["Every lap you stretch is a lap you do not lose in the "
                            "pit lane",
                            "And every lap you stretch is a set of tyres getting slower "
                            "underneath you"])})

    # --- virtual safety cars: the gaps freeze, they do not vanish ---
    for a, b in vscs:
        lap = s.lap_of(a) or 1
        order = s.order_at_ts(a)
        leader = order[0][1] if order else None
        under = list(dict.fromkeys(p["driver_number"] for p in s.stops_between(a, b + timedelta(seconds=30))))
        finished = s.race_end_ts and b >= s.race_end_ts - timedelta(seconds=5)
        ended = s.lap_of(b)
        add({"type": "moment", "lap": lap,
             "kicker": f"Lap {lap} of {s.total_laps} · Virtual Safety Car",
             "title": "Everybody slows down, nobody bunches up",
             "text": "Every car is held to a delta time exactly where it is. The "
                     "gaps freeze instead of vanishing, which is the whole "
                     "difference from a real safety car.",
             "bullets": ([f"{s.name(leader)} was leading when it was called"] if leader else [])
                        + ([names_list([s.name(n) for n in under])
                            + (" took a stop under it" if len(under) == 1 else " stopped under it")]
                           if under else [])
                        + (["The race finished under it"] if finished else
                           [f"Lifted on lap {ended}"] if ended else []),
             "note": "A stop under a VSC costs less than one at racing speed, "
                     "because everybody else is going slowly too. Cheaper, not free: "
                     "the leader keeps his gap and the queue behind him keeps "
                     "its shape."})

    # --- safety cars ---
    for p in scs:
        lap = p["lap"] or s.lap_of(p["ts"]) or 1
        order = s.order_at_ts(p["ts"])
        leader = order[0][1] if order else None
        end = p["end_ts"] or s.race_end_ts or p["ts"] + timedelta(minutes=10)
        dived = list(dict.fromkeys(q["driver_number"] for q in s.stops_between(p["ts"], end + timedelta(seconds=60))))
        others = [n for n in dived if n != leader]
        end_lap = p["end_lap"] or (s.lap_of(p["end_ts"]) if p["end_ts"] else None)
        restarted = bool(p["end_ts"]) and not p.get("red") and (end_lap or 0) < s.total_laps
        lesson = ([("A lead built over a long run was worth nothing at the restart, and "
                    "whoever had fresher tyres underneath him suddenly had a race again")
                   if lap > 12 else
                   ("This early, nobody had a lead to lose. What it did do was hand a "
                    "cheap stop to whoever was ready to take one")] if restarted else [])
        add({"type": "moment", "lap": lap,
             "kicker": f"Lap {lap} of {s.total_laps} · Safety Car",
             "title": "Every gap on track, erased",
             "text": "The field bunches up behind the safety car, and whatever anybody "
                     "had built is gone.",
             "bullets": ([f"{s.name(leader)} was leading when it came out"] if leader else [])
                        + ((["He took a stop under it"
                             + (f", and so did {names_list([s.name(n) for n in others])}" if others else "")])
                           if leader in dived else
                           ([f"He stayed out while {names_list([s.name(n) for n in others])} "
                             f"{'took a stop' if len(others) == 1 else 'stopped'} under it"]
                            if others else []))
                        + ([f"Neutralised until lap {end_lap}"] if restarted and end_lap else
                           [f"It ended in a red flag on lap {end_lap}"] if p.get("red") and end_lap else
                           [f"The {event} finished behind it"] if not p["end_ts"] else [])
                        + lesson})

    # --- red flag: one card, whatever category the feed filed it under ---
    if red_msgs:
        rt = min(parse_ts(m.get("date")) for m in red_msgs)
        lap = s.lap_of(rt) or red_msgs[0].get("lap_number") or 1
        order = s.order_at_ts(rt)
        leader = order[0][1] if order else None
        calls = [m for m in sorted(s.messages("STANDING START", "ROLLING START"),
                                   key=lambda x: x.get("date") or "")
                 if parse_ts(m.get("date")) and parse_ts(m.get("date")) > rt]
        calls = [m for m in calls
                 if parse_ts(m["date"]) <= parse_ts(calls[0]["date"]) + timedelta(minutes=20)] if calls else []
        restart = calls[-1] if calls else None
        sc_first = any(p0["ts"] <= rt <= p0["ts"] + timedelta(minutes=15)
                       for p0 in [{"ts": parse_ts(m.get("date"))} for m in s.messages("SAFETY CAR DEPLOYED")
                                  if "VIRTUAL" not in (m.get("message") or "").upper()]
                       if p0["ts"])
        kind = "standing" if restart and "STANDING" in (restart.get("message") or "").upper() else "rolling"
        add({"type": "moment", "lap": lap,
             "kicker": f"Lap {lap} of {s.total_laps} · Red flag",
             "title": f"The {event} was stopped",
             "text": ("A safety car first, then the red flag: " if sc_first else "Red flag: ")
                     + "everybody into the pit lane and a wait for the track to be made safe.",
             "bullets": ([f"{s.name(leader)} was leading when it happened"] if leader else [])
                        + ([f"{kind.title()} restart on lap {restart.get('lap_number')}"]
                           if restart and restart.get("lap_number") else [])
                        + ["Teams can change tyres while the cars wait, which rewrites "
                           "the strategies on the grid"]})

    in_race = [m for m in s.rc_live if s.in_session(parse_ts(m.get("date")))]

    # --- flags and stewards ---
    yellows = [m for m in in_race if m.get("flag") in ("YELLOW", "DOUBLE YELLOW")]
    if yellows:
        sectors = Counter(int(x.group(1)) for x in
                          (re.search(r"SECTOR (\d+)", (m.get("message") or "").upper()) for m in yellows) if x)
        n_sectors = len(sectors)
        top_s, top_n = tie_names(s, sectors)
        laps_y = sorted(m.get("lap_number") or 1 for m in yellows)
        add({"type": "moment", "lap": laps_y[len(laps_y) // 2],
             "kicker": "Yellow flags", "title": f"Yellow flags out {plural(flag_events(yellows), 'time')}",
             "text": "Race control waves a yellow for anything on or near the track that "
                     "should not be there.",
             "bullets": ["A yellow means slow down and do not overtake in that part of "
                         "the track"]
                        + ([f"Track sector {top_s[0]} saw {plural(top_n, 'call')}, more than anywhere else"]
                           if len(top_s) == 1 and top_n >= 3 else
                           [f"Track sectors {names_list([str(x) for x in sorted(top_s)])} saw "
                            f"{top_n} each, the most of anywhere"]
                           if len(top_s) > 1 and top_n >= 3 else [])})

    blues = [m for m in in_race if m.get("flag") == "BLUE"]
    if len(blues) > 20:
        add({"type": "moment", "lap": int(s.total_laps * 0.6), "kicker": "Blue flags",
             "title": f"{len(blues)} blue flags waved",
             "text": "That is how often a lapped car was told to let the leaders through."})

    cases = s.stewards()
    if cases:
        first = next((c for c in cases if c["lap"]), None)
        n_pen = sum(1 for c in cases if c["verdict"] not in ("NO ACTION", "PENDING", "WARNING"))
        n_none = sum(1 for c in cases if c["verdict"] == "NO ACTION")
        n_pend = sum(1 for c in cases if c["verdict"] == "PENDING")
        n_warn = sum(1 for c in cases if c["verdict"] == "WARNING")
        tally = [x for x in (
            f"{n_pen} ended in a penalty" if n_pen else "",
            f"{n_none} in no further action" if n_none else "",
            f"{n_warn} in a warning" if n_warn else "",
            f"{n_pend} left for after the {event}" if n_pend else "") if x]
        add({"type": "moment", "lap": (first or {}).get("lap") or s.total_laps,
             "kicker": "Stewards", "title": f"{plural(len(cases), 'incident')} looked at",
             "text": ("Every one of them logged" if len(cases) > 1 else "Logged")
                     + " by race control during the " + event + ".",
             "bullets": ([f"Lap {first['lap']}: "
                          f"{names_list([s.name(n) for n in first['cars']])}, "
                          f"{(first['offence'] or 'an incident').lower()}"] if first else [])
                        + ([", ".join(tally[:-1]) + (" and " if len(tally) > 1 else "") + tally[-1]]
                           if tally else [])})

    pens = [p for p in s.penalties()]
    if pens:
        def pen_line(p):
            what = f"a {p['kind']} penalty" if p["secs"] else p["kind"]
            return f"{s.name(p['car'])}: {what}" + (f" for {p['reason']}" if p["reason"] else "")
        add({"type": "moment", "lap": pens[0]["lap"] or s.total_laps,
             "kicker": "Penalties",
             "title": f"{plural(len(pens), 'penalty', 'penalties')} handed out",
             "text": "Given by the stewards during the " + event + ".",
             "bullets": [pen_line(p) for p in pens[:3]]
                        + ([f"And {len(pens) - 3} more"] if len(pens) > 3 else [])
                        + (["A time penalty is served at the next stop, or added to the "
                            "final time when there is no stop left"]
                           if any(p["secs"] for p in pens) else [])
                        + (["A drive-through is a trip down the pit lane at the speed "
                            "limit without stopping"]
                           if any(p["kind"] == "a drive-through" for p in pens) else [])})

    deleted = s.deleted_in_session()
    if deleted:
        per = Counter(int(g) for m in deleted
                      for g in re.findall(r"CAR (\d+)", (m.get("message") or "").upper())[:1])
        worst, wn = tie_names(s, per)
        add({"type": "moment", "lap": deleted[0].get("lap_number") or 1,
             "kicker": "Track limits",
             "title": f"{plural(len(deleted), 'lap time')} deleted",
             "text": "The white line is the track, and the lap simply stops "
                     "counting if you leave it.",
             "bullets": ([f"{names_list([s.name(d) for d in worst])} lost {wn} "
                          + ("each, the most of anybody" if len(worst) > 1 else "that way, more than anybody")]
                         if wn >= 2 else [])
                        + ["Keep doing it and it turns into a penalty"]})

    # --- retirements ---
    for r in s.dnfs:
        num = r["driver_number"]
        stop = s.stop_lap(num)
        t0 = s.own_lap_ts(num, stop - 1) if stop > 2 else None
        was = next((p for p, n in s.order_at_ts(t0) if n == num), None) if t0 else None
        inc = s.incident_on(num, stop)
        add({"type": "moment", "lap": stop, "kicker": f"Lap {stop} · Retirement",
             "title": f"{s.name(num)} is out",
             "text": f"His {event} ends on lap {stop} of {s.total_laps}, in {a_team(s.team(num))}.",
             "bullets": ([f"P{was} at the start of lap {stop - 1}"] if was else [])
                        + ([f"Started P{grid_pos[num]}"] if grid_pos.get(num) else [])
                        + ([plural(ov_by_driver[num], 'on-track pass', 'on-track passes')
                            + " before it happened"] if ov_by_driver.get(num) else [])
                        + ([f"Race control logged an incident with "
                            f"{names_list([s.name(n) for n in inc['cars']])}"
                            + (f" at {inc['where']}" if inc["where"] else "") + f" on lap {inc['lap']}"]
                           if inc else
                           ["The timing feed records that he stopped, not why"])})

    # --- pace and speed ---
    best = s.best_lap
    if best:
        bl = best.get("lap_number") or s.total_laps
        late = bl >= s.total_laps * 0.8
        mid = not late and bl >= s.total_laps * 0.5
        add({"type": "moment", "lap": bl,
             "kicker": f"Lap {bl} · Fastest lap",
             "title": f"{s.name(best['driver_number'])}: {fmt(best['lap_duration'])}",
             "text": f"The quickest anybody went all {event}, in {a_team(s.team(best['driver_number']))}.",
             "bullets": ([f"Set on lap {bl} of {s.total_laps}, late on, where they usually land",
                          "By then the fuel is nearly gone and the car is at its lightest"]
                         if late else
                         [f"Set on lap {bl} of {s.total_laps}, in the second half, with the car "
                          "already lighter than at the start"] if mid else
                         [f"Set on lap {bl} of {s.total_laps}, early for a fastest lap, with "
                          "plenty of fuel still on board"])
                        + (["A sprint has never paid a point for it"] if sprint else
                           ["It is worth no points: the bonus point for it was dropped "
                            "after 2024"]),
             "dato": {"label": "Best sector times",
                      "rows": [[f"{sec} · {who}", f"{t:.3f}s"]
                               for sec, who, t in s.sector_kings()]}})

    trap = s.speed_trap()
    if trap:
        who, kmh = trap
        add({"type": "moment", "lap": int(s.total_laps * 0.45), "kicker": "Speed trap",
             "title": f"{names_list([s.name(d) for d in who])} hit {kmh} km/h",
             "text": "The fastest car in a straight line is often not the "
                     "fastest car over a lap.",
             "bullets": ([f"{s.name(who[0])} did it in {a_team(s.team(who[0]))}"] if len(who) == 1 else [])
                        + ["Top speed says as much about wing level, and about sitting "
                           "in somebody's tow, as it does about the engine"]})

    # --- pace ranking, the honest one ---
    ranked = sorted(((s.pace(r["driver_number"]), r["driver_number"])
                     for r in s.result if s.pace(r["driver_number"])), key=lambda x: x[0])
    if len(ranked) >= 5:
        add({"type": "moment", "lap": int(s.total_laps * 0.7), "kicker": "True pace",
             "title": f"{s.name(ranked[0][1])} had the quickest median racing lap",
             "text": "No lap 1, no laps in or out of the pits, nothing behind the "
                     "safety car or the VSC, and the slow outliers trimmed. It does not "
                     "always match the result.",
             "dato": {"label": "Median racing lap",
                      "rows": [[s.name(n), fmt(t)] for t, n in ranked[:6]]}})

    # --- movers ---
    gains = place_swings(s, grid_pos)
    if gains:
        climb, num = max(gains)
        if climb > 1:
            ended = s.finish_pos(num)
            famous = ended is not None and ended <= 3
            fell = sum(1 for r in s.dnfs if (grid_pos.get(r["driver_number"]) or 99) < grid_pos[num])
            add({"type": "moment", "lap": max(2, s.total_laps - 4),
                 "kicker": "The drive of the day" if famous else "A climb through the field",
                 "title": f"{s.name(num)}: P{grid_pos[num]} on the grid, P{ended} at the flag",
                 "text": (f"{plural(climb, 'place')} gained, all the way to the "
                          f"{'top step' if ended == 1 else 'podium'}." if famous else
                          f"{plural(climb, 'place')} gained."),
                 "bullets": ([plural(ov_by_driver[num], 'on-track pass', 'on-track passes')
                              + " along the way"] if ov_by_driver.get(num) else [])
                            + ([f"{plural(fell, 'car')} that started ahead of him retired"]
                               if fell else [])})
        drop, dnum = min(gains)
        typical_stops = s.typical_stops()
        if drop < -1:
            n_st = len(s.pit_laps(dnum))
            add({"type": "moment", "lap": max(3, s.total_laps - 6), "kicker": "Backwards",
                 "title": f"{s.name(dnum)} went the other way: {plural(abs(drop), 'place')} lost",
                 "text": f"Qualifying promised one thing and the {event} delivered another.",
                 "bullets": [f"P{grid_pos.get(dnum)} on the grid, "
                             f"P{s.finish_pos(dnum)} at the flag"]
                            + ([f"{plural(n_st, 'stop')} when most of the field made "
                                f"{typical_stops if typical_stops else 'none'}"]
                               if n_st and n_st != typical_stops else [])
                            + ["Qualifying rewards whoever can put one lap together. "
                               f"A {event} asks for {s.total_laps} of them"]})

    # --- weather, inside the race ---
    a, b = s.race_start_ts, s.race_end_ts
    wx = [w for w in s.weather if a and b and parse_ts(w.get("date")) and a <= parse_ts(w["date"]) <= b]
    track = [w["track_temperature"] for w in sorted(wx, key=lambda w: w.get("date") or "")
             if (w.get("track_temperature") or 0) > 0]
    if len(track) >= 2:
        t0, t1 = track[0], track[-1]
        lo, hi = min(track), max(track)
        trend = ("falling to" if t1 < t0 - 2 else "rising to" if t1 > t0 + 2 else
                 "between" if hi - lo > 3 else "and")
        wet = any(w.get("rainfall") for w in wx)
        add({"type": "moment", "lap": int(s.total_laps * 0.3), "kicker": "Conditions",
             "title": (f"Track between {lo:.0f}°C and {hi:.0f}°C during the {event}" if trend == "between" else
                       f"Track at {t0:.0f}°C at the start, {trend} {t1:.0f}°C at the flag"
                       if trend != "and" else f"Track steady around {t0:.0f}°C all {event}"),
             "text": "Track temperature changes how much grip the tyres find and how "
                     "fast they wear."
                     + (" Rain was recorded during the " + event + "." if wet
                        else " No rain was recorded during the " + event + ".")})

    # --- the flag ---
    podium = s.result[:3]
    gap2 = q_gap(podium[1]) if len(podium) > 1 else None
    add({"type": "moment", "lap": s.total_laps, "kicker": "Chequered flag",
         "title": f"{s.name(winner['driver_number'])} wins it",
         "text": " · ".join(f"P{r['position']} {s.name(r['driver_number'])}"
                            for r in podium) + ".",
         "bullets": ([f"After {s.total_laps} laps, {s.name(podium[1]['driver_number'])} "
                      f"crossed the line {gap2:.3f}s behind"]
                     + (["Less than the time it takes to read this sentence"] if gap2 < 2 else []))
                    if gap2 else [],
         "dato": {"label": "Points scored",
                  "rows": [[s.name(r["driver_number"]), f"{r.get('points') or 0:.0f}"]
                           for r in s.result if (r.get("points") or 0) > 0][:10]}})

    head = [c for c in cards if c["type"] == "cover"]
    body = sorted([c for c in cards if c["type"] == "moment"]
                  + prediction_cards(s) + decision_cards(s),
                  key=lambda c: c.get("lap") or 0)
    return close_thoughts(head + body)


# ------------------------------------------------------------------ quali
def quali_story(s: Session) -> list[dict]:
    if not s.result:
        return []
    cards: list[dict] = []
    add = cards.append
    pole = s.result[0]
    margin = q_gap(s.result[1]) if len(s.result) > 1 else None
    target = "sprint" if s.label.startswith("Sprint") else "race"

    # Who went out where, read from the times each driver set. Q3 is the top
    # ten; Q2 ran as far down as the last position with a Q2 time; everybody
    # behind that went out in Q1. The old version assumed 20 cars (out at
    # P16-20 and P11-15) and 2026 has 22: P16 was named out in Q1 when he had
    # run Q2, and P21 and P22 were never mentioned.
    def q_time(r, i):
        d = r.get("duration")
        return d[i] if isinstance(d, list) and len(d) > i else None
    # drivers entered for the session who are missing from the classification
    classified = {r["driver_number"] for r in s.result if r.get("position")}
    no_time = [n for n in s.drivers if n not in classified]
    field = len(classified) + len(no_time)
    q2_last = 10 + (field - 10) // 2 if field > 10 else 0
    q1_out = [r for r in s.result if r.get("position") and r["position"] > q2_last] if q2_last else []
    q2_out = [r for r in s.result if 10 < (r.get("position") or 0) <= q2_last]
    add({"type": "cover", "lap": 0, "kicker": f"{GP['short']} · {s.label}",
         "title": f"One lap decides the whole {target}",
         "text": (f"{field} cars, three rounds: {len(q1_out) + len(no_time)} out after the "
                  f"first, {len(q2_out)} after the second, and ten left to fight for the "
                  f"grid that shapes everything the {target} can become."
                  if q2_last else
                  f"Three rounds, and a grid that shapes everything the {target} can become.")})

    add({"type": "moment", "lap": 1, "kicker": "Pole position",
         "title": f"{s.name(pole['driver_number'])} takes it",
         "text": (f"By {margin:.3f}s over {s.name(s.result[1]['driver_number'])}"
                  + (". Less time than a blink." if margin < 0.1 else ".")
                  if margin else f"In {a_team(s.team(pole['driver_number']))}."),
         "dato": {"label": "Top ten",
                  "rows": [[f"P{r['position']} {s.name(r['driver_number'])}",
                            s.team(r["driver_number"])] for r in s.result[:10]]}})

    for out, extra, rnd, note in ((q1_out, no_time, "Q1", "Out before it got serious"),
                                  (q2_out, [], "Q2", "So close to the top ten")):
        if out or extra:
            idx = 0 if rnd == "Q1" else 1
            rows = ([[s.name(r["driver_number"]),
                      f"P{r['position']}" + ("" if q_time(r, idx) else ", no time")]
                     for r in out]
                    + [[s.name(n), "not classified"] for n in extra])
            add({"type": "moment", "lap": 2 if rnd == "Q1" else 3,
                 "kicker": f"{rnd} · The cut", "title": note,
                 "text": ", ".join(f"{name} ({where})" for name, where in rows)
                         .replace(", no time)", ", no time set in this round)") + ".",
                 "dato": {"label": f"Knocked out in {rnd}", "rows": rows}})

    deleted = s.deleted_in_session()
    if deleted:
        add({"type": "moment", "lap": 4,
             "kicker": ("Track limits"
                        if all("TRACK LIMITS" in (m.get("message") or "").upper()
                               for m in deleted) else "Deleted laps"),
             "title": f"{plural(len(deleted), 'lap')} thrown in the bin",
             "text": "In qualifying a deleted lap can be the difference between "
                     "Q3 and going home early.",
             "dato": {"label": "Deleted laps",
                      "rows": [deleted_row(s, m.get("message") or "")
                               for m in deleted[:5]]}})

    trap = s.speed_trap()
    if trap:
        add({"type": "moment", "lap": 5, "kicker": "Speed trap",
             "title": f"{names_list([s.name(d) for d in trap[0]])} "
                      f"{'was' if len(trap[0]) == 1 else 'were'} quickest through the trap: {trap[1]} km/h",
             "text": "Top speed says as much about wing level and the tow from the car "
                     "ahead as it does about the engine."})

    kings = s.sector_kings()
    if kings:
        owners = {n for _, who, _ in kings for n in who.split(" and ")}
        add({"type": "moment", "lap": 6, "kicker": "Sector by sector",
             "title": ("Nobody owned the whole lap" if len(owners) > 1
                       else f"{next(iter(owners))} owned the whole lap"),
             "text": (f"The quickest sectors of the session were split between "
                      f"{ {2: 'two', 3: 'three'}.get(len(owners), len(owners))} drivers, so the ideal lap "
                      "was never actually driven."
                      if len(owners) > 1 else "Quickest in all three sectors."),
             "dato": {"label": "Fastest sectors",
                      "rows": [[f"{sec} · {who}", f"{t:.3f}s"] for sec, who, t in kings]}})

    yellows = [m for m in s.rc_live if m.get("flag") in ("YELLOW", "DOUBLE YELLOW")]
    reds = flag_events([m for m in s.rc if re.search(r"(?<![A-Z])RED FLAG", (m.get("message") or "").upper())
                        and s.live(m)])
    if yellows or reds:
        stopped = f"the session stopped {'once' if reds == 1 else plural(reds, 'time')}"
        add({"type": "moment", "lap": 7, "kicker": "Interruptions",
             "title": (f"Yellow flags out {plural(flag_events(yellows), 'time')}"
                       + (f", and {stopped}" if reds else " during the session"))
                      if yellows else stopped[0].upper() + stopped[1:] + " by a red flag",
             "text": ("A red flag stops the session and sends everybody back to the pits."
                      if reds else
                      "A yellow in the wrong sector at the wrong moment ends "
                      "somebody's lap, and sometimes their session.")})

    grid = sorted(((g["position"], g["driver_number"]) for g in s.grid
                   if g.get("position") and g.get("driver_number")))
    if grid:
        quali_pos = {r["driver_number"]: r["position"] for r in s.result if r.get("position")}
        moved = [(num, quali_pos[num], pos) for pos, num in grid
                 if num in quali_pos and quali_pos[num] < pos]
        add({"type": "moment", "lap": 8, "kicker": "The grid",
             "title": f"How the {target} starts",
             "text": " · ".join(f"P{pos} {s.name(num)}" for pos, num in grid[:6]),
             "bullets": [f"{s.name(num)} qualified P{q} and starts P{p}, "
                         f"{p - q} place{'s' if p - q > 1 else ''} further back"
                         for num, q, p in moved[:4]]
                        + (["The grid is not the qualifying order. A penalty moves a "
                            "car back, whether for something on track or for a new "
                            "engine, and everybody behind it moves up"]
                           if moved else [])})
    else:
        add({"type": "moment", "lap": 8, "kicker": "The grid",
             "title": f"How the {target} starts",
             "text": " · ".join(f"P{r['position']} {s.name(r['driver_number'])}"
                                for r in s.result[:6])})
    return cards


# ------------------------------------------------------------------ practice
def practice_story(s: Session) -> list[dict]:
    cards: list[dict] = []
    add = cards.append
    best = s.best_lap
    laps_by_driver = Counter(l["driver_number"] for l in s.laps if l.get("lap_duration"))
    day = session_day(s)

    add({"type": "cover", "lap": 0, "kicker": f"{GP['short']} · {s.label}",
         "title": "Practice, honestly",
         "text": f"{len(s.laps)} laps run and nothing at stake. What it does tell "
                 "you is who looks comfortable and who is fighting the car."})

    if best:
        add({"type": "moment", "lap": 1,
             "kicker": f"Fastest of the session · lap {best.get('lap_number')}",
             "title": f"{s.name(best['driver_number'])}: {fmt(best['lap_duration'])}",
             "text": f"In {a_team(s.team(best['driver_number']))}. Take practice times with "
                     "salt: fuel loads are secret and nobody shows their hand."})

    if laps_by_driver:
        num, n = laps_by_driver.most_common(1)[0]
        add({"type": "moment", "lap": 2, "kicker": "Who did the work",
             "title": f"{s.name(num)} racked up {n} laps",
             "text": f"Track time is the currency of a practice {day}. Whoever runs most "
                     "learns most, and burns the most rubber doing it.",
             "dato": {"label": "Laps completed",
                      "rows": [[s.name(d), c] for d, c in laps_by_driver.most_common(6)]}})

    # long runs tell you far more than a single lap
    # a "clean" lap is one within a few percent of that driver's own best in the
    # session. Averaging every timed lap put Antonelli's Friday pace at 1:36
    # on a circuit he lapped in 1:23, because in-laps, cool-downs and traffic
    # were all in the mean, and the card called it the number teams care about
    runs = []
    for num in laps_by_driver:
        laps = s.timed_laps(num)
        if not laps:
            continue
        best = min(l["lap_duration"] for l in laps)
        clean = [l["lap_duration"] for l in laps if l["lap_duration"] <= best * 1.04]
        if len(clean) >= 6:
            runs.append((mean(clean), num, len(clean)))
    if len(runs) >= 3:
        runs.sort()
        add({"type": "moment", "lap": 3, "kicker": "Consistency",
             "title": f"{s.name(runs[0][1])} had the best average over his quicker laps",
             "text": "Every lap within 4% of each driver's own best, averaged. Fuel "
                     "loads are unknown, so read it as a hint, not a ranking.",
             "dato": {"label": "Average of the quicker laps",
                      "rows": [[s.name(n), fmt(t)] for t, n, _ in runs[:6]]}})

    if s.stints:
        compounds = Counter(st.get("compound") for st in s.stints
                            if st.get("compound") and st.get("compound") != "UNKNOWN")
        add({"type": "moment", "lap": 4, "kicker": "Tyres",
             "title": "What they ran, and on what",
             "text": "Compound choice in practice is a rehearsal for the race plan.",
             "dato": {"label": "Stints by compound",
                      "rows": [[c, n] for c, n in compounds.most_common()]}})

    trap = s.speed_trap()
    if trap:
        add({"type": "moment", "lap": 5, "kicker": "Speed trap",
             "title": f"{names_list([s.name(d) for d in trap[0]])} topped the trap at {trap[1]} km/h",
             "text": "Early wing choices show up here before anybody admits to them."})

    incidents = [m for m in s.rc_live if m.get("flag") in ("YELLOW", "DOUBLE YELLOW", "RED")]
    reds = [m for m in incidents if m.get("flag") == "RED"]
    add({"type": "moment", "lap": 6, "kicker": "Interruptions",
         "title": (f"Flags out {plural(flag_events(incidents), 'time')}, and the session stopped "
                   f"{'once' if len(reds) == 1 else str(len(reds)) + ' times'}"
                   if reds else f"Flags out {plural(flag_events(incidents), 'time')}"
                   if incidents else "A clean session"),
         "text": ("A red flag sends everybody back to the pits and the clock keeps "
                  "running. Whatever run you were on is gone, and so is the time to "
                  "repeat it."
                  if reds else
                  "Every interruption costs somebody a run they had planned."
                  if incidents else
                  "No yellow or red flags logged while the session ran.")})

    win = s.running_windows
    wx = [w for w in s.weather if parse_ts(w.get("date"))
          and (not win or win[0][0] <= parse_ts(w["date"]) <= win[-1][1])]
    track = [w["track_temperature"] for w in wx if (w.get("track_temperature") or 0) > 0]
    if track:
        add({"type": "moment", "lap": 7, "kicker": "Conditions",
             "title": (f"Track between {min(track):.0f}°C and {max(track):.0f}°C"
                       if round(min(track)) != round(max(track)) else f"Track at {min(track):.0f}°C"),
             "text": "Practice conditions rarely match the race, which is one more "
                     "reason these times mislead."})
    return cards


# ------------------------------------------------------------------ build
def race_facts(s: Session) -> dict | None:
    """The race in the numbers the home page leads with, and nothing derived
    a second time: every one is the figure the cards themselves carry."""
    if s.kind != "race" or not s.result:
        return None
    w = s.result[0]
    num = w["driver_number"]
    info = s.drivers.get(num, {})
    grid = s.start_grid()
    second = s.result[1] if len(s.result) > 1 else None
    gap = second.get("gap_to_leader") if second else None
    best = s.best_lap
    return {
        "winner": {"first": info.get("first_name", ""), "last": s.name(num),
                   "team": s.team(num), "colour": info.get("team_colour", ""),
                   "number": num, "start": grid.get(num), "headshot": photo(info)},
        "margin": round(float(gap), 3) if isinstance(gap, (int, float)) else None,
        "runnerUp": s.name(second["driver_number"]) if second else None,
        "fastest": ({"last": s.name(best["driver_number"]),
                     "time": fmt(best["lap_duration"])} if best else None),
        "passes": len(s.green_overtakes()),
        "stops": len(s.real_pits),
        "dnfs": len(s.dnfs),
        "safetyCars": len(s.sc_laps),
        "redFlag": bool(s.red_laps),
        "laps": s.total_laps,
    }


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    sessions_meta = []
    facts = None
    race_laps = None

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
            facts = race_facts(s)
            w = s.result[0]
            story["result"] = {
                "date": GP["date"],
                "podium": [{"pos": i + 1, "number": r["driver_number"],
                            "first": s.drivers.get(r["driver_number"], {}).get("first_name", ""),
                            "last": s.name(r["driver_number"]),
                            "team": s.team(r["driver_number"]),
                            "colour": s.drivers.get(r["driver_number"], {}).get("team_colour", ""),
                            "headshot": photo(s.drivers.get(r["driver_number"], {})),
                            # the winning margin is a headline number, not a name
                            "gap": (round(q_gap(r), 3) if q_gap(r) else None)}
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
            (OUT / f"blind_{slug}.json").write_text(
                json.dumps({"session": label, "rounds": blind_rounds(s, fmt)},
                           ensure_ascii=False, indent=2), encoding="utf-8")
            (OUT / f"brain_{slug}.json").write_text(
                json.dumps(race_brain(s, GP, fmt, parse_ts), ensure_ascii=False,
                           indent=2), encoding="utf-8")
            # the pit wall only exists for a race whose tyre data holds up
            wall = pitwall_race(s, fmt)
            target = OUT / f"pitwall_{slug}.json"
            if wall:
                target.write_text(json.dumps(wall, ensure_ascii=False, indent=2),
                                  encoding="utf-8")
            elif target.exists():
                target.unlink()
            print(f"     pit wall: {wall['driver']['name'] if wall else 'no'}")

        if kind == "practice":
            headline = f"{len(s.laps)} laps run, no points at stake"
        elif kind == "quali":
            headline = (f"{s.name(s.result[0]['driver_number'])} on pole"
                        if s.result else label)
        else:
            headline = (plural(len(s.green_overtakes()), "on-track pass", "on-track passes")
                        + (f", {plural(len(s.sc_periods), 'safety car')}" if s.sc_periods else ""))
            if slug == "race" and s.total_laps:
                race_laps = s.total_laps

        sessions_meta.append({"slug": slug, "label": label, "kind": kind,
                              "headline": headline, "moments": len(cards),
                              "laps": s.total_laps})
        print(f"[OK] {label}: {len(cards)} cards")

    weekend = {**GP, "laps": race_laps or GP["laps"], "sessions": sessions_meta, "facts": facts, "rating": None, "heat": []}
    (OUT / "weekend.json").write_text(
        json.dumps(weekend, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[OK] weekend.json · {sum(m['moments'] for m in sessions_meta)} cards total")


if __name__ == "__main__":
    main()
