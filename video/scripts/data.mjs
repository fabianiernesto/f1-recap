// Pulls what the video draws from the project's own data: every circuit's
// real track shape, its winner and margin, and the season totals.
import fs from "node:fs";
import path from "node:path";
const ROOT = path.resolve("..");
const D = path.join(ROOT, "data");
const gps = [];
let cards = 0, interactive = 0, blindRounds = 0, pitwalls = 0, laps = 0, passes = 0, stops = 0;
for (const slug of fs.readdirSync(D)) {
  const dir = path.join(D, slug);
  if (!fs.existsSync(path.join(dir, "weekend.json"))) continue;
  const w = JSON.parse(fs.readFileSync(path.join(dir, "weekend.json"), "utf8"));
  const t = JSON.parse(fs.readFileSync(path.join(dir, "track.json"), "utf8"));
  // keep ~240 points, enough for a smooth line at 1080px
  const step = Math.max(1, Math.floor(t.points.length / 240));
  const pts = t.points.filter((_, i) => i % step === 0).map(([x, y]) => [Math.round(x), Math.round(y)]);
  const f = w.facts || {};
  laps += f.laps ?? 0; passes += f.passes ?? 0; stops += f.stops ?? 0;
  gps.push({
    slug, circuit: w.circuit, short: w.short, country: w.country, date: w.date, laps: w.laps,
    winner: f.winner ? `${f.winner.first} ${f.winner.last}` : null, last: f.winner?.last ?? null,
    team: f.winner?.team ?? null, colour: f.winner?.colour ?? null, margin: f.margin ?? null,
    view: t.view, pts,
  });
  for (const file of fs.readdirSync(dir)) {
    if (/^story_.*\.json$/.test(file)) {
      const s = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
      cards += s.cards.length;
      interactive += s.cards.filter((c) => ["prediction", "decision", "guess"].includes(c.type)).length;
    }
    if (/^blind_.*\.json$/.test(file)) {
      const b = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
      blindRounds += (b.rounds || b).length || 0;
    }
    if (/^pitwall_.*\.json$/.test(file)) pitwalls++;
  }
}
const ms = (d) => Date.parse(d.replace(/(\d+) (\w+) (\d+)/, "$2 $1 $3"));
gps.sort((a, b) => ms(a.date) - ms(b.date));
const py = fs.readdirSync(path.join(ROOT, "pipeline")).filter((f) => f.endsWith(".py"))
  .reduce((n, f) => n + fs.readFileSync(path.join(ROOT, "pipeline", f), "utf8").split("\n").length, 0);
const cache = fs.existsSync(path.join(ROOT, "pipeline", "cache"))
  ? fs.readdirSync(path.join(ROOT, "pipeline", "cache"), { recursive: true }).filter((f) => String(f).endsWith(".json")).length : 0;
// the site's animations: every distinct @keyframes in its stylesheet (35 on 13/10, 52 on 30/10)
const css = fs.readFileSync(path.join(ROOT, "web", "app", "globals.css"), "utf8");
const animations = new Set([...css.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1])).size;
const totals = { gps: gps.length, cards, interactive, laps, passes, stops, animations, blindRounds, pitwalls, pythonLines: py, cacheJson: cache };
fs.writeFileSync(path.resolve("src/data.json"), JSON.stringify({ gps, totals }));
console.log(totals);
console.log(gps.map((g) => `${g.date} ${g.circuit} ${g.last} ${g.margin} ${g.colour}`).join("\n"));
