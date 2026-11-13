"""
Which weekends the pipeline knows about.

One place for the two facts that change per Grand Prix and nowhere else: what
to call it, and which OpenF1 sessions make it up. Everything downstream --
the downloader, the builder, the stories, the blind test, Alfred's data pack --
reads the weekend from here, so adding a round is an entry in this file and
two commands, not an edit inside the analysis.

The session tuple is (session_key, cache_name, slug, label, kind).

  session_key  OpenF1's id, from /v1/sessions?year=&country_name=
  cache_name   the name in the cache filename. Never rename one that has
               already been downloaded: the files are keyed on it and the
               point of the cache is that a session is fetched exactly once.
  slug         the URL segment, and the suffix of story_<slug>.json
  kind         practice | quali | race -- picks which storyteller runs

A sprint weekend has one practice and two races; a normal one has three
practices and one. Nothing else in the pipeline cares about the difference.
"""

GPS: dict[str, dict] = {
    "silverstone-2026": {
        "meta": {
            "slug": "silverstone-2026", "gp": "British Grand Prix 2026",
            "short": "British Grand Prix", "circuit": "Silverstone",
            "country": "Great Britain", "date": "05 JUL 2026", "laps": 52,
        },
        "sessions": [
            (11316, "FP1", "fp1", "Practice 1", "practice"),
            (11317, "Sprint_Quali", "sprint-quali", "Sprint Qualifying", "quali"),
            (11321, "Sprint", "sprint", "Sprint", "race"),
            (11322, "Quali", "quali", "Qualifying", "quali"),
            (11326, "Race", "race", "Race", "race"),
        ],
    },
    "barcelona-2026": {
        "meta": {
            "slug": "barcelona-2026", "gp": "Barcelona Grand Prix 2026",
            "short": "Barcelona Grand Prix", "circuit": "Barcelona",
            "country": "Spain", "date": "14 JUN 2026", "laps": 66,
        },
        "sessions": [
            (11300, "FP1", "fp1", "Practice 1", "practice"),
            (11301, "FP2", "fp2", "Practice 2", "practice"),
            (11302, "FP3", "fp3", "Practice 3", "practice"),
            (11303, "Quali", "quali", "Qualifying", "quali"),
            (11307, "Race", "race", "Race", "race"),
        ],
    },
    "monza-2026": {
        "meta": {
            "slug": "monza-2026", "gp": "Italian Grand Prix 2026",
            "short": "Italian Grand Prix", "circuit": "Monza",
            "country": "Italy", "date": "06 SEP 2026", "laps": 53,
        },
        "sessions": [
            (11354, "FP1", "fp1", "Practice 1", "practice"),
            (11355, "FP2", "fp2", "Practice 2", "practice"),
            (11356, "FP3", "fp3", "Practice 3", "practice"),
            (11357, "Quali", "quali", "Qualifying", "quali"),
            (11361, "Race", "race", "Race", "race"),
        ],
    },
    "hungaroring-2026": {
        "meta": {
            "slug": "hungaroring-2026", "gp": "Hungarian Grand Prix 2026",
            "short": "Hungarian Grand Prix", "circuit": "Hungaroring",
            "country": "Hungary", "date": "26 JUL 2026", "laps": 70,
        },
        "sessions": [
            (11335, "FP1", "fp1", "Practice 1", "practice"),
            (11336, "FP2", "fp2", "Practice 2", "practice"),
            (11337, "FP3", "fp3", "Practice 3", "practice"),
            (11338, "Quali", "quali", "Qualifying", "quali"),
            (11342, "Race", "race", "Race", "race"),
        ],
    },
    "madring-2026": {
        "meta": {
            "slug": "madring-2026", "gp": "Spanish Grand Prix 2026",
            "short": "Spanish Grand Prix", "circuit": "Madring",
            "country": "Spain", "date": "13 SEP 2026", "laps": 57,
        },
        "sessions": [
            (11362, "FP1", "fp1", "Practice 1", "practice"),
            (11363, "FP2", "fp2", "Practice 2", "practice"),
            (11364, "FP3", "fp3", "Practice 3", "practice"),
            (11365, "Quali", "quali", "Qualifying", "quali"),
            (11369, "Race", "race", "Race", "race"),
        ],
    },
    "baku-2026": {
        "meta": {
            "slug": "baku-2026", "gp": "Azerbaijan Grand Prix 2026",
            "short": "Azerbaijan Grand Prix", "circuit": "Baku",
            "country": "Azerbaijan", "date": "26 SEP 2026", "laps": 51,
        },
        "sessions": [
            (11370, "FP1", "fp1", "Practice 1", "practice"),
            (11371, "FP2", "fp2", "Practice 2", "practice"),
            (11372, "FP3", "fp3", "Practice 3", "practice"),
            (11373, "Quali", "quali", "Qualifying", "quali"),
            (11377, "Race", "race", "Race", "race"),
        ],
    },
    "albert-park-2026": {
        "meta": {
            "slug": "albert-park-2026", "gp": "Australian Grand Prix 2026",
            "short": "Australian Grand Prix", "circuit": "Albert Park",
            "country": "Australia", "date": "08 MAR 2026", "laps": 58,
        },
        "sessions": [
            (11227, "FP1", "fp1", "Practice 1", "practice"),
            (11228, "FP2", "fp2", "Practice 2", "practice"),
            (11229, "FP3", "fp3", "Practice 3", "practice"),
            (11230, "Quali", "quali", "Qualifying", "quali"),
            (11234, "Race", "race", "Race", "race"),
        ],
    },
    "shanghai-2026": {
        "meta": {
            "slug": "shanghai-2026", "gp": "Chinese Grand Prix 2026",
            "short": "Chinese Grand Prix", "circuit": "Shanghai",
            "country": "China", "date": "15 MAR 2026", "laps": 56,
        },
        "sessions": [
            (11235, "FP1", "fp1", "Practice 1", "practice"),
            (11236, "Sprint_Quali", "sprint-quali", "Sprint Qualifying", "quali"),
            (11240, "Sprint", "sprint", "Sprint", "race"),
            (11241, "Quali", "quali", "Qualifying", "quali"),
            (11245, "Race", "race", "Race", "race"),
        ],
    },
    "suzuka-2026": {
        "meta": {
            "slug": "suzuka-2026", "gp": "Japanese Grand Prix 2026",
            "short": "Japanese Grand Prix", "circuit": "Suzuka",
            "country": "Japan", "date": "29 MAR 2026", "laps": 53,
        },
        "sessions": [
            (11246, "FP1", "fp1", "Practice 1", "practice"),
            (11247, "FP2", "fp2", "Practice 2", "practice"),
            (11248, "FP3", "fp3", "Practice 3", "practice"),
            (11249, "Quali", "quali", "Qualifying", "quali"),
            (11253, "Race", "race", "Race", "race"),
        ],
    },
    "miami-2026": {
        "meta": {
            "slug": "miami-2026", "gp": "Miami Grand Prix 2026",
            "short": "Miami Grand Prix", "circuit": "Miami",
            "country": "United States", "date": "03 MAY 2026", "laps": 57,
        },
        "sessions": [
            (11270, "FP1", "fp1", "Practice 1", "practice"),
            (11271, "Sprint_Quali", "sprint-quali", "Sprint Qualifying", "quali"),
            (11275, "Sprint", "sprint", "Sprint", "race"),
            (11276, "Quali", "quali", "Qualifying", "quali"),
            (11280, "Race", "race", "Race", "race"),
        ],
    },
    "montreal-2026": {
        "meta": {
            "slug": "montreal-2026", "gp": "Canadian Grand Prix 2026",
            "short": "Canadian Grand Prix", "circuit": "Montreal",
            "country": "Canada", "date": "24 MAY 2026", "laps": 70,
        },
        "sessions": [
            (11281, "FP1", "fp1", "Practice 1", "practice"),
            (11282, "Sprint_Quali", "sprint-quali", "Sprint Qualifying", "quali"),
            (11286, "Sprint", "sprint", "Sprint", "race"),
            (11287, "Quali", "quali", "Qualifying", "quali"),
            (11291, "Race", "race", "Race", "race"),
        ],
    },
    "monaco-2026": {
        "meta": {
            "slug": "monaco-2026", "gp": "Monaco Grand Prix 2026",
            "short": "Monaco Grand Prix", "circuit": "Monaco",
            "country": "Monaco", "date": "07 JUN 2026", "laps": 78,
        },
        "sessions": [
            (11292, "FP1", "fp1", "Practice 1", "practice"),
            (11293, "FP2", "fp2", "Practice 2", "practice"),
            (11294, "FP3", "fp3", "Practice 3", "practice"),
            (11295, "Quali", "quali", "Qualifying", "quali"),
            (11299, "Race", "race", "Race", "race"),
        ],
    },
    "spielberg-2026": {
        "meta": {
            "slug": "spielberg-2026", "gp": "Austrian Grand Prix 2026",
            "short": "Austrian Grand Prix", "circuit": "Spielberg",
            "country": "Austria", "date": "28 JUN 2026", "laps": 71,
        },
        "sessions": [
            (11308, "FP1", "fp1", "Practice 1", "practice"),
            (11309, "FP2", "fp2", "Practice 2", "practice"),
            (11310, "FP3", "fp3", "Practice 3", "practice"),
            (11311, "Quali", "quali", "Qualifying", "quali"),
            (11315, "Race", "race", "Race", "race"),
        ],
    },
    "spa-2026": {
        "meta": {
            "slug": "spa-2026", "gp": "Belgian Grand Prix 2026",
            "short": "Belgian Grand Prix", "circuit": "Spa-Francorchamps",
            "country": "Belgium", "date": "19 JUL 2026", "laps": 44,
        },
        "sessions": [
            (11327, "FP1", "fp1", "Practice 1", "practice"),
            (11328, "FP2", "fp2", "Practice 2", "practice"),
            (11329, "FP3", "fp3", "Practice 3", "practice"),
            (11330, "Quali", "quali", "Qualifying", "quali"),
            (11334, "Race", "race", "Race", "race"),
        ],
    },
    "zandvoort-2026": {
        "meta": {
            "slug": "zandvoort-2026", "gp": "Dutch Grand Prix 2026",
            "short": "Dutch Grand Prix", "circuit": "Zandvoort",
            "country": "Netherlands", "date": "23 AUG 2026", "laps": 72,
        },
        "sessions": [
            (11343, "FP1", "fp1", "Practice 1", "practice"),
            (11344, "Sprint_Quali", "sprint-quali", "Sprint Qualifying", "quali"),
            (11348, "Sprint", "sprint", "Sprint", "race"),
            (11349, "Quali", "quali", "Qualifying", "quali"),
            (11353, "Race", "race", "Race", "race"),
        ],
    },
    # Round 16: "Formula 1 Gulf Air Bahrain Grand Prix in Malaysia 2026". F1 and
    # OpenF1 keep the Bahrain name and country; it ran at Sepang, near Kuala Lumpur
    "sepang-2026": {
        "meta": {
            "slug": "sepang-2026", "gp": "Bahrain Grand Prix in Malaysia 2026",
            "short": "Bahrain Grand Prix in Malaysia", "circuit": "Sepang",
            "country": "Malaysia", "date": "04 OCT 2026", "laps": 56,
        },
        "sessions": [
            (11727, "FP1", "fp1", "Practice 1", "practice"),
            (11728, "FP2", "fp2", "Practice 2", "practice"),
            (11729, "FP3", "fp3", "Practice 3", "practice"),
            (11730, "Quali", "quali", "Qualifying", "quali"),
            (11731, "Race", "race", "Race", "race"),
        ],
    },
    "marina-bay-2026": {
        "meta": {
            "slug": "marina-bay-2026", "gp": "Singapore Grand Prix 2026",
            "short": "Singapore Grand Prix", "circuit": "Marina Bay",
            "country": "Singapore", "date": "11 OCT 2026", "laps": 62,
        },
        "sessions": [
            (11378, "FP1", "fp1", "Practice 1", "practice"),
            (11379, "Sprint_Quali", "sprint-quali", "Sprint Qualifying", "quali"),
            (11383, "Sprint", "sprint", "Sprint", "race"),
            (11384, "Quali", "quali", "Qualifying", "quali"),
            (11388, "Race", "race", "Race", "race"),
        ],
    },
    "austin-2026": {
        "meta": {
            "slug": "austin-2026", "gp": "United States Grand Prix 2026",
            "short": "United States Grand Prix", "circuit": "Austin",
            "country": "United States", "date": "25 OCT 2026", "laps": 56,
        },
        "sessions": [
            (11389, "FP1", "fp1", "Practice 1", "practice"),
            (11390, "FP2", "fp2", "Practice 2", "practice"),
            (11391, "FP3", "fp3", "Practice 3", "practice"),
            (11392, "Quali", "quali", "Qualifying", "quali"),
            (11396, "Race", "race", "Race", "race"),
        ],
    },
    "mexico-city-2026": {
        "meta": {
            "slug": "mexico-city-2026", "gp": "Mexico City Grand Prix 2026",
            "short": "Mexico City Grand Prix", "circuit": "Mexico City",
            "country": "Mexico", "date": "01 NOV 2026", "laps": 71,
        },
        "sessions": [
            (11397, "FP1", "fp1", "Practice 1", "practice"),
            (11398, "FP2", "fp2", "Practice 2", "practice"),
            # FP3 (11399, "FP3", "fp3", "Practice 3", "practice") stays out: the feed
            # starts 14 minutes in and is 26 laps short of the official sheet, and
            # those minutes (a yellow flag among them) are filed under the race.
            # Every card it gave rested on that hole. Back in if the feed is mended
            # (delete cache/11399_* first: the cache is never re-downloaded).
            (11400, "Quali", "quali", "Qualifying", "quali"),
            (11404, "Race", "race", "Race", "race"),
        ],
    },
    # "Formula 1 MSC Cruises Grande Premio de Sao Paulo 2026": length and laps
    # from formula1.com/en/racing/2026/brazil, read 13-nov-2026
    "interlagos-2026": {
        "meta": {
            "slug": "interlagos-2026", "gp": "Sao Paulo Grand Prix 2026",
            "short": "Sao Paulo Grand Prix", "circuit": "Interlagos",
            "country": "Brazil", "date": "08 NOV 2026", "laps": 71,
        },
        "sessions": [
            (11405, "FP1", "fp1", "Practice 1", "practice"),
            (11406, "FP2", "fp2", "Practice 2", "practice"),
            (11407, "FP3", "fp3", "Practice 3", "practice"),
            (11408, "Quali", "quali", "Qualifying", "quali"),
            (11412, "Race", "race", "Race", "race"),
        ],
    },
}

DEFAULT = "silverstone-2026"


def weekend_of(slug: str) -> tuple[dict, list[tuple]]:
    """The GP's metadata and its sessions, or a list of what is on offer."""
    if slug not in GPS:
        known = ", ".join(sorted(GPS))
        raise SystemExit(f"unknown weekend '{slug}'. Known: {known}")
    gp = GPS[slug]
    return gp["meta"], gp["sessions"]
