import fs from "node:fs";
import path from "node:path";
import type { BlindTest, Brain, MateThread, Story, Track, Weekend } from "./types";

// scripts/sync-data.mjs copies the pipeline output into web/data, and
// scripts/dev.mjs pins cwd to web/ in dev — so this path is always right
// and stays statically scoped for the build tracer.
const DATA_DIR = path.join(process.cwd(), "data");

export function listGPs(): string[] {
  if (!fs.existsSync(DATA_DIR)) return [];
  return fs
    .readdirSync(DATA_DIR)
    .filter((d) => fs.existsSync(path.join(DATA_DIR, d, "weekend.json")));
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

  return {
    scroll: sessions.length > 0,
    sessions: sessions.length,
    moments,
    longest: longest ? { label: longest.label, moments: longest.moments } : null,
    laps: weekend.laps,
    alfred,
    blind,
  };
}
