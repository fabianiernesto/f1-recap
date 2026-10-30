// Renders chosen frames of the film for review, then a contact sheet.
// node scripts/stills.mjs <outdir> <frame|b<beat>> ...
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "node:path";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
const [outDir, ...spec] = process.argv.slice(2);
const BEAT = 60 / 110;
// "b<beat>" counts in scene beats (the film starts at beat 8, see src/time.ts)
const frames = spec.map((s) => (s.startsWith("b") ? Math.round((parseFloat(s.slice(1)) - 8) * BEAT * 60) : +s));
fs.mkdirSync(outDir, { recursive: true });
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), publicDir: path.resolve("public") });
const comp = await selectComposition({ serveUrl, id: "Showcase" });
const files = [];
for (const [i, frame] of frames.entries()) {
  const output = path.join(outDir, `${String(i).padStart(2, "0")}_f${frame}.png`);
  await renderStill({ composition: comp, serveUrl, frame, output, scale: 0.5 });
  files.push(output);
}
execFileSync("node", ["scripts/sheet.mjs", path.join(outDir, "sheet.png"), String(Math.min(6, files.length)), "270", "480", ...files]);
console.log("done", frames.join(","));
