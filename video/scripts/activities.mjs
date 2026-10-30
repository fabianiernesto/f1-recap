// The two activities the film draws (since 30/10/2026: Call the race and Paddock
// exchange), pulled from the project's own data for the film's race, with the
// season counts. Prices are worked out exactly as web/components/PaddockExchange.tsx
// works them out: the order when the leader crosses the line, last place worth 5,
// every place up worth 5 more, a retirement worth nothing.
//
//   node scripts/activities.mjs            writes src/activities.json
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve("..");
const D = path.join(ROOT, "data");
const SLUG = "silverstone-2026";
const r = JSON.parse(fs.readFileSync(path.join(D, SLUG, "replay_race.json"), "utf8"));
const N = r.field.length;

// web/lib/replay.ts, standings() and leaderAt()
const leaderAt = (lap) => {
  if (lap <= 0) return 0;
  let best = Infinity;
  for (const c of r.field) if (c.cross[lap] != null && c.cross[lap] < best) best = c.cross[lap];
  return best;
};
function standings(t) {
  const rows = r.field.map((car) => {
    const c = car.cross;
    let laps = 0;
    while (laps < c.length - 1 && c[laps + 1] <= t) laps++;
    const out = car.out != null && laps >= c.length - 1 && t > c[c.length - 1] + 20;
    return { car, laps, at: c[laps], out };
  });
  rows.sort((a, b) => (a.out === b.out ? 0 : a.out ? 1 : -1) || b.laps - a.laps || a.at - b.at);
  return rows;
}

// every driver's price, lap 0 (the grid) to the flag
const series = Object.fromEntries(r.field.map((c) => [c.num, []]));
[...r.field].sort((a, b) => (a.grid ?? 99) - (b.grid ?? 99)).forEach((c, i) => series[c.num].push((N - i) * 5));
for (let lap = 1; lap <= r.laps; lap++)
  standings(leaderAt(lap) + 0.001).forEach((x, i) => series[x.car.num].push(x.out ? 0 : (N - i) * 5));

const car = (code) => r.field.find((c) => c.code === code);
const pick = (code, role) => {
  const c = car(code);
  return { code, name: c.name, colour: c.colour, role, prices: series[c.num] };
};
// the three stories this race's market tells: the climb, the win, the crash
const exchange = {
  laps: r.laps,
  drivers: [pick("COL", "climb"), pick("LEC", "win"), pick("VER", "crash")],
};
const col = exchange.drivers[0].prices;
exchange.buy = { lap: 0, price: col[0] };
exchange.sell = { lap: r.laps, price: col[r.laps] };
exchange.verOut = car("VER").out;

// the call: six laps to go, who wins?
const call = r.calls.find((c) => c.kind === "finish");
const callOut = {
  lap: call.lap, reveal: call.reveal, q: call.q, ctx: call.ctx, why: call.why, answer: call.answer, laps: r.laps,
  neutral: r.neutral,
  options: call.options.map((o) => {
    const c = r.field.find((x) => String(x.num) === o.id);
    return { id: o.id, label: o.label, sub: o.sub ?? "", code: c?.code, colour: c?.colour ?? "888888", out: c?.out ?? null };
  }),
};

// the season: how many calls there are to make, how many races to trade
let calls = 0, markets = 0;
for (const slug of fs.readdirSync(D)) {
  for (const s of ["race", "sprint"]) {
    const f = path.join(D, slug, `replay_${s}.json`);
    if (!fs.existsSync(f)) continue;
    markets++;
    calls += JSON.parse(fs.readFileSync(f, "utf8")).calls.length;
  }
}

const out = { gp: "Silverstone", call: callOut, exchange, season: { calls, markets } };
fs.writeFileSync(path.resolve("src/activities.json"), JSON.stringify(out, null, 1));
console.log(JSON.stringify({ call: { q: callOut.q, options: callOut.options.map((o) => o.label), answer: callOut.answer },
  exchange: exchange.drivers.map((d) => `${d.code} ${d.prices[0]} -> ${d.prices.at(-1)}`), season: out.season }));
