/**
 * Starts the dev server so that it OUTLIVES the editor.
 *
 * Two things were killing it. The preview launcher spawns node as a child of
 * claude.exe, so the app taking down its process tree took the server with
 * it. Detaching from that tree was not enough on its own: the server still
 * shared a console with the tools, so a Ctrl+C meant for them landed on it as
 * well, which is why every log ended in a literal ^C instead of a stack trace.
 *
 * On Windows `detached` means DETACHED_PROCESS, so the child gets no console
 * at all and there is nowhere for that signal to arrive. unref() then lets
 * this launcher exit without taking the server down with it.
 *
 *   node web/scripts/serve.mjs [--restart] [--port 3000]
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const logFile = path.join(webDir, ".dev-server.log");
const portArg = process.argv.indexOf("--port");
const port = (portArg > -1 && Number(process.argv[portArg + 1])) || 3000;
const restart = process.argv.includes("--restart");

/** A socket probe answers at once; an HTTP call would sit on its timeout. */
const isUp = () =>
  new Promise((resolve) => {
    const s = net.connect(port, "127.0.0.1");
    const done = (v) => { s.destroy(); resolve(v); };
    s.once("connect", () => done(true));
    s.once("error", () => done(false));
    s.setTimeout(700, () => done(false));
  });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (await isUp()) {
  if (!restart) {
    console.log(`already up on ${port}`);
    process.exit(0);
  }
  spawnSync("powershell.exe", ["-NoProfile", "-Command",
    `Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue |` +
    ` ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }`],
    { stdio: "ignore" });
  await sleep(1200);
}

const out = fs.openSync(logFile, "a");
fs.writeSync(out, `\n--- started ${new Date().toISOString()} ---\n`);

const child = spawn(process.execPath, [path.join(webDir, "scripts", "dev.mjs")], {
  cwd: webDir,
  detached: true,
  windowsHide: true,
  stdio: ["ignore", out, out],
  env: { ...process.env, PORT: String(port) },
});
child.unref();

for (let i = 0; i < 60; i++) {
  if (await isUp()) {
    console.log(`up on ${port} (pid ${child.pid}, no console attached)`);
    process.exit(0);
  }
  await sleep(500);
}
console.error(`started but nothing answered on ${port}; see ${logFile}`);
process.exit(1);
