"""
Fase 1 (v0, borrador) — Generador de historia de la carrera.
Lee la cache de Silverstone 2026 y genera las cards del recap "3 minutos":
data/silverstone-2026/race_story.json  +  copia JS para el visor local.

Los textos son templates v0: robotitos aun. Se pulen en iteraciones.

Uso:  python fase1_story_v0.py
"""
import json
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).parent
CACHE = ROOT / "cache"
OUT = ROOT.parent / "data" / "silverstone-2026"
PREVIEW = ROOT.parent / "web_preview"

RACE, QUALI = 11326, 11322
TOTAL_LAPS = 52


def load(skey: int, sname: str, ep: str) -> list:
    f = CACHE / f"{skey}_{sname}_{ep}.json"
    return json.loads(f.read_text(encoding="utf-8")) if f.exists() else []


def parse_ts(s: str | None) -> datetime | None:
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00")) if s else None
    except (ValueError, TypeError):
        return None


def main() -> None:
    drivers = {d["driver_number"]: d for d in load(RACE, "Race", "drivers")}

    def name(num: int | None) -> str:
        d = drivers.get(num, {})
        return d.get("last_name") or d.get("name_acronym") or f"#{num}"

    def team(num: int | None) -> str:
        return drivers.get(num, {}).get("team_name", "?")

    laps = load(RACE, "Race", "laps")
    result = sorted(load(RACE, "Race", "session_result"),
                    key=lambda r: (r.get("position") or 99))
    overtakes = load(RACE, "Race", "overtakes")
    pits = load(RACE, "Race", "pit")
    stints = load(RACE, "Race", "stints")
    quali_res = sorted(load(QUALI, "Quali", "session_result"),
                       key=lambda r: (r.get("position") or 99))

    # ---- indice vuelta <-> tiempo (mediana de date_start por vuelta) ----
    lap_starts: dict[int, list[datetime]] = defaultdict(list)
    for l in laps:
        ts = parse_ts(l.get("date_start"))
        if l.get("lap_number") and ts:
            lap_starts[l["lap_number"]].append(ts)
    lap_index = sorted(
        (ln, sorted(ts)[len(ts) // 2]) for ln, ts in lap_starts.items()
    )

    def lap_of(ts: datetime | None) -> int | None:
        if not ts:
            return None
        prev = None
        for ln, start in lap_index:
            if ts < start:
                return prev
            prev = ln
        return prev

    # ---- hechos clave ----
    pole = quali_res[0] if quali_res else None

    def q3_gap(r: dict) -> float | None:
        """En quali, gap_to_leader es lista [Q1,Q2,Q3]; devuelve el gap de Q3."""
        g = r.get("gap_to_leader")
        if isinstance(g, list):
            vals = [x for x in g if isinstance(x, (int, float))]
            return vals[-1] if vals else None
        return g if isinstance(g, (int, float)) else None

    pole_margin = q3_gap(quali_res[1]) if len(quali_res) > 1 else None
    winner, second, third = result[0], result[1], result[2]
    dnfs = [r for r in result if r.get("dnf")]

    # adelantamientos al top-3 de posicion (la pelea de delante)
    front_ov = [o for o in overtakes if (o.get("position") or 99) <= 3]
    # el piloto que mas adelanto
    ov_count = Counter(o["overtaking_driver_number"] for o in overtakes)
    top_mover_num, top_mover_n = ov_count.most_common(1)[0]

    # parada mas rapida real (pit_duration en s)
    real_pits = [p for p in pits if p.get("pit_duration")]
    fastest_pit = min(real_pits, key=lambda p: p["pit_duration"]) if real_pits else None

    # vuelta rapida
    best_lap = min((l for l in laps if l.get("lap_duration")),
                   key=lambda l: l["lap_duration"])

    # posicion final vs parrilla: el que mas gano
    grid_pos = {r["driver_number"]: r.get("position") for r in quali_res}
    gains = []
    for r in result:
        g, p = grid_pos.get(r["driver_number"]), r.get("position")
        if g and p and not r.get("dnf"):
            gains.append((g - p, r["driver_number"], g, p))
    best_gain = max(gains) if gains else None

    # ---- cards (recap "3 minutos") ----
    cards = [
        {
            "type": "cover", "kicker": "GP de Gran Bretana · Silverstone",
            "title": "Esta carrera te la cuento yo",
            "text": f"{TOTAL_LAPS} vueltas, {len(overtakes)} adelantamientos y un final "
                    "que se decidio con el Safety Car en pista. Vamos.",
        },
        {
            "type": "prediction", "kicker": "Antes de nada, juega",
            "title": f"{name(pole['driver_number'])} salia desde la pole en casa de Hamilton. "
                     "¿Aguanto la primera vuelta como lider?" if pole else "Prediccion",
            "options": ["Si, aguanto", "No, la perdio"],
            "reveal_key": "pole_hold",
        },
        {
            "type": "moment", "lap": 1, "kicker": "Salida",
            "title": "Luces fuera",
            "text": f"Pole para {name(pole['driver_number'])} tras una quali que se decidio "
                    f"por {pole_margin:.3f}s de nada."
                    if pole and pole_margin else "Arranca la carrera.",
        },
        {
            "type": "moment", "kicker": "La pelea de delante",
            "title": f"{len(front_ov)} adelantamientos SOLO en el podio provisional",
            "text": "La cabeza de carrera no fue un desfile: hubo "
                    f"{len(front_ov)} cambios entre los 3 primeros. "
                    f"El mas peleon del dia: {name(top_mover_num)}, con {top_mover_n} adelantamientos.",
            "dato": {"label": "Adelantamientos por piloto (top 5)",
                     "rows": [[name(n), c] for n, c in ov_count.most_common(5)]},
        },
        {
            "type": "moment", "kicker": "Lo que la TV no enseno",
            "title": f"{name(best_gain[1])}: de P{best_gain[2]} a P{best_gain[3]}"
                     if best_gain else "Remontadas",
            "text": f"La mejor remontada del dia: {name(best_gain[1])} gano "
                    f"{best_gain[0]} posiciones desde la parrilla. Casi nadie hablo de ello."
                    if best_gain else "",
        },
        {
            "type": "moment", "kicker": "Boxes",
            "title": f"Parada mas rapida: {fastest_pit['pit_duration']:.1f}s "
                     f"({name(fastest_pit['driver_number'])})" if fastest_pit else "Paradas",
            "text": "Estrategia a una parada para la mayoria: "
                    + " / ".join(f"{c}: {n}" for c, n in
                                 Counter(s.get('compound') for s in stints).most_common())
                    + ". El neumatico no fue el drama hoy.",
        },
        {
            "type": "moment", "kicker": "El drama",
            "title": f"Verstappen, fuera" if any(name(r['driver_number']) == 'Verstappen' for r in dnfs) else "Abandonos",
            "text": "Abandonaron " + ", ".join(name(r["driver_number"]) for r in dnfs)
                    + ". Un Mundial se puede torcer en una tarde asi.",
        },
        {
            "type": "moment", "lap": best_lap.get("lap_number"), "kicker": "Vuelta rapida",
            "title": f"{name(best_lap['driver_number'])}: {best_lap['lap_duration']:.3f}s",
            "text": f"En la vuelta {best_lap.get('lap_number')}, "
                    f"{name(best_lap['driver_number'])} ({team(best_lap['driver_number'])}) "
                    "clavo la vuelta mas rapida de la tarde.",
        },
        {
            "type": "moment", "lap": 48, "kicker": "Vuelta 48 de 52",
            "title": "SAFETY CAR. Todo lo ganado, borrado.",
            "text": "A 4 vueltas del final salio el Safety Car... y en la 51, OTRO. "
                    "La carrera termino con los coches agrupados y a Sainz "
                    "investigado por infraccion bajo SC. Infarto hasta la bandera.",
        },
        {
            "type": "moment", "lap": 52, "kicker": "Bandera a cuadros",
            "title": f"Gana {name(winner['driver_number'])}",
            "text": f"{name(winner['driver_number'])} ({team(winner['driver_number'])}) gana "
                    f"por delante de {name(second['driver_number'])} y de "
                    f"{name(third['driver_number'])} — podio en casa. Silverstone en pie.",
        },
        {
            "type": "share", "kicker": "Silverstone en una frase",
            "title": "«La carrera se decidio cuando ya nadie miraba el crono»",
            "text": "Nota del finde: pendiente de calcular con la formula de la v1 :)",
        },
    ]

    story = {
        "gp": "GP de Gran Bretana 2026", "session": "Race",
        "circuit": "Silverstone", "laps": TOTAL_LAPS,
        "generated": "fase1_story_v0 (borrador)", "cards": cards,
    }

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "race_story.json").write_text(
        json.dumps(story, ensure_ascii=False, indent=2), encoding="utf-8")
    PREVIEW.mkdir(exist_ok=True)
    (PREVIEW / "story_data.js").write_text(
        "window.STORY = " + json.dumps(story, ensure_ascii=False) + ";",
        encoding="utf-8")
    print(f"[OK] {len(cards)} cards -> {OUT / 'race_story.json'}")
    print(f"[OK] visor -> {PREVIEW / 'story_data.js'}")


if __name__ == "__main__":
    main()
