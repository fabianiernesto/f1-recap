// Measures how far the picture inside a region moves vertically from one
// frame to the next, by matching row profiles. A fluid scroll gives a smooth
// curve; a hitch shows as a sudden jump, a repeat as a zero in a run.
// node scripts/flow.mjs <video> <fromFrame> <toFrame> <x> <y> <w> <h> [fps]
import { chromium } from "playwright-core";
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
const [vid, a, b, x, y, w, h, fps = "60"] = process.argv.slice(2);
const f = path.join(os.tmpdir(), "flow.html");
fs.writeFileSync(f, `<video id=v src="${pathToFileURL(path.resolve(vid))}" muted></video><canvas id=c width=1080 height=1920></canvas>`);
const br = await chromium.launch({ channel: "chrome", args: ["--allow-file-access-from-files", "--disable-web-security"] });
const pg = await br.newPage();
await pg.goto(pathToFileURL(f).href);
const res = await pg.evaluate(async ([a, b, x, y, w, h, fps]) => {
  const v = document.getElementById("v"), c = document.getElementById("c").getContext("2d", { willReadFrequently: true });
  await new Promise((r) => (v.readyState >= 1 ? r() : (v.onloadedmetadata = r)));
  const prof = () => {
    const d = c.getImageData(x, y, w, h).data, p = new Float32Array(h);
    for (let r = 0; r < h; r++) { let s = 0; for (let q = 0; q < w; q += 2) { const i = (r * w + q) * 4; s += d[i] + d[i + 1] + d[i + 2]; } p[r] = s; }
    return p;
  };
  let prev = null; const out = [];
  for (let fr = a; fr <= b; fr++) {
    await new Promise((r) => { v.onseeked = r; v.currentTime = (fr + 0.5) / fps; });
    c.drawImage(v, 0, 0, 1080, 1920);
    const p = prof();
    if (prev) {
      let best = 0, bestErr = Infinity;
      for (let s = -90; s <= 90; s++) {
        let e = 0, n = 0;
        for (let r = 100; r < h - 100; r++) { const q = r + s; if (q < 0 || q >= h) continue; e += Math.abs(p[r] - prev[q]); n++; }
        e /= n; if (e < bestErr) { bestErr = e; best = s; }
      }
      out.push(best);
    }
    prev = p;
  }
  return out;
}, [+a, +b, +x, +y, +w, +h, +fps]);
// smoothness: largest change in speed between neighbouring frames, and repeats inside motion
let jerk = 0, stalls = 0;
for (let i = 1; i < res.length; i++) {
  jerk = Math.max(jerk, Math.abs(res[i] - res[i - 1]));
  if (res[i] === 0 && Math.abs(res[i - 1]) > 2 && Math.abs(res[i + 1] ?? 0) > 2) stalls++;
}
console.log(res.join(" "));
console.log(`max speed change between frames: ${jerk}px  ·  stalls inside motion: ${stalls}`);
await br.close();
