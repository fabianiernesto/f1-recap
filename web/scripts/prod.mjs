/**
 * Production launcher (25/10/2026): the site as a visitor would get it.
 *
 * `next dev` compiles every page the first time it is opened and keeps
 * recompiling as files change, which is what made moving between sections
 * feel slow while working. This syncs the data, builds the site once (every
 * GP page is pre-rendered from generateStaticParams) and serves the build.
 *
 *   node web/scripts/prod.mjs            build, then serve on PORT (3006)
 *   node web/scripts/prod.mjs --no-build serve the last build as it is
 */
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(webDir);
const next = path.join(webDir, "node_modules", "next", "dist", "bin", "next");
const port = process.env.PORT ?? "3006";

spawnSync(process.execPath, [path.join(webDir, "scripts", "sync-data.mjs")], { stdio: "inherit" });
if (!process.argv.includes("--no-build")) {
  const b = spawnSync(process.execPath, [next, "build"], { stdio: "inherit", cwd: webDir });
  if (b.status !== 0) process.exit(b.status ?? 1);
}
spawn(process.execPath, [next, "start", "-p", port], { stdio: "inherit", cwd: webDir });
