// How hard the song hits on every beat of the film: the low end (kick and
// bass) measured on the soundtrack at each beat of the grid, 0..1.
// Writes src/beats.json: { strength: number[] } indexed by film beat.
import fs from "node:fs";
const SR = 48000, B = 60 / 110, START = 8;
const b = fs.readFileSync("public/music/soundtrack.wav").subarray(44);
const n = b.length / 4;
const mono = new Float32Array(n);
for (let i = 0; i < n; i++) mono[i] = (b.readInt16LE(i * 4) + b.readInt16LE(i * 4 + 2)) / 65536;
// one-pole low-pass at ~120 Hz
const lp = new Float32Array(n);
const a = 1 - Math.exp((-2 * Math.PI * 120) / SR);
for (let i = 1; i < n; i++) lp[i] = lp[i - 1] + a * (mono[i] - lp[i - 1]);
const rms = (t0, t1) => {
  let s = 0, c = 0;
  for (let i = Math.max(0, Math.round(t0 * SR)); i < Math.min(n, Math.round(t1 * SR)); i++) { s += lp[i] * lp[i]; c++; }
  return c ? Math.sqrt(s / c) : 0;
};
const strength = [];
for (let k = 0; k < 160; k++) {
  const t = (k - START) * B;
  // the hit against what came just before it
  const hit = rms(t, t + 0.09), before = rms(t - 0.18, t - 0.03);
  strength[k] = t < 0 ? 0 : Math.max(0, hit - before * 0.6);
}
const max = Math.max(...strength);
const out = strength.map((v) => +(v / max).toFixed(3));
fs.writeFileSync("src/beats.json", JSON.stringify({ strength: out }));
console.log(out.map((v, k) => `${k}:${v.toFixed(2)}`).join(" "));
