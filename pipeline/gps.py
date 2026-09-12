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
            "slug": "barcelona-2026", "gp": "Spanish Grand Prix 2026",
            "short": "Spanish Grand Prix", "circuit": "Barcelona",
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
}

DEFAULT = "silverstone-2026"


def weekend_of(slug: str) -> tuple[dict, list[tuple]]:
    """The GP's metadata and its sessions, or a list of what is on offer."""
    if slug not in GPS:
        known = ", ".join(sorted(GPS))
        raise SystemExit(f"unknown weekend '{slug}'. Known: {known}")
    gp = GPS[slug]
    return gp["meta"], gp["sessions"]
