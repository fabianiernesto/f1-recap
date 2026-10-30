"use client";

import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import type { Replay, Track } from "@/lib/types";
import { geometry, hex, pathTo, pointAt, progress } from "@/lib/replay";

/**
 * The race on the real track: 22 lights, each where the timing says it was.
 *
 * Drawn as the moodboard's cartography (a dark road, a fine dotted line,
 * numbered corners, the start line) with the leader's lap lit as a red trail.
 * The cars move imperatively, straight from the clock the game owns, so a
 * frame costs 22 attribute writes and no React render.
 */
export default function ReplayTrack({
  r, track, tRef, focus = [], ghost = null, dim = false, className = "",
}: {
  r: Replay;
  track: Track;
  tRef: MutableRefObject<number>;
  focus?: number[];
  ghost?: { num: number; shiftRef: MutableRefObject<number> } | null;
  dim?: boolean;
  className?: string;
}) {
  const g = useMemo(() => geometry(track), [track]);
  const box = useMemo(() => {
    const xs = track.points.map((p) => p[0]), ys = track.points.map((p) => p[1]);
    const pad = 46;
    const x0 = Math.min(...xs) - pad, y0 = Math.min(...ys) - pad;
    return `${x0} ${y0} ${Math.max(...xs) + pad - x0} ${Math.max(...ys) + pad - y0}`;
  }, [track]);
  const road = useMemo(() => "M " + track.points.map((p) => p.join(" ")).join(" L ") + " Z", [track]);
  const cars = useRef<(SVGGElement | null)[]>([]);
  const trail = useRef<SVGPathElement>(null);
  const trailGlow = useRef<SVGPathElement>(null);
  const ghostEl = useRef<SVGGElement>(null);
  const focusSet = useMemo(() => new Set(focus), [focus]);
  // the order to paint in: focused cars last, so they sit on top
  const field = useMemo(
    () => [...r.field].sort((a, b) => Number(focusSet.has(a.num)) - Number(focusSet.has(b.num))),
    [r.field, focusSet]
  );

  useEffect(() => {
    let raf = 0;
    // a race that is standing still (the cover, a frozen call, the result)
    // is drawn once, not sixty times a second
    let drawnT = NaN, drawnShift = NaN;
    const tick = () => {
      const t = tRef.current;
      const shift = ghost ? ghost.shiftRef.current : 0;
      if (t === drawnT && shift === drawnShift) { raf = requestAnimationFrame(tick); return; }
      drawnT = t; drawnShift = shift;
      let leadF = 0, leadLaps = -1;
      field.forEach((car, i) => {
        const el = cars.current[i];
        if (!el) return;
        const p = progress(car, t);
        const [x, y] = pointAt(g, p.f);
        const gone = car.out != null && p.done;
        el.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
        el.style.opacity = gone ? "0" : focusSet.size && !focusSet.has(car.num) ? "0.38" : "1";
        if (!gone && (p.laps > leadLaps || (p.laps === leadLaps && p.f > leadF))) { leadLaps = p.laps; leadF = p.f; }
      });
      const d = pathTo(g, Math.max(0, leadF));
      trail.current?.setAttribute("d", d);
      trailGlow.current?.setAttribute("d", d);
      if (ghost && ghostEl.current) {
        const car = r.field.find((c) => c.num === ghost.num);
        if (car) {
          const p = progress(car, t, ghost.shiftRef.current);
          const [x, y] = pointAt(g, p.f);
          ghostEl.current.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [field, g, tRef, ghost, r.field, focusSet]);

  const sf = track.points[0], nx = track.points[3];
  const ang = (Math.atan2(nx[1] - sf[1], nx[0] - sf[0]) * 180) / Math.PI;

  return (
    <svg className={`rt-svg${dim ? " is-dim" : ""} ${className}`} viewBox={box} preserveAspectRatio="xMidYMid meet" aria-hidden>
      <defs>
        <filter id="rt-glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="7" /></filter>
      </defs>
      <path d={road} fill="none" stroke="#1b1b1b" strokeWidth={30} strokeLinejoin="round" />
      <path d={road} fill="none" stroke="#ffffff55" strokeWidth={2.4} strokeDasharray="1 9" strokeLinecap="round" />
      <path ref={trailGlow} fill="none" stroke="#ff2415" strokeWidth={11} opacity={0.4} filter="url(#rt-glow)" />
      <path ref={trail} fill="none" stroke="#ff3b2a" strokeWidth={3} strokeLinecap="round" />
      {track.corners.map((c, i) => (
        <g key={c.label + i} className="rt-corner">
          <circle cx={c.x} cy={c.y} r={11} />
          <text x={c.x} y={c.y + 4}>{i + 1}</text>
        </g>
      ))}
      <rect x={sf[0] - 16} y={sf[1] - 4} width={32} height={8} fill="#fff" opacity={0.85}
        transform={`rotate(${ang + 90} ${sf[0]} ${sf[1]})`} />
      {field.map((car, i) => (
        <g key={car.num} ref={(el) => { cars.current[i] = el; }} className="rt-car">
          <circle r={18} fill={hex(car.colour)} opacity={0.32} filter="url(#rt-glow)" />
          <circle r={10} fill={hex(car.colour)} stroke="#000" strokeWidth={3} />
          {focusSet.has(car.num) && (
            <g className="rt-tag">
              <rect x={15} y={-13} width={52} height={22} rx={3} />
              <text x={41} y={3}>{car.code}</text>
            </g>
          )}
        </g>
      ))}
      {ghost && (
        <g ref={ghostEl} className="rt-ghost">
          <circle r={26} fill="#fff" opacity={0.26} filter="url(#rt-glow)" />
          <circle r={12} fill="none" stroke="#fff" strokeWidth={3} strokeDasharray="4 3" />
          <circle r={5} fill="#fff" />
          <g className="rt-ghost-tag"><rect x={-72} y={-13} width={58} height={22} rx={3} /><text x={-43} y={3}>YOU</text></g>
        </g>
      )}
    </svg>
  );
}
