"""
Fase 0: Explorador de datos de OpenF1.
Baja todos los endpoints de todas las sesiones de un GP a pipeline/cache/
(JSON inmutables, nunca se re-descargan) y imprime un inventario honesto
de qué datos tenemos para detectar "momentos".

Uso:  python fase0_explora.py [gp-slug]      (por defecto: silverstone-2026)
"""
import json
import sys
import time
import urllib.request
import urllib.parse
from pathlib import Path

from gps import DEFAULT, weekend_of

BASE = "https://api.openf1.org/v1"
CACHE = Path(__file__).parent / "cache"

# qué finde se baja. Las claves de sesión viven en gps.py, no aquí
SLUG = sys.argv[1] if len(sys.argv) > 1 else DEFAULT
_, _SESSIONS = weekend_of(SLUG)
SESSIONS = {skey: cache_name for skey, cache_name, *_ in _SESSIONS}

# Los 8 de Marc + los que nos interesan a nosotros (radio, adelantamientos, resultados)
ENDPOINTS = [
    "laps", "stints", "pit", "position", "intervals",
    "race_control", "weather", "drivers",
    "team_radio", "overtakes", "session_result", "starting_grid",
]


def fetch(endpoint: str, session_key: int) -> list | None:
    """GET con reintentos suaves; None si el endpoint no existe/no da datos."""
    url = f"{BASE}/{endpoint}?session_key={session_key}"
    for attempt in range(4):
        try:
            with urllib.request.urlopen(url, timeout=60) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            if e.code == 429:          # rate limit: espera y reintenta
                time.sleep(5 * (attempt + 1))
                continue
            if e.code in (404, 422):   # endpoint no disponible para esta sesión
                return None
            raise
        except TimeoutError:
            time.sleep(3)
    return None


def main() -> None:
    CACHE.mkdir(exist_ok=True)
    inventory: dict[str, dict[str, int | str]] = {}

    for skey, sname in SESSIONS.items():
        inventory[sname] = {}
        for ep in ENDPOINTS:
            f = CACHE / f"{skey}_{sname}_{ep}.json"
            if f.exists():
                data = json.loads(f.read_text(encoding="utf-8"))
            else:
                data = fetch(ep, skey)
                time.sleep(0.5)  # no acribillar la API
                if data is not None:
                    f.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
            inventory[sname][ep] = len(data) if isinstance(data, list) else "N/A"
        print(f"[OK] {sname}")

    print("\n=== INVENTARIO (registros por endpoint y sesión) ===")
    header = f"{'endpoint':<15}" + "".join(f"{s:>13}" for s in SESSIONS.values())
    print(header)
    for ep in ENDPOINTS:
        row = f"{ep:<15}" + "".join(f"{str(inventory[s][ep]):>13}" for s in SESSIONS.values())
        print(row)


if __name__ == "__main__":
    main()
