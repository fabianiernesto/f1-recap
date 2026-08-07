"""
Fase 0 — Análisis de la carrera piloto (Silverstone 2026, Race).
Lee la caché local y responde: ¿qué momentos podemos detectar y con qué calidad?

Uso:  python fase0_analiza.py
"""
import json
from collections import Counter
from pathlib import Path

CACHE = Path(__file__).parent / "cache"
RACE = 11326  # Silverstone 2026 - Race


def load(ep: str) -> list:
    f = CACHE / f"{RACE}_Race_{ep}.json"
    return json.loads(f.read_text(encoding="utf-8")) if f.exists() else []


def main() -> None:
    drivers = {d["driver_number"]: d.get("name_acronym", "?") for d in load("drivers")}

    # --- Resultado final ---
    res = sorted(load("session_result"), key=lambda r: (r.get("position") or 99))
    print("=== RESULTADO (top 5 + DNFs) ===")
    for r in res[:5]:
        print(f"  P{r.get('position')}: {drivers.get(r.get('driver_number'), '?')}")
    dnfs = [r for r in res if r.get("dnf") or r.get("dsq") or r.get("dns")]
    print(f"  DNFs/DSQ: {[drivers.get(r.get('driver_number'), '?') for r in dnfs]}")

    # --- Race control: SC, VSC, banderas, lluvia ---
    rc = load("race_control")
    keys = ["SAFETY CAR", "VIRTUAL SAFETY CAR", "RED FLAG", "YELLOW", "RAIN",
            "PENALTY", "INVESTIGATION", "DELETED"]
    print("\n=== RACE CONTROL (250 mensajes) ===")
    counts = Counter()
    for m in rc:
        txt = (m.get("message") or "").upper()
        for k in keys:
            if k in txt:
                counts[k] += 1
    for k, v in counts.most_common():
        print(f"  {k}: {v} mensajes")
    print("\n  Mensajes de SC/VSC/RED (cronología):")
    for m in rc:
        txt = (m.get("message") or "").upper()
        if any(k in txt for k in ("SAFETY CAR", "RED FLAG")):
            print(f"    V{m.get('lap_number')}: {m.get('message')[:90]}")

    # --- Meteo ---
    w = load("weather")
    rain = [x for x in w if x.get("rainfall")]
    temps = [x.get("track_temperature") for x in w if x.get("track_temperature")]
    print(f"\n=== METEO ===\n  Muestras con lluvia: {len(rain)}/{len(w)}"
          f" | Pista: {min(temps)}-{max(temps)} C" if temps else "  sin datos")

    # --- Adelantamientos por vuelta (los 5 picos) ---
    ov = load("overtakes")
    by_lap = Counter()
    laps_data = load("laps")
    # mapear fecha->vuelta con laps del adelantado seria fino; aproximamos por posicion en el tiempo
    print(f"\n=== ADELANTAMIENTOS === total: {len(ov)}")
    sample = ov[len(ov)//2]
    print(f"  Formato de un registro: {sorted(sample.keys())}")

    # --- Stints / compuestos ---
    stints = load("stints")
    comp = Counter(s.get("compound") for s in stints)
    print(f"\n=== NEUMATICOS === stints: {len(stints)} | compuestos: {dict(comp)}")

    # --- Vuelta rapida ---
    best = min((l for l in laps_data if l.get("lap_duration")),
               key=lambda l: l["lap_duration"])
    print(f"\n=== VUELTA RAPIDA === {drivers.get(best.get('driver_number'))} "
          f"V{best.get('lap_number')}: {best.get('lap_duration')}s")

    # --- Team radio ---
    tr = load("team_radio")
    who = Counter(drivers.get(x.get("driver_number"), "?") for x in tr)
    print(f"\n=== TEAM RADIO === {len(tr)} clips: {dict(who)}")


if __name__ == "__main__":
    main()
