import type { GhostSeat, Replay, Track } from "@/lib/types";
import { geometry, hex, leaderAt, pathTo, pointAt, progress, standings } from "@/lib/replay";

/**
 * The pictures on the two activity cards (since 24/10/2026), made from the
 * race itself instead of stock photographs: the moodboard shots read as
 * generated next to real data. Call the race shows this circuit with every car
 * where the timing put it on a lap of the race; the ghost shows the driver
 * with his ghost a step behind him.
 */
export function TrackArt({ r, track, lap }: { r: Replay; track: Track; lap: number }) {
  const g = geometry(track);
  const t = leaderAt(r, lap) + r.lapTime * 0.55;
  const xs = track.points.map((p) => p[0]), ys = track.points.map((p) => p[1]);
  const pad = 40;
  const x0 = Math.min(...xs) - pad, y0 = Math.min(...ys) - pad;
  const box = `${x0} ${y0} ${Math.max(...xs) + pad - x0} ${Math.max(...ys) + pad - y0}`;
  const road = "M " + track.points.map((p) => p.join(" ")).join(" L ") + " Z";
  let lead = 0, leadLaps = -1;
  const cars = r.field.map((c) => {
    const p = progress(c, t);
    if (!(c.out != null && p.done) && (p.laps > leadLaps || (p.laps === leadLaps && p.f > lead))) { leadLaps = p.laps; lead = p.f; }
    return { c, p, at: pointAt(g, p.f), gone: c.out != null && p.done };
  });
  return (
    <svg className="act-track" viewBox={box} preserveAspectRatio="xMidYMid meet" aria-hidden>
      <defs><filter id="act-glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="8" /></filter></defs>
      <path d={road} fill="none" stroke="#1c1c1c" strokeWidth={30} strokeLinejoin="round" />
      <path d={road} fill="none" stroke="#ffffff4d" strokeWidth={2.4} strokeDasharray="1 9" strokeLinecap="round" />
      <path d={pathTo(g, lead)} fill="none" stroke="#ff2415" strokeWidth={12} opacity={0.45} filter="url(#act-glow)" />
      <path d={pathTo(g, lead)} fill="none" stroke="#ff3b2a" strokeWidth={3} />
      {cars.filter((x) => !x.gone).map(({ c, at }) => (
        <g key={c.num} transform={`translate(${at[0].toFixed(1)} ${at[1].toFixed(1)})`}>
          <circle r={19} fill={hex(c.colour)} opacity={0.35} filter="url(#act-glow)" />
          <circle r={10} fill={hex(c.colour)} stroke="#000" strokeWidth={3} />
        </g>
      ))}
    </svg>
  );
}

export function GhostArt({ seat }: { seat: GhostSeat }) {
  const src = seat.headshot;
  return (
    <div className="act-ghost" style={{ ["--tc" as string]: hex(seat.colour) }} aria-hidden>
      <span className="act-ghost-num">{seat.number}</span>
      {src && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="act-ghost-copy" src={src} alt="" decoding="async" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="act-ghost-real" src={src} alt="" decoding="async" />
        </>
      )}
    </div>
  );
}

/**
 * The exchange card (since 26/10/2026): the market of this race as it really
 * moved. Three drivers' prices lap by lap, priced exactly as the game prices
 * them (his place: last is worth 5, every place up adds 5): the winner, the
 * driver who climbed the most, and the one whose shares went to nothing.
 */
export function ExchangeArt({ r }: { r: Replay }) {
  const N = r.field.length;
  const series = new Map<number, number[]>(r.field.map((c) => [c.num, []]));
  const grid = [...r.field].sort((a, b) => (a.grid ?? 99) - (b.grid ?? 99));
  grid.forEach((c, i) => series.get(c.num)!.push((N - i) * 5));
  for (let lap = 1; lap <= r.laps; lap++)
    standings(r, leaderAt(r, lap) + 0.001).forEach((x, i) => series.get(x.car.num)!.push(x.out ? 0 : (N - i) * 5));
  const fin = (n: number) => series.get(n)!.at(-1)!;
  const first = (n: number) => series.get(n)![0];
  const winner = r.field.reduce((a, b) => (fin(b.num) > fin(a.num) ? b : a));
  const climber = r.field.filter((c) => c.num !== winner.num && fin(c.num) > 0)
    .reduce<typeof winner | null>((a, b) => (!a || fin(b.num) - first(b.num) > fin(a.num) - first(a.num) ? b : a), null);
  const crash = r.field.filter((c) => fin(c.num) === 0)
    .reduce<typeof winner | null>((a, b) => (!a || first(b.num) > first(a.num) ? b : a), null);
  const picks = [crash, climber, winner].filter((c): c is typeof winner => !!c);
  const W = 400, H = 240, top = (N + 1) * 5;
  const x = (lap: number) => 14 + (lap / r.laps) * (W - 80);
  const y = (v: number) => 16 + (1 - v / top) * (H - 36);
  return (
    <svg className="act-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" aria-hidden>
      {[0.25, 0.5, 0.75, 1].map((k) => <line key={k} x1={14} x2={W - 66} y1={y(top * k)} y2={y(top * k)} stroke="#ffffff12" />)}
      {picks.map((c) => {
        const s = series.get(c.num)!;
        // a price only changes at the line, so it is drawn as steps
        const d = s.map((v, i) => (i ? `H ${x(i).toFixed(1)} V ${y(v).toFixed(1)}` : `M ${x(0)} ${y(v).toFixed(1)}`)).join(" ");
        const end = s.at(-1)!;
        return (
          <g key={c.num}>
            <path d={d} fill="none" stroke={hex(c.colour)} strokeWidth={3} strokeLinejoin="round" opacity={0.95} />
            <text x={x(r.laps) + 8} y={y(end) + 4} fill="#fff" fontSize={12} fontFamily="monospace" fontWeight={700}>{c.code} {end}</text>
          </g>
        );
      })}
    </svg>
  );
}
