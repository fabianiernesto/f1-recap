/**
 * Dev launcher: pins cwd to web/ (the preview launcher starts node from the
 * repo root, which broke every process.cwd()-relative path), syncs the
 * pipeline data, then hands over to next dev.
 */
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(webDir);

spawnSync(process.execPath, [path.join(webDir, "scripts", "sync-data.mjs")], {
  stdio: "inherit",
});

const next = path.join(webDir, "node_modules", "next", "dist", "bin", "next");
const port = process.env.PORT ?? "3000";
spawn(process.execPath, [next, "dev", "-p", port], {
  stdio: "inherit",
  cwd: webDir,
});
