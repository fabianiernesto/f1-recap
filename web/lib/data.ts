import fs from "node:fs";
import path from "node:path";
import type {
  BlindTest, Brain, GhostRace, MateThread, Mystery, PitWall, Replay, Story, Track, Weekend,
} from "./types";

// scripts/sync-data.mjs copies the pipeline output into web/data, and
// scripts/dev.mjs pins cwd to web/ in dev, so this path is always right
// and stays statically scoped for the build tracer.
const DATA_DIR = path.join(process.cwd(), "data");

/**
 * The weekends the site shows: only the ones with at least one session built.
 *
 * A circuit arrives in two steps, the track shape from FastF1 first and the
 * sessions from OpenF1 second, and OpenF1 locks itself to paying users for the
 * whole of a live race weekend. So a folder can sit with a track and no
 * sessions for a day, and a card on the home page promising "0 sessions · 0
 * moments" is worse than no card at all.
 */
export function listGPs(): string[] {
  if (!fs.existsSync(DATA_DIR)) return [];
  return fs
    .readdirSync(DATA_DIR)
    .filter((d) => {
      const f = path.join(DATA_DIR, d, "weekend.json");
      if (!fs.existsSync(f)) return false;
      const w = JSON.parse(fs.readFileSync(f, "utf-8")) as Weekend;
      return Array.isArray(w.sessions) && w.sessions.length > 0;
    });
}

function readJSON<T>(...parts: string[]): T {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, ...parts), "utf-8")) as T;
}

export function loadWeekend(slug: string): Weekend {
  return readJSON<Weekend>(slug, "weekend.json");
}

export function loadStory(slug: string, session = "race"): Story {
  return readJSON<Story>(slug, `story_${session}.json`);
}

export function loadTrack(slug: string): Track {
  return readJSON<Track>(slug, "track.json");
}

export function hasSession(slug: string, session: string): boolean {
  return fs.existsSync(path.join(DATA_DIR, slug, `story_${session}.json`));
}

/** The mate only has something to say about sessions that were a race. */
export function loadMate(slug: string, session: string): MateThread | null {
  const f = path.join(DATA_DIR, slug, `mate_${session}.json`);
  return fs.existsSync(f)
    ? (JSON.parse(fs.readFileSync(f, "utf-8")) as MateThread)
    : null;
}

/** The race packed into something Alfred can look answers up in. */
export function loadBrain(slug: string, session: string): Brain | null {
  const f = path.join(DATA_DIR, slug, `brain_${session}.json`);
  return fs.existsSync(f)
    ? (JSON.parse(fs.readFileSync(f, "utf-8")) as Brain)
    : null;
}

/** Anonymised driver sheets to guess at. */
export function loadBlind(slug: string, session: string): BlindTest | null {
  const f = path.join(DATA_DIR, slug, `blind_${session}.json`);
  return fs.existsSync(f)
    ? (JSON.parse(fs.readFileSync(f, "utf-8")) as BlindTest)
    : null;
}

/** The race, replayable: the engine under Call the race and The ghost. */
export function loadReplay(slug: string, session: string): Replay | null {
  const f = path.join(DATA_DIR, slug, `replay_${session}.json`);
  return fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, "utf-8")) as Replay) : null;
}

/** The ghost's seats, where the tyre model can price a driver's calls. */
export function loadGhost(slug: string): GhostRace | null {
  const f = path.join(DATA_DIR, slug, "muro_race.json");
  return fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, "utf-8")) as GhostRace) : null;
}

/** The race's mystery driver, the same puzzle for everybody. */
export function loadMystery(slug: string, session: string): Mystery | null {
  const f = path.join(DATA_DIR, slug, `mystery_${session}.json`);
  return fs.existsSync(f)
    ? (JSON.parse(fs.readFileSync(f, "utf-8")) as Mystery)
    : null;
}

/** The strategy calls one garage faced, with what each answer cost. */
export function loadPitWall(slug: string, session: string): PitWall | null {
  const f = path.join(DATA_DIR, slug, `pitwall_${session}.json`);
  return fs.existsSync(f)
    ? (JSON.parse(fs.readFileSync(f, "utf-8")) as PitWall)
    : null;
}

/**
 * What a Grand Prix actually offers, counted once.
 *
 * Both the front door and the activity chooser read this, so the two screens
 * can never disagree about what exists or how much of it there is. The gates
 * are the ones the chooser already used: a weekend needs sessions, and a blind
 * test needs at least three rounds to be worth starting.
 */
export function activitiesFor(slug: string, weekend: Weekend) {
  const sessions = weekend.sessions;
  const moments = sessions.reduce((n, s) => n + s.moments, 0);
  const longest = sessions.reduce(
    (best, s) => (s.moments > (best?.moments ?? 0) ? s : best),
    sessions[0]
  );
  // Alfred only exists where the pipeline built him a pack, which is the races
  const alfred = sessions.filter((s) => loadBrain(slug, s.slug)).length;

  const raceBlind = loadBlind(slug, "race");
  const test = raceBlind ?? loadBlind(slug, "sprint");
  const blindSession = raceBlind ? "race" : "sprint";
  const blind =
    test && test.rounds.length >= 3
      ? {
          session: blindSession,
          rounds: test.rounds.length,
          options: test.rounds[0].options.length,
          clues: Math.max(...test.rounds.map((r) => r.rows.length)),
        }
      : null;

  // the mystery driver lives on the same page as the blind test, which is
  // its free mode once the puzzle is done
  const mystery = loadMystery(slug, blindSession);

  // the pit wall exists only where the tyre data held up, so it is asked for
  // rather than assumed: see pipeline/pitwall.py
  const raceWall = loadPitWall(slug, "race");
  const wall = raceWall ?? loadPitWall(slug, "sprint");
  const wallSession = raceWall ? "race" : "sprint";

  return {
    scroll: sessions.length > 0,
    sessions: sessions.length,
    moments,
    longest: longest ? { label: longest.label, moments: longest.moments } : null,
    laps: weekend.laps,
    alfred,
    blind,
    mystery: mystery ? { session: blindSession, clues: mystery.clues.length } : null,
    call: (() => {
      const r = loadReplay(slug, "race");
      const sp = loadReplay(slug, "sprint");
      return r && r.calls.length >= 3
        ? { session: "race", calls: r.calls.length, laps: r.laps, sprint: !!(sp && sp.calls.length >= 3) }
        : null;
    })(),
    // the exchange needs only the race replayed: every race has one
    exchange: (() => {
      const r = loadReplay(slug, "race");
      const sp = loadReplay(slug, "sprint");
      return r ? { session: "race", drivers: r.field.length, laps: r.laps, sprint: !!sp } : null;
    })(),
    pitwall: wall
      ? {
          session: wallSession,
          driver: wall.driver.name,
          team: wall.driver.team,
          calls: wall.calls.length,
          margin: wall.driver.margin,
        }
      : null,
  };
}
