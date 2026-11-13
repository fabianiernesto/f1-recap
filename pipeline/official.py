"""
The official classification, for what the timing feed cannot know.

The feed sees the cars. It does not see a disqualification decided in the
evening, a penalty added after the flag, or why a car lines up in the pit lane.
formula1.com publishes all of that as result tables with a line of notes under
each one, and this reads them.

  pipeline/official/<slug>.json   the tables and their notes, per Grand Prix

A weekend without that file still builds: every reader here answers with
"nothing known", and the cards that depend on it say only what the feed saw.

Fetching a weekend:  python pipeline/official.py <slug> [slug ...]
"""
import json
import re
import sys
import urllib.request
from html import unescape
from html.parser import HTMLParser
from pathlib import Path

DIR = Path(__file__).resolve().parent / "official"
INDEX = "https://www.formula1.com/en/results/2026/races"
AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
RACE_PAGES = ["race-result", "fastest-laps", "pit-stop-summary", "starting-grid", "qualifying"]
SPRINT_PAGES = ["sprint-results", "sprint-grid", "sprint-qualifying"]

# which tables speak for which session of the weekend
TABLES = {
    "race": {"result": "race-result", "grid": "starting-grid"},
    "sprint": {"result": "sprint-results", "grid": "sprint-grid"},
    "quali": {"result": "qualifying", "grid": "starting-grid", "race": "race-result"},
    "sprint-quali": {"result": "sprint-qualifying", "grid": "sprint-grid", "race": "sprint-results"},
}

NUMBERS = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "ten": 10, "fifteen": 15, "twenty": 20}


def _count(word: str) -> int:
    word = word.lower()
    return int(word) if word.isdigit() else NUMBERS.get(word, 0)


def _tidy(reason: str) -> str:
    return re.sub(r"\s+", " ", reason).strip(" .").replace("Parce Ferme", "Parc Ferme")


class Official:
    """One session of the weekend as the official tables have it."""

    def __init__(self, slug: str, session_slug: str):
        self.slug, self.session = slug, session_slug
        f = DIR / f"{slug}.json"
        self.tables = json.loads(f.read_text(encoding="utf-8")) if f.exists() else {}
        self.names = TABLES.get(session_slug, {})
        self.known = bool(self.tables and self.names and self._table("result"))

    # ---------- the raw tables ----------
    def _table(self, role: str) -> dict:
        return self.tables.get(self.names.get(role, ""), {}) or {}

    def _rows(self, role: str) -> list[dict]:
        t = self._table(role)
        rows = t.get("rows") or []
        if not rows:
            return []
        head = rows[0]
        return [dict(zip(head, r)) for r in rows[1:]]

    def _notes(self, role: str) -> str:
        t = self._table(role)
        return " ".join(re.sub(r"^Note\s*-\s*", "", x) for x in (t.get("after") or []) if x.startswith("Note"))

    def _surnames(self) -> dict[str, int]:
        """'Colapinto' -> 43, from every table of the weekend."""
        out: dict[str, int] = {}
        for t in self.tables.values():
            rows = t.get("rows") or []
            if not rows or "Driver" not in rows[0] or "No." not in rows[0]:
                continue
            di, ni = rows[0].index("Driver"), rows[0].index("No.")
            for r in rows[1:]:
                try:
                    parts = r[di].split()
                    # "Kimi Antonelli ANT": the acronym is the last word
                    out[" ".join(parts[1:-1])] = int(r[ni])
                except (IndexError, ValueError):
                    pass
        return out

    def _cars(self, text: str) -> list[int]:
        """The drivers a note names, in the order it names them."""
        found = []
        for name, num in self._surnames().items():
            for m in re.finditer(rf"\b{re.escape(name)}\b", text):
                found.append((m.start(), num))
        return [n for _, n in sorted(found)]

    # ---------- what the session's result says ----------
    @property
    def result(self) -> dict[int, dict]:
        return {int(r["No."]): r for r in self._rows("result") if r.get("No.", "").isdigit()}

    @property
    def winner(self) -> int | None:
        return next((n for n, r in self.result.items() if r.get("Pos.") == "1"), None)

    @property
    def dsq(self) -> dict[int, str]:
        """Disqualified, and why if the note says."""
        out = {}
        notes = self._notes("result")
        for sentence in re.split(r"(?<=\.)\s+", notes):
            m = re.search(r"disqualified(?: from [A-Za-z ]+?)?(?: for (.+))?$", sentence.strip(" ."))
            if m:
                for n in self._cars(sentence[:m.start()]):
                    out[n] = _tidy(m.group(1) or "")
        for n, r in self.result.items():
            if r.get("Pos.") == "DQ" or "DSQ" in (r.get("Time / Retired") or ""):
                out.setdefault(n, "")
        return out

    def penalties(self) -> list[dict]:
        """Every penalty the note under the result lists: {car, secs, laps, kind,
        reason}. One entry per penalty: "two five-second time penalties" is two."""
        out = []
        for sentence in re.split(r"(?<=\.)\s+", self._notes("result")):
            m = re.search(r"received (?:(a|an|one|two|three) )?(\w+)-second time penalt(?:y|ies)(?: for (.+))?", sentence)
            if m:
                many = _count(m.group(1) or "") or 1
                secs = _count(m.group(2))
                for n in self._cars(sentence[:m.start()]):
                    for _ in range(many):
                        out.append({"car": n, "secs": secs, "laps": 0, "kind": f"{secs}s",
                                    "reason": _tidy(m.group(3) or "").lower()})
                continue
            m = re.search(r"received (one|two|three|\d+) penalty laps?(?: for (.+))?", sentence)
            if m:
                laps = _count(m.group(1))
                for n in self._cars(sentence[:m.start()]):
                    out.append({"car": n, "secs": 0, "laps": laps,
                                "kind": f"{m.group(1)} penalty lap" + ("s" if laps > 1 else ""),
                                "reason": _tidy(m.group(2) or "").lower()})
        return out

    # ---------- what the grid says ----------
    @property
    def grid(self) -> dict[int, int]:
        return {int(r["No."]): int(r["Pos."]) for r in self._rows("grid")
                if r.get("No.", "").isdigit() and r.get("Pos.", "").isdigit()}

    @property
    def pit_lane(self) -> dict[int, str]:
        """Who started from the pit lane, and the reason the note gives. A note
        can name the driver one sentence earlier (Miami 2026: "Hadjar granted
        permission to race [...]. Required to start from the pit lane [...]")."""
        out: dict[int, str] = {}
        prev: list[int] = []
        for sentence in re.split(r"(?<=\.)\s+", self._notes("grid")):
            cars = self._cars(sentence)
            m = re.search(r"required to start from (?:the )?pit lane(?: after (.+))?", sentence, re.I)
            if m:
                for n in (self._cars(sentence[:m.start()]) or prev):
                    out[n] = _tidy(m.group(1) or "")
            prev = cars or prev
        return out

    def race_status(self) -> dict[int, str]:
        """From a qualifying session's point of view: who then did not start."""
        rows = self._rows("race") if "race" in self.names else self._rows("result")
        return {int(r["No."]): r.get("Time / Retired", "") for r in rows if r.get("No.", "").isdigit()}

    @property
    def non_starters(self) -> list[int]:
        return [n for n, v in self.race_status().items() if v == "DNS"]

    # ---------- stops, for a race ----------
    @property
    def pit_rows(self) -> list[dict]:
        t = self.tables.get("pit-stop-summary") if self.session == "race" else None
        rows = (t or {}).get("rows") or []
        if not rows:
            return []
        head = rows[0]
        out = []
        for r in rows[1:]:
            d = dict(zip(head, r))
            try:
                out.append({"car": int(d["No."]), "lap": int(d["Lap"]), "tod": d.get("Time of Day"),
                            "time": d.get("Time")})
            except (KeyError, ValueError):
                pass
        return out


# ------------------------------------------------------------------ fetching
class _Parser(HTMLParser):
    """The first table of a results page and the note lines straight after it."""

    def __init__(self):
        super().__init__()
        self.rows, self.after = [], []
        self.depth, self.skip, self.done = 0, 0, False
        self.cell, self.row = None, None

    def handle_starttag(self, tag, attrs):
        if tag == "table":
            self.depth += 1
        if tag in ("script", "style"):
            self.skip += 1
        if self.depth:
            if tag == "tr":
                self.row = []
            if tag in ("td", "th"):
                self.cell = []

    def handle_endtag(self, tag):
        if tag in ("script", "style"):
            self.skip = max(0, self.skip - 1)
        if self.depth:
            if tag in ("td", "th") and self.cell is not None and self.row is not None:
                self.row.append(" ".join(x for x in self.cell if x).strip())
                self.cell = None
            if tag == "tr":
                if self.row:
                    self.rows.append(self.row)
                self.row = None
        if tag == "table":
            self.depth -= 1
            self.done = True

    def handle_data(self, data):
        if self.skip:
            return
        data = data.strip()
        if self.cell is not None and data:
            self.cell.append(data)
        elif self.done and data and not self.depth and len(self.after) < 40:
            self.after.append(data)


def _get(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": AGENT})
    return urllib.request.urlopen(req, timeout=60).read().decode("utf-8", "replace")


def parse_table(html_text: str) -> dict:
    i = html_text.find("<table")
    j = html_text.find("</table>", i)
    if i < 0 or j < 0:
        return {"rows": [], "after": []}
    sub = html_text[i:j + 8 + 6000]
    k, tail = sub.find("<script"), sub.find("</table>")
    if k > tail:
        sub = sub[:k]
    p = _Parser()
    p.feed(sub)
    m = re.search(r"<title>(.*?)</title>", html_text)
    return {"title": unescape(m.group(1)) if m else "", "rows": p.rows, "after": p.after[:12]}


def fetch(slug: str) -> None:
    """Finds the Grand Prix on the season page by its country and downloads its
    tables. Sprint tables are tried on every weekend: absent ones are skipped."""
    from gps import weekend_of
    gp, sessions = weekend_of(slug)
    links = re.findall(r"/en/results/2026/races/(\d+)/([a-z0-9-]+)", _get(INDEX))
    # the season page goes by country, and a moved race keeps its name (Sepang
    # 2026 is the "Bahrain Grand Prix in Malaysia", at /bahrain)
    want = {re.sub(r"[^a-z]+", "-", gp["country"].lower()), re.sub(r"[^a-z]+", "-", gp["circuit"].lower()),
            re.sub(r"[^a-z]+", "-", gp["short"].lower().split(" grand prix")[0])}
    hit = next(((i, n) for i, n in links if n in want or any(w in n for w in want)), None)
    if not hit:
        print(f"{slug}: not on the season page ({sorted(set(n for _, n in links))})")
        return
    pages = RACE_PAGES + (SPRINT_PAGES if any(x[2] == "sprint" for x in sessions) else [])
    out = {}
    for page in pages:
        try:
            out[page] = parse_table(_get(f"{INDEX}/{hit[0]}/{hit[1]}/{page}"))
        except Exception as e:
            print(f"  {page}: {type(e).__name__}")
    DIR.mkdir(exist_ok=True)
    (DIR / f"{slug}.json").write_text(json.dumps(out, ensure_ascii=False, indent=0), encoding="utf-8")
    print(f"{slug}: {hit[1]}, " + ", ".join(f"{k} {max(0, len(v['rows']) - 1)}" for k, v in out.items()))


if __name__ == "__main__":
    for s in sys.argv[1:]:
        fetch(s)
