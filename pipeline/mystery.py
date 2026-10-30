"""
The mystery driver (activity 01, since 22/10/2026).

One driver per race, the same one for everybody who opens it, guessed from
clues that go from vague to damning. It is the blind test turned into a
shared puzzle: everybody who watched the race argues about the same driver.

Built from what the pipeline already wrote, nothing new is fetched:
  blind_<session>.json  the candidates worth guessing, with their tell
  brain_<session>.json  every driver's afternoon, for the clues and for the
                        arrows a wrong guess gets (team, start, stops, passes)

Clues are ordered by how many drivers on the grid they still fit, most first,
so the first clue is the vaguest. The tell and the finishing position always
come last: they give the answer away, and the result never goes on the share.

Usage: python pipeline/mystery.py [slug ...]   (no args = every GP in data/)
"""
import json
import sys
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data"
CACHE = Path(__file__).resolve().parent / "cache"


def grid_look(slug: str, session: str) -> dict[int, dict]:
    """Colour and photograph of every car in that session, from the session's
    own driver list (see photos.py: the photo follows the team he drove for
    that weekend). The guessing screen shows the whole field, not only the
    eight drivers the blind test kept."""
    from gps import weekend_of
    from photos import photo
    _, sessions = weekend_of(slug)
    spec = next((x for x in sessions if x[2] == session), None)
    if not spec:
        return {}
    f = CACHE / f"{spec[0]}_{spec[1]}_drivers.json"
    if not f.exists():
        return {}
    out = {}
    for d in json.loads(f.read_text(encoding="utf-8")):
        out[d["driver_number"]] = {"colour": (d.get("team_colour") or "").lstrip("#"),
                                   "headshot": photo(d) or ""}
    return out
SESSIONS = ["race", "sprint"]


def plural(n: int, word: str) -> str:
    return f"{n} {word}" if n == 1 else f"{n} {word}s"


def tyres(d: dict) -> str:
    seq = [c.lower() for c in d.get("compounds") or [] if c and c != "UNKNOWN"]
    return " to ".join(seq) if seq else ""


def build(slug: str, session: str) -> dict | None:
    bf, rf = DATA / slug / f"blind_{session}.json", DATA / slug / f"brain_{session}.json"
    if not bf.exists() or not rf.exists():
        return None
    blind = json.loads(bf.read_text(encoding="utf-8"))
    brain = json.loads(rf.read_text(encoding="utf-8"))
    drivers = {d["number"]: d for d in brain["drivers"].values() if not d.get("dns")}
    rounds = [r for r in blind["rounds"] if r.get("number") in drivers]
    if not rounds:
        return None
    # the strongest story that is not simply the winner: "took the win" is
    # the one clue everybody already knows
    pick = next((r for r in rounds if drivers[r["number"]].get("finish") != 1), rounds[0])
    me = drivers[pick["number"]]
    field = list(drivers.values())
    look = grid_look(slug, session)
    fits = lambda pred: sum(1 for d in field if pred(d))

    # every clue is said as a sentence about him, with its figure pulled out
    # big: "2" over "He stopped twice", never a bare label over a number
    def times(n: int) -> str:
        return {1: "once", 2: "twice"}.get(n, f"{n} times")

    clues = []
    n_stops = len(me.get("stops") or [])
    clues.append({"k": "Pit stops", "big": str(n_stops),
                  "say": "He never stopped" if not n_stops else f"He stopped {times(n_stops)}",
                  "fits": fits(lambda d: len(d.get("stops") or []) == n_stops)})
    if tyres(me):
        seq = tyres(me)
        sets = seq.split(" to ")
        clues.append({"k": "Tyres", "kind": "tyres", "big": seq,
                      "say": (f"He ran the whole race on {sets[0]}s" if len(sets) == 1 else
                              f"He ran {', then '.join(sets)}"),
                      "fits": fits(lambda d: tyres(d) == seq)})
    passes = me.get("overtakes") or 0
    clues.append({"k": "Overtakes", "big": str(passes),
                  "say": "He passed nobody on track" if not passes else
                         f"He passed {passes} car{'s' if passes != 1 else ''} on track",
                  "fits": fits(lambda d: (d.get("overtakes") or 0) == passes)})
    if me.get("start"):
        clues.append({"k": "Grid slot", "big": f"P{me['start']}",
                      "say": "He started on pole" if me["start"] == 1 else f"He started P{me['start']}",
                      "fits": 1})
    if me.get("penalty"):
        pen = str(me["penalty"])
        what = f"a {pen[:-1]}-second penalty" if pen[:1].isdigit() else pen
        why = me.get("penaltyFor")
        clues.append({"k": "Penalty", "big": pen.replace("a ", "").replace("drive-through", "Drive-thru"),
                      "say": f"The stewards gave him {what}" + (f" for {why}" if why else ""),
                      "fits": fits(lambda d: bool(d.get("penalty")))})
    if me.get("led"):
        clues.append({"k": "Laps led", "big": str(me["led"]),
                      "say": f"He led {plural(me['led'], 'lap')}",
                      "fits": fits(lambda d: (d.get("led") or 0) > 0)})
    if me.get("fastestLap"):
        clues.append({"k": "Fastest lap", "kind": "purple", "big": "His",
                      "say": f"He set the fastest lap of the {session}", "fits": 1})
    # a clue that only repeats the tell is a wasted try
    if "fastest lap" in pick["tell"]:
        clues = [c for c in clues if c["k"] != "Fastest lap"]
    clues.sort(key=lambda c: -c["fits"])
    tell = pick["tell"][0].upper() + pick["tell"][1:]
    clues.append({"k": "The giveaway", "kind": "tell", "big": "", "say": tell, "fits": 1})
    if me.get("dnf"):
        fin = {"k": "Finish", "big": "DNF",
               "say": f"He retired on lap {me['dnfLap']}" if me.get("dnfLap") else "He retired"}
    elif me.get("finish"):
        fin = {"k": "Finish", "big": f"P{me['finish']}",
               "say": "He won it" if me["finish"] == 1 else f"He finished P{me['finish']}"}
    else:
        fin = {"k": "Finish", "big": "NC", "say": "He was not classified"}
    clues.append({**fin, "fits": 1})
    for c in clues:
        c.pop("fits")

    return {
        "session": brain.get("session", session.title()),
        "answer": {
            "name": me["name"], "number": me["number"], "team": me["team"],
            "colour": pick.get("colour", ""), "headshot": pick.get("headshot", ""),
            "start": me.get("start"), "stops": n_stops, "passes": passes,
            "tell": pick["tell"],
        },
        "clues": clues,
        # what a wrong guess is compared on: never the finishing position,
        # which is the last clue and would give the game away early
        "field": sorted(
            ({"name": d["name"], "number": d["number"], "team": d["team"], "start": d.get("start"),
              "stops": len(d.get("stops") or []), "passes": d.get("overtakes") or 0,
              "colour": look.get(d["number"], {}).get("colour", ""),
              "headshot": look.get(d["number"], {}).get("headshot", "")} for d in field),
            key=lambda d: d["name"]),
    }


def main(slugs: list[str]) -> None:
    for slug in slugs or sorted(p.name for p in DATA.iterdir() if p.is_dir()):
        for session in SESSIONS:
            out = build(slug, session)
            if out:
                (DATA / slug / f"mystery_{session}.json").write_text(
                    json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
                print(f"{slug} {session}: {out['answer']['name']}, {len(out['clues'])} clues")


if __name__ == "__main__":
    main(sys.argv[1:])
