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

/** the running order at time t, with gaps to the leader at the line */
export function standings(r: Replay, t: number) {
  const rows = r.field.map((car) => {
    const c = car.cross;
    let laps = 0;
    while (laps < c.length - 1 && c[laps + 1] <= t) laps++;
    const out = car.out != null && laps >= c.length - 1 && t > c[c.length - 1] + 20;
    return { car, laps, at: c[laps], out };
  });
  rows.sort((a, b) => (a.out === b.out ? 0 : a.out ? 1 : -1) || b.laps - a.laps || a.at - b.at);
  const lead = rows[0];
  return rows.map((x, i) => {
    const lc = lead.car.cross;
    const behind = lead.laps - x.laps;
    const gap = behind === 0 ? x.at - lc[x.laps] : x.laps > 0 ? x.at - lc[x.laps] : 0;
    return { ...x, pos: i + 1, gap, lapped: behind > 1 || (behind === 1 && gap > 0 && x.laps < lead.laps - 0) ? behind : 0 };
  });
}

/** the moment the leader crosses the line at the end of a lap */
export function leaderAt(r: Replay, lap: number): number {
  if (lap <= 0) return 0;
  let best = Infinity;
  for (const c of r.field) if (c.cross[lap] != null && c.cross[lap] < best) best = c.cross[lap];
  return best === Infinity ? r.field[0].cross[r.field[0].cross.length - 1] : best;
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
