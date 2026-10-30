// Cuts the soundtrack on the song's own beat grid (110 BPM, beat 0 at 0.370s):
// song beats 8..128 (since 13/10/2026 the film is 16 beats longer and starts
// 16 beats earlier in the song, so film beat k is song beat k up to 128),
// crossfaded over one beat into beats 320..352 (the last full phrase) and its decay.
// Usage: node scripts/soundtrack.mjs <decoded 48k stereo s16 wav>
import fs from "node:fs";
const SR = 48000, CH = 2, B = 60 / 110, PH = 0.370;
const beat = (k) => PH + k * B;
const src = fs.readFileSync(process.argv[2]);
// find the data chunk
let off = 12, data = null;
while (off < src.length) {
  const id = src.toString("ascii", off, off + 4), len = src.readUInt32LE(off + 4);
  if (id === "data") { data = src.subarray(off + 8, off + 8 + len); break; }
  off += 8 + len;
}
const frames = data.length / 4;
const s = new Int16Array(data.buffer, data.byteOffset, frames * CH);
const at = (t) => Math.round(t * SR);
// since 13/10/2026 (second fix) the film starts on song beat 8, not 24, so
// it has 16 more beats with no repeat at all: a repeated phrase was heard as
// a jump wherever it went, because the song never loops exactly
const segs = [
  [at(beat(8)), at(beat(128))],
  [at(beat(320)), at(beat(320) + 27.0)], // the last phrase, then its decay
];
// one beat of equal-gain crossfade centred on each splice: the outgoing
// segment keeps playing half a beat past its end while the next comes in half
// a beat before its start, with both grids landing on the same output sample
const HALF = Math.round((B / 2) * SR);
const lens = segs.map(([x, y]) => y - x);
const starts = lens.map((_, i) => lens.slice(0, i).reduce((p, q) => p + q, 0));
const n0 = lens.reduce((p, q) => p + q, 0);
const mix = new Float32Array(n0 * CH);
const put = (from, to, dest, gain) => {
  for (let i = from; i < to; i++) {
    const d = dest + (i - from);
    if (d < 0 || d >= n0) continue;
    const g = gain(d);
    for (let c = 0; c < CH; c++) mix[d * CH + c] += s[i * CH + c] * g;
  }
};
// equal-gain ramp across a splice at output sample `at`: 0 -> 1 coming in
const ramp = (d, at) => Math.min(1, Math.max(0, (d - (at - HALF)) / (2 * HALF)));
segs.forEach(([x, y], k) => {
  const pre = k > 0 ? HALF : 0, post = k < segs.length - 1 ? HALF : 0;
  const inAt = starts[k], outAt = starts[k] + lens[k];
  put(x - pre, y + post, starts[k] - pre, (d) =>
    (k > 0 ? ramp(d, inAt) : 1) * (k < segs.length - 1 ? 1 - ramp(d, outAt) : 1));
});
const L1 = starts[1];
const o = new Int16Array(n0 * CH);
for (let i = 0; i < o.length; i++) o[i] = Math.max(-32768, Math.min(32767, Math.round(mix[i])));
// tail: 2.5 s fade at the very end; 40 ms fade-in at the very start
const fi = Math.round(0.04 * SR), fo = Math.round(2.5 * SR), n = o.length / CH;
for (let i = 0; i < n; i++) {
  let g = 1;
  if (i < fi) g = i / fi;
  if (n - i < fo) g = Math.min(g, ((n - i) / fo) ** 1.6);
  if (g < 1) for (let c = 0; c < CH; c++) o[i * CH + c] = Math.round(o[i * CH + c] * g);
}
const hdr = Buffer.alloc(44);
hdr.write("RIFF", 0); hdr.writeUInt32LE(36 + o.byteLength, 4); hdr.write("WAVE", 8);
hdr.write("fmt ", 12); hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(CH, 22);
hdr.writeUInt32LE(SR, 24); hdr.writeUInt32LE(SR * CH * 2, 28); hdr.writeUInt16LE(CH * 2, 32); hdr.writeUInt16LE(16, 34);
hdr.write("data", 36); hdr.writeUInt32LE(o.byteLength, 40);
fs.writeFileSync("public/music/soundtrack.wav", Buffer.concat([hdr, Buffer.from(o.buffer)]));
console.log("soundtrack", (n / SR).toFixed(3), "s; splices at", starts.slice(1).map((v) => (v / SR).toFixed(4)).join(", "), "s, 1-beat crossfades");
