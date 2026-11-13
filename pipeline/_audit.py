"""Reads every built weekend and flags what has gone wrong before.

Each check is a lesson from a review: a string that meant a bug, or a
number that cannot be true. It prints what it finds and never edits."""
import json, pathlib, re, sys

P = pathlib.Path(__file__).parent.parent
D = P / "data"
slugs = sys.argv[1:] or sorted(d.name for d in D.iterdir() if (d / "story_race.json").exists())

BAD_TEXT = [
    (r"(^|\| )somebody, |\bSomebody:|'somebody'", "unnamed car where a name belongs"),
    (r"\b1 times\b|\b1 on-track passes\b|\b1 penalties\b|\b1 laps\b|\b1 places\b|\b1 cars\b|saw 1 of them",
     "singular number, plural word"),
    (r"stopped ([4-9]|\d\d) times \| Three stops", "the count says one thing, the copy another"),
    (r"\b[2-9] safety car\b|\b[2-9] virtual safety car\b", "plural number, singular word"),
    (r"\bin a [AEIOU]", "'a' before a vowel"),
    (r"Twenty cars", "field size hard-coded"),
    (r"mechanical failure|engine failure|crashed out|hit the wall", "a cause the feed never gives"),
    (r"UNKNOWN", "unknown tyre compound shown"),
    ("—", "em dash"),
    (r"\bDRS\b", "DRS does not exist in 2026"),
    (r"one point|worth a point|a point if you finish", "no fastest-lap point since 2025"),
    (r"what broke|gave up|zero points|Zero points", "a cause or consequence the feed never gives"),
    (r"\b0 places\b|\b0 laps\b|\b0 stops\b", "zero where there should be no card"),
    (r"spent the race in|nobody talked about|cameras", "claim with no basis in the data"),
    (r"\bin a (Red Bull Racing|Haas F1 Team)\b", "team name used as a car"),
    ("—", "em dash"),
    (r"\bNone\b|\bnan\b|#\d+\b", "missing value leaked into copy"),
    (r"Wiped out|the margin this (race|sprint) was decided|comes down to this one number", "a claim the safety car can make false"),
]


def text_of(card):
    parts = [card.get(k) or "" for k in ("kicker", "title", "text", "note", "reveal")]
    parts += card.get("bullets") or []
    for row in (card.get("dato") or {}).get("rows") or []:
        parts += [str(x) for x in row]
    for row in card.get("state") or []:
        parts += [str(x) for x in row]
    return " | ".join(str(p) for p in parts)


total = 0
for slug in slugs:
    issues = []
    w = json.loads((D / slug / "weekend.json").read_text(encoding="utf-8"))
    f = w.get("facts") or {}
    laps = w.get("laps") or 0
    if not f:
        issues.append("no race facts")
    for sess in w.get("sessions", []):
        p = D / slug / f"story_{sess['slug']}.json"
        if not p.exists():
            issues.append(f"{sess['slug']}: story missing"); continue
        cards = json.loads(p.read_text(encoding="utf-8"))["cards"]
        if len(cards) < 5:
            issues.append(f"{sess['slug']}: only {len(cards)} cards")
        for i, c in enumerate(cards):
            t = text_of(c)
            for pat, why in BAD_TEXT:
                if re.search(pat, t):
                    issues.append(f"{sess['slug']}#{i} {why}: {t[:150]}")
            if sess["label"].startswith("Sprint") and re.search(r"Sunday|two hours|afternoon", t):
                issues.append(f"{sess['slug']}#{i} race wording in a sprint: {t[:150]}")
            m = re.search(r"By (\d+\.\d+)s over .*?blink", t)
            if m and float(m.group(1)) >= 0.1:
                issues.append(f"{sess['slug']}#{i} blink for {m.group(1)}s")
            lap = c.get("lap") or 0
            if sess["kind"] == "race" and laps and lap > laps:
                issues.append(f"{sess['slug']}#{i} lap {lap} beyond race length {laps}")
            # decisions on the pit wall must not sit on a neutralised lap
            if c.get("type") == "decision" and "undercut" in (c.get("text") or ""):
                st = json.loads((D / slug / f"story_{sess['slug']}.json").read_text(encoding="utf-8"))
                sc = [x["lap"] for x in st["cards"] if "Safety Car" in x.get("kicker", "")]
                if lap in sc:
                    issues.append(f"{sess['slug']}#{i} undercut call on a safety car lap {lap}")
            # stops: anything over 60s in the pit lane is not a stop
            for m in re.findall(r"(\d+\.\d)s", t):
                if "lane" in t.lower() and float(m) > 60:
                    issues.append(f"{sess['slug']}#{i} pit time {m}s looks like a stoppage: {t[:120]}")
    # facts that cannot be true
    if f:
        if f.get("passes", 0) > laps * 8 and laps:
            issues.append(f"facts: {f['passes']} passes in {laps} laps looks inflated")
        if f.get("margin") is not None and f["margin"] > 120:
            issues.append(f"facts: margin {f['margin']}s")
        if f.get("stops", 0) > 22 * 4:
            issues.append(f"facts: {f['stops']} stops")
    print(f"\n== {slug}: {len(issues)} flag(s)")
    for x in issues:
        print("   ", x)
    total += len(issues)
print(f"\nTOTAL FLAGS: {total}")
