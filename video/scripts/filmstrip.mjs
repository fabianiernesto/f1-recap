// Contact sheet of frames straight from the rendered MP4, decoded by Chrome.
// node scripts/filmstrip.mjs out.png cols startFrame endFrame step [video]
import { chromium } from "playwright-core";
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
const [out, cols, a, b, step, vid = "out/racing-simplified-9x16.mp4", fpsArg = "60"] = process.argv.slice(2);
const FPS_V = +fpsArg;
const frames = [];
for (let f = +a; f <= +b; f += +step) frames.push(f);
const W = 216, H = 384, C = +cols, R = Math.ceil(frames.length / C);
const html = `<body style="margin:0;background:#444"><video id=v src="${pathToFileURL(path.resolve(vid))}" muted></video><canvas id=c width=${C * (W + 4)} height=${R * (H + 18)}></canvas></body>`;
const f = path.join(os.tmpdir(), "strip.html");
fs.writeFileSync(f, html);
const br = await chromium.launch({ channel: "chrome" });
const pg = await br.newPage({ viewport: { width: C * (W + 4), height: R * (H + 18) } });
await pg.goto(pathToFileURL(f).href);
await pg.evaluate(async ({ frames, W, H, C, FPS_V }) => {
  const v = document.getElementById("v"), c = document.getElementById("c").getContext("2d");
  v.style.display = "none";
  await new Promise((r) => (v.readyState >= 1 ? r() : (v.onloadedmetadata = r)));
  for (const [i, fr] of frames.entries()) {
    await new Promise((r) => { v.onseeked = r; v.currentTime = (fr + 0.5) / FPS_V; });
    const x = (i % C) * (W + 4), y = Math.floor(i / C) * (H + 18);
    c.drawImage(v, x, y + 16, W, H);
    c.fillStyle = "#0f0"; c.font = "12px monospace"; c.fillText(`f${fr} b${(fr / FPS_V / (60 / 110)).toFixed(2)}`, x + 2, y + 12);
  }
}, { frames, W, H, C, FPS_V });
await pg.locator("canvas").screenshot({ path: out });
await br.close();
