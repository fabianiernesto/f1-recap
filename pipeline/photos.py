"""
The right photograph of the right driver in the right suit.

OpenF1 hands over a headshot URL per driver, and it is the wrong one. It points
at F1's old asset path, which is keyed by driver and not by season, and that
path still serves Perez in a Red Bull suit in a year he is driving a Cadillac.
Put that on a screen and every number next to it stops being believable.

formula1.com's own 2026 driver pages use a different path, keyed by season AND
team:

    .../common/f1/2026/<team>/<driverid>/2026<team><driverid>right.webp

which is exactly what we need, and it does something the old path cannot: a
driver who changes team mid-season has one image per team. Lawson was Racing
Bulls at Silverstone and Red Bull Racing at Monza, and both images exist. So
the team is taken from the session's own driver list, never from a table
written in advance, and the photo follows whoever he was driving for that
weekend.

Every URL is checked against the CDN before it is written into the data. The
fallback parameter formula1.com uses is left off on purpose: with it, a miss
returns a generic silhouette with a 200, and without it a miss is a 404, which
is a fact a script can act on. Results are cached in pipeline/cache so a
rebuild does not go back to the network.
"""
import json
import re
import urllib.error
import urllib.request
from pathlib import Path

CACHE = Path(__file__).parent / "cache" / "photos_2026.json"
SEASON = 2026
WIDTH = 1000

URL = ("https://media.formula1.com/image/upload/c_lfill,w_{w}/q_auto/v1740000001/"
       "common/f1/{season}/{team}/{did}/{season}{team}{did}right.webp")

# drivers whose OpenF1 record carries no headshot URL to read the id out of
F1_IDS = {
    "TSU": "yuktsu01",
}


def team_slug(name: str | None) -> str:
    """'Haas F1 Team' -> 'haasf1team', 'Red Bull Racing' -> 'redbullracing'."""
    return re.sub(r"[^a-z0-9]", "", (name or "").lower())


def driver_id(d: dict) -> str | None:
    """The six-letter id F1 files a driver under, e.g. serper01."""
    m = re.search(r"/([a-z]{6}\d{2})\.png", d.get("headshot_url") or "")
    if m:
        return m.group(1)
    return F1_IDS.get(d.get("name_acronym") or "")


def _known() -> dict[str, bool]:
    if CACHE.exists():
        return json.loads(CACHE.read_text(encoding="utf-8"))
    return {}


def _exists(url: str) -> bool:
    req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status == 200
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError):
        return False


def photo(d: dict) -> str:
    """This season's photograph of this driver in this team's colours.

    Falls back to whatever OpenF1 gave when F1 has nothing for the pair, which
    happens for a reserve running a Friday session. That is a known wrong
    suit rather than no face at all, and the caller can tell the two apart
    because the old URL still contains '/content/dam/'.
    """
    did, team = driver_id(d), team_slug(d.get("team_name"))
    if not did or not team:
        return d.get("headshot_url") or ""
    url = URL.format(w=WIDTH, season=SEASON, team=team, did=did)
    known = _known()
    if url not in known:
        known[url] = _exists(url)
        CACHE.parent.mkdir(exist_ok=True)
        CACHE.write_text(json.dumps(known, indent=1), encoding="utf-8")
    return url if known[url] else (d.get("headshot_url") or "")
