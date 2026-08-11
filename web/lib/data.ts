import fs from "node:fs";
import path from "node:path";
import type { Story, Track, Weekend } from "./types";

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
