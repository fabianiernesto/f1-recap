import fs from "node:fs";
import path from "node:path";
import type { Story, Track } from "./types";

// the pipeline writes static JSON per GP into <repo>/data/<slug>/
// cwd differs between `next dev <dir>` (launcher root) and `next build` (web/),
// so probe the likely locations once
const DATA_DIR = [
  path.join(process.cwd(), "..", "data"),
  path.join(process.cwd(), "data"),
  path.join(process.cwd(), "Proyecto 6_Ernesto - F1 Recap Interactivo", "data"),
].find((p) => fs.existsSync(p)) ?? path.join(process.cwd(), "..", "data");

export function listGPs(): string[] {
  if (!fs.existsSync(DATA_DIR)) return [];
  return fs
    .readdirSync(DATA_DIR)
    .filter((d) => fs.existsSync(path.join(DATA_DIR, d, "race_story.json")));
}

function readJSON<T>(...parts: string[]): T {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, ...parts), "utf-8")) as T;
}

export function loadStory(slug: string): Story {
  return readJSON<Story>(slug, "race_story.json");
}

export function loadTrack(slug: string): Track {
  return readJSON<Track>(slug, "track.json");
}
