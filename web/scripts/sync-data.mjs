/**
 * Copies the pipeline output (../data) into web/data so Next reads it from a
 * statically scoped folder. Without this, reading across ".." makes Next trace
 * and bundle the whole repo into the serverless output.
 * Runs automatically before dev and build.
 */
import { cp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(here, "..", "..", "data");
const dest = path.join(here, "..", "data");

if (!existsSync(src)) {
  console.warn(`[sync-data] no pipeline data at ${src} — skipping`);
  process.exit(0);
}

await rm(dest, { recursive: true, force: true });
await cp(src, dest, { recursive: true });
console.log("[sync-data] data/ synced from pipeline output");
