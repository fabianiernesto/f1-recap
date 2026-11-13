"""One review file per weekend: every card of every session, then the raw
facts those cards must agree with, read straight from the OpenF1 cache.

  python _review_pack.py [slug ...]      writes pipeline/_review/<slug>.txt
"""
import json, pathlib, sys
from collections import Counter

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from gps import GPS  # noqa: E402

P = pathlib.Path(__file__).parent
D = P.parent / "data"
C = P / "cache"
OUT = P / "_review"
OUT.mkdir(exist_ok=True)


def load(key, name, ep):
    f = C / f"{key}_{name}_{ep}.json"
    return json.loads(f.read_text(encoding="utf-8")) if f.exists() else []


def card_line(i, c):
    keep = {k: c[k] for k in ("type", "lap", "kicker", "title", "text", "bullets", "note",
                                "options", "answer", "reveal", "actual", "state", "dato",
                                "choices", "outcomes", "target", "unit") if k in c}
    return f"  [{i}] " + json.dumps(keep, ensure_ascii=False)


slugs = sys.argv[1:] or sorted(GPS)
for slug in slugs:
    meta = GPS[slug]["meta"]
    out = [f"##### {slug} · {meta['gp']} · {meta['date']} · {meta['laps']} laps"]
    w = json.loads((D / slug / "weekend.json").read_text(encoding="utf-8"))
    out.append("WEEKEND facts: " + json.dumps(w.get("facts"), ensure_ascii=False))
    out.append("WEEKEND sessions: " + json.dumps(
        [(s["label"], s["headline"], s["moments"], s["laps"]) for s in w["sessions"]], ensure_ascii=False))
    for key, name, sslug, label, kind in GPS[slug]["sessions"]:
        drivers = {d["driver_number"]: d.get("last_name") or d.get("name_acronym") for d in load(key, name, "drivers")}
        nm = lambda n: drivers.get(n, f"#{n}")
        out.append(f"\n==================== {label} ({kind}) · session {key}")
        st = D / slug / f"story_{sslug}.json"
        cards = json.loads(st.read_text(encoding="utf-8"))["cards"] if st.exists() else []
        out.append(f"-- CARDS ({len(cards)})")
        out += [card_line(i, c) for i, c in enumerate(cards)]
        # ---- raw facts
        res = sorted(load(key, name, "session_result"),
                     key=lambda r: r["position"] if isinstance(r.get("position"), int) else 99)
        out.append("-- RAW result: " + " · ".join(
            f"P{r.get('position')} {nm(r['driver_number'])}"
            + (" DNF" if r.get("dnf") else "") + (" DNS" if r.get("dns") else "") + (" DSQ" if r.get("dsq") else "")
            + (f" gap={r.get('gap_to_leader')}" if kind == "race" and r.get("position") in (1, 2, 3) else "")
            + (f" dur={r.get('duration')}" if kind == "quali" and r.get("position") in (1, 2, 3) else "")
            for r in res))
        grid = sorted(load(key, name, "starting_grid"), key=lambda g: g.get("position") or 99)
        if grid:
            out.append("-- RAW starting_grid (from this session's file): " + " · ".join(
                f"P{g.get('position')} {nm(g['driver_number'])}" for g in grid))
        laps = load(key, name, "laps")
        if laps:
            timed = [l for l in laps if l.get("lap_duration")]
            best = min(timed, key=lambda l: l["lap_duration"]) if timed else None
            out.append(f"-- RAW laps: {len(laps)} rows, max lap {max((l.get('lap_number') or 0) for l in laps)}"
                       + (f", best {nm(best['driver_number'])} {best['lap_duration']} on lap {best.get('lap_number')}" if best else "")
                       + f", top st_speed {max((l.get('st_speed') or 0) for l in laps)}")
            per = Counter(l["driver_number"] for l in timed)
            out.append("-- RAW laps per driver (top 6): " + ", ".join(f"{nm(n)} {c}" for n, c in per.most_common(6)))
        pits = load(key, name, "pit")
        if pits and kind == "race":
            out.append("-- RAW pit: " + ", ".join(
                f"L{p.get('lap_number')} {nm(p['driver_number'])} {p.get('pit_duration')}" for p in pits))
        stints = load(key, name, "stints")
        if stints and kind == "race":
            by = {}
            for s in stints:
                by.setdefault(nm(s["driver_number"]), []).append(f"{s.get('compound')}:{s.get('lap_start')}-{s.get('lap_end')}")
            out.append("-- RAW stints: " + " | ".join(f"{k} {v}" for k, v in by.items()))
        rc = load(key, name, "race_control")
        out.append(f"-- RAW race_control ({len(rc)} msgs), the ones cards lean on:")
        for m in rc:
            msg = (m.get("message") or "")
            up = msg.upper()
            if (m.get("category") in ("SafetyCar", "SessionStatus") or m.get("flag") in ("RED", "CHEQUERED", "BLACK AND WHITE")
                    or any(k in up for k in ("PENALTY", "STEWARDS", "RETIRED", "RESUME", "RAIN", "WET", "DISQUALIF", "RED FLAG", "RESTART"))):
                out.append(f"     L{m.get('lap_number')} {m.get('category')}/{m.get('flag')} | {msg}")
        flags = Counter(m.get("flag") for m in rc if m.get("flag"))
        out.append("     flag counts: " + str(dict(flags)))
        out.append("     deleted laps: " + str(sum("DELETED" in (m.get("message") or "").upper() for m in rc)))
        wx = load(key, name, "weather")
        if wx:
            tt = [x["track_temperature"] for x in wx if x.get("track_temperature") is not None]
            rain = sum(1 for x in wx if x.get("rainfall"))
            out.append(f"-- RAW weather: track {min(tt) if tt else '?'}-{max(tt) if tt else '?'}C, rainfall samples {rain}/{len(wx)}")
    (OUT / f"{slug}.txt").write_text("\n".join(out), encoding="utf-8")
    print("[OK]", slug, len(out), "lines")
