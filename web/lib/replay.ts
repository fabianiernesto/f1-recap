/**
 * The race, replayable: the arithmetic under Call the race and The ghost.
 *
 * A car's position is its progress through the lap it is on, by time: if it
 * crossed the line 40s ago and that lap took 100s, it is 40% of the way
 * round. That is exactly what the timing says and nothing more, so every dot
 * sits where the real gaps put it. The first lap starts from the grid, a car
 * length a slot behind the line.
 */
import type { Replay, ReplayCar, Track } from "@/lib/types";

export type Geo = { pts: [number, number][]; cum: number[]; total: number };

export function geometry(track: Track): Geo {
  const pts = track.points;
  const cum = [0];
  for (let i = 1; i < pts.length; i++)
    cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, cum, total: cum[cum.length - 1] };
}

/** a point on the track, f in laps (0..1 wraps) */
export function pointAt(g: Geo, f: number): [number, number] {
  const d = (((f % 1) + 1) % 1) * g.total;
  let lo = 0, hi = g.cum.length - 1;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (g.cum[m] < d) lo = m + 1; else hi = m;
  }
  const i = Math.max(1, lo);
  const t = (d - g.cum[i - 1]) / ((g.cum[i] - g.cum[i - 1]) || 1);
  const a = g.pts[i - 1], b = g.pts[i];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/** the path of the track up to a fraction of the lap, for the lit trail */
export function pathTo(g: Geo, f: number): string {
  const n = Math.max(2, Math.round(g.pts.length * Math.min(1, Math.max(0, f))));
  return "M " + g.pts.slice(0, n).map((p) => p.join(" ")).join(" L ");
}

export const GRID_STEP = 0.0035;

/**
 * Where a car is at race time t: laps done plus the share of the current lap.
 * `shift` moves the car's whole timeline (the ghost runs ahead or behind).
 */
export function progress(car: ReplayCar, t: number, shift = 0): { laps: number; f: number; done: boolean } {
  const c = car.cross;
  const tt = t - shift;
  const last = c.length - 1;
  if (tt >= c[last]) return { laps: last, f: 0, done: true };
  let i = 0;
  while (i < last && c[i + 1] <= tt) i++;
  const p = (tt - c[i]) / (c[i + 1] - c[i] || 1);
  if (i === 0) {
    // off the grid: a slot's length behind the line, then catching up the lap
    const off = ((car.grid ?? 20) - 1) * GRID_STEP + 0.01;
    return { laps: 0, f: -off + (1 + off) * Math.max(0, p), done: false };
  }
  return { laps: i, f: p, done: false };
}

/**
 * The running order at time t, with gaps to the leader at the line. With
 * `capLap` it is the order at the end of that lap, once everybody has crossed
 * it: what a question asked on that lap quotes. A car that stops after it still
 * counts as running, so the order gives no retirement away.
 */
export function standings(r: Replay, t: number, capLap = Infinity) {
  const rows = r.field.map((car) => {
    const c = car.cross;
    const last = c.length - 1;
    let laps = 0;
    while (laps < last && laps < capLap && c[laps + 1] <= t) laps++;
    const out = car.out != null && laps >= last && last < capLap && t > c[last] + 20;
    return { car, laps, at: c[laps], out };
  });
  // before the leader's first crossing every car is on 0 laps at 0: the grid decides
  // (the field comes sorted by final place, and that must never show)
  rows.sort((a, b) => (a.out === b.out ? 0 : a.out ? 1 : -1) || b.laps - a.laps || a.at - b.at || (a.car.grid ?? 99) - (b.car.grid ?? 99));
  const lead = rows[0];
  return rows.map((x, i) => {
    const lc = lead.car.cross;
    const behind = lead.laps - x.laps;
    const gap = Math.max(0, behind === 0 ? x.at - lc[x.laps] : x.laps > 0 ? x.at - lc[x.laps] : 0);
    return { ...x, pos: i + 1, gap, lapped: behind > 1 || (behind === 1 && gap > 0 && x.laps < lead.laps - 0) ? behind : 0 };
  });
}

/**
 * Two faults of the feed that no car can have done, mended where the replay is
 * loaded. A crossing read late shows as a long lap and then an impossible one
 * (Suzuka, Lawson: 157s then 37s, P12 P22 P12): it goes halfway. A hole in the
 * first laps leaves invented crossings (Albert Park: laps of 20s): they spread
 * evenly up to the first real lap, so nobody seems to pass, and a call answered
 * in that stretch goes, because its answer came from them.
 */
export function mendCrossings(r: Replay): Replay {
  const laps = r.field.flatMap((c) => c.cross.slice(1).map((x, i) => x - c.cross[i])).sort((a, b) => a - b);
  const med = laps[laps.length >> 1] ?? 0;
  let hole = 0;
  for (const c of r.field) {
    let i = 1;
    while (i < c.cross.length && c.cross[i] - c.cross[i - 1] < med * 0.6) i++;
    hole = Math.max(hole, i - 1);
  }
  const field = r.field.map((c) => {
    const cross = [...c.cross];
    if (hole && cross.length > hole) for (let i = 1; i < hole; i++) cross[i] = Math.round((cross[hole] * i / hole) * 100) / 100;
    for (let i = 2; i < cross.length; i++) {
      const a = cross[i - 1] - cross[i - 2], b = cross[i] - cross[i - 1];
      if (a > med * 1.1 && b < med * 0.85 && a + b < med * 2.4) cross[i - 1] = Math.round(((cross[i - 2] + cross[i]) / 2) * 100) / 100;
    }
    return { ...c, cross };
  });
  return { ...r, field, calls: hole ? r.calls.filter((c) => c.reveal > hole) : r.calls };
}

/** the moment the leader crosses the line at the end of a lap */
export function leaderAt(r: Replay, lap: number): number {
  if (lap <= 0) return 0;
  let best = Infinity;
  for (const c of r.field) if (c.cross[lap] != null && c.cross[lap] < best) best = c.cross[lap];
  return best === Infinity ? r.field[0].cross[r.field[0].cross.length - 1] : best;
}

/**
 * When a call's answer shows: when its cars have crossed the line of that lap,
 * so the tower agrees with the toast. A car that stops never crosses it: the
 * moment the tower marks him out. The rest, when the leader gets there.
 */
export function revealAt(r: Replay, c: { reveal: number; cars?: number[] }): number {
  let t = leaderAt(r, c.reveal);
  for (const n of c.cars ?? []) {
    const x = r.field.find((f) => f.num === n)?.cross;
    if (x) t = Math.max(t, x[c.reveal] ?? x[x.length - 1] + 21);
  }
  return t;
}

/** the leader's lap at time t (1-based lap being run) */
export function lapAt(r: Replay, t: number): number {
  let lap = 0;
  for (let l = 1; l <= r.laps; l++) if (leaderAt(r, l) <= t) lap = l;
  return Math.min(r.laps, lap + 1);
}

export function hex(c: string, fallback = "#888"): string {
  const h = (c || "").replace("#", "");
  return /^[0-9a-f]{6}$/i.test(h) ? `#${h}` : fallback;
}
