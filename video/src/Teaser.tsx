/**
 * Launch teaser (16/11/2026), 1080 x 1350, for the LinkedIn hype posts.
 *
 * The build of "Rush" (Micka Luna, 114 BPM) carries the car from the film's
 * opening up the frame while a countdown runs with the music (103 days
 * of building since 7 August, down to the days left) and the 20 circuits of the season flash past behind it, one per
 * beat, then two per beat in the climb. On the drop the car crosses the frame
 * and the countdown lands solid: the days left until Racing Simplified goes live. Then the season in figures, one
 * idea per screen and every figure from the data: 1,345 moments, then
 * passes, pit stops, race laps and the two games one a hit, 20 Grands Prix. It ends on the name and the day, and the song
 * fades out.
 *
 * Audio: public/music/teaser-rush.wav, the song cut from its first sound
 * (1.9 s into the file). Teaser beat b falls at B0 + b * BEAT seconds:
 * bass on beat 9, the climb from 17, the drop on 24. Data: src/teaser.json
 * (scripts/teaser_data.py).
 */
import React from "react";
import { AbsoluteFill, Easing, Html5Audio, Img, interpolate, random, staticFile, useCurrentFrame } from "remotion";
import { BODY, C, GLOW, MONO, WIDE, clamp, out } from "./kit";
import data from "./teaser.json";

type G = { circuit: string; date: string; moments: number; pts: number[][] };
export const GPS = data.gps as G[];

export const TEASER_FPS = 60;
export const BEAT = 60 / 114;
export const B0 = 0.041;
/** frame of a teaser beat */
export const fb = (b: number) => (B0 + b * BEAT) * TEASER_FPS;
export const BASS = 9;
export const CLIMB = 17;
export const DROP = 24;
/** the screens after the drop, by beat */
const S = { lap: 24, moments: 32, numbers: 40, season: 52, end: 58, fade: 56, out: 70 };
export const TEASER_END = Math.round(fb(S.out));

/** days: days since 7 August, the day building began, on the day it is posted; total: the same count on launch day */
export type TeaserProps = {
  days: number; total: number; headline: string; live: string; day: string; line: string;
  launch: string; tagline: string; soon: string; when: string;
};
/** posted Wednesday 18/11/2026 at 11:00 (moved from Tuesday, his call, 17/11); launch Wednesday 25/11 */
export const TEASER_PROPS: TeaserProps = {
  days: 103, total: 110, headline: "Until Racing Simplified", live: "goes live", day: "Wed 18.11",
  line: "Built one night at a time since 7 August.", launch: "Live 25 Nov",
  tagline: "The website that explains every F1 race,\nand lets you play it.",
  soon: "In 7 days", when: "Wednesday 25.11",
};

/* ---------- helpers ---------- */
export const ring = (f: number, hits: number[], decay: number) => {
  let v = 0;
  for (const h of hits) if (f >= h) v = Math.max(v, Math.exp(-(f - h) / decay));
  return v;
};
export const beats = (a: number, b: number, step = 1) => {
  const r: number[] = [];
  for (let k = a; k < b - 1e-6; k += step) r.push(fb(k));
  return r;
};
/** rises into place from just below, sharp as soon as it lands */
export const enter = (f: number, at: number, dist = 46): React.CSSProperties => {
  const p = interpolate(f, [at, at + 14], [0, 1], { ...clamp, easing: out });
  return { opacity: p, transform: `translateY(${(1 - p) * dist}px)`, filter: p < 1 ? `blur(${(1 - p) * 4}px)` : undefined };
};
export const pad3 = (n: number) => String(n).padStart(3, "0");

/** a circuit outline in its own box */
export const TrackLine: React.FC<{ g: G; draw: number; width: number; color: string; glow?: boolean; style?: React.CSSProperties }> = ({
  g, draw, width, color, glow = true, style,
}) => {
  const xs = g.pts.map((p) => p[0]), ys = g.pts.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const pad = 20;
  const d = g.pts.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ") + " Z";
  return (
    <svg viewBox={`${x0 - pad} ${y0 - pad} ${x1 - x0 + pad * 2} ${y1 - y0 + pad * 2}`} preserveAspectRatio="xMidYMid meet" style={{ overflow: "visible", ...style }}>
      <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinejoin="round" strokeLinecap="round"
        pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} vectorEffect="non-scaling-stroke"
        style={glow ? { filter: `drop-shadow(0 0 ${width * 2}px ${color}) drop-shadow(0 0 ${width * 6}px ${color}88)` } : undefined} />
    </svg>
  );
};

/* ---------- speed: lines falling past ---------- */
export const Streaks: React.FC<{ f: number; amount: number; w?: number; h?: number }> = ({ f, amount, w = 1080, h = 1350 }) => {
  if (amount <= 0) return null;
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {Array.from({ length: 22 }, (_, i) => {
        const len = 200 + random(`t${i}`) * 700 * (0.4 + amount);
        const speed = (14 + random(`v${i}`) * 18) * (0.3 + amount * 2.2);
        const travel = h + len * 2;
        const pos = ((f * speed + random(`o${i}`) * travel) % travel) - len;
        if (random(`n${i}`) > 0.2 + amount * 0.8) return null;
        return (
          <div key={i} style={{
            position: "absolute", left: 30 + random(`x${i}`) * (w - 60), top: pos, width: i % 3 ? 2 : 3, height: len,
            background: `linear-gradient(180deg, transparent, ${C.lit} 55%, #ffd2c8 90%, transparent)`,
            boxShadow: `0 0 24px ${C.lit}`, opacity: 0.3 + amount * 0.6, filter: "blur(1px)",
          }} />
        );
      })}
    </AbsoluteFill>
  );
};

/* ---------- the car, with its smear dragging behind ---------- */
export const CAR_H = 1000;
export const carTop = (f: number) => {
  if (f < fb(BASS)) return interpolate(f, [0, fb(BASS)], [1180, 1090], { ...clamp, easing: Easing.inOut(Easing.sin) });
  const stepAt = (i: number) => 26 + i * 9;
  if (f < fb(CLIMB)) {
    let y = 1090;
    for (let k = BASS; k < CLIMB; k++) y -= stepAt(k - BASS) * interpolate(f, [fb(k), fb(k) + 9], [0, 1], { ...clamp, easing: out });
    return y;
  }
  const yClimb = 1090 - Array.from({ length: CLIMB - BASS }, (_, i) => stepAt(i)).reduce((a, b) => a + b, 0);
  if (f < fb(DROP)) return interpolate(f, [fb(CLIMB), fb(DROP)], [yClimb, 260], { ...clamp, easing: Easing.in(Easing.quad) });
  return interpolate(f, [fb(DROP), fb(DROP) + 9], [260, -CAR_H - 700], { ...clamp, easing: Easing.in(Easing.quad) });
};
export const Car: React.FC<{ top: number; drag: number; blur: number; opacity?: number }> = ({ top, drag, blur, opacity = 1 }) => {
  const s = staticFile("img/car-top-alpha.png");
  const box: React.CSSProperties = { position: "absolute", left: 190, width: 700, top, height: CAR_H, opacity };
  return (
    <div style={{ ...box, filter: blur > 0.5 ? `blur(${blur}px)` : undefined }}>
      <Img src={s} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain",
        filter: "blur(40px) saturate(1.35) brightness(1.1)", opacity: 0.6,
        transform: `translateY(${drag * 100}%) scaleY(${1 + drag * 1.4})` }} />
      <Img src={s} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} />
    </div>
  );
};

/* ---------- the build: the counter and the season flashing past ---------- */
/** when each circuit flashes: one a beat with the bass, two a beat in the climb, then one empty beat before the drop */
export const trackAt = (i: number) => (i < 8 ? fb(BASS + i) : fb(CLIMB + (i - 8) * 0.5));
const Build: React.FC<{ f: number; p: TeaserProps }> = ({ f, p }) => {
  const d = fb(DROP);
  if (f >= d) return null;
  // counts down to launch with the music: from the whole build to the days left
  const left = p.total - p.days;
  const n = p.total - Math.floor((p.total - left) * Math.pow(Math.min(1, f / d), 2.1));
  const lit = interpolate(f, [0, fb(BASS)], [0.1, 0.22], clamp);
  let cur = -1;
  for (let i = 0; i < GPS.length; i++) if (f >= trackAt(i)) cur = i;
  const g = cur >= 0 ? GPS[cur] : null;
  const t0 = cur >= 0 ? trackAt(cur) : 0;
  const t1 = cur >= 0 && cur < GPS.length - 1 ? trackAt(cur + 1) : fb(DROP - 1);
  const draw = interpolate(f, [t0, t0 + Math.min(16, (t1 - t0) * 0.7)], [0, 1], { ...clamp, easing: out });
  const fade = interpolate(f, [t1 - 5, t1], [1, 0], clamp);
  return (
    <>
      {g && (
        <AbsoluteFill style={{ opacity: fade * 0.75 }}>
          <TrackLine g={g} draw={draw} width={3} color={C.lit} style={{ position: "absolute", left: 120, top: 330, width: 840, height: 760 }} />
        </AbsoluteFill>
      )}
      <div style={{ position: "absolute", left: 80, top: 280 }}>
        <div style={{ ...MONO, fontSize: 17, color: C.muted, marginBottom: 26, opacity: 0.8 }}>Days to launch</div>
        <div style={{ ...WIDE, fontSize: 214, color: "transparent", WebkitTextStroke: `2px rgba(255,255,255,${lit})` }}>{pad3(n)}</div>
      </div>
      {g && (
        <div style={{ position: "absolute", left: 80, bottom: 96, display: "flex", gap: 28, ...MONO, fontSize: 17, opacity: fade }}>
          <span style={{ color: C.brand }}>{String(cur + 1).padStart(2, "0")} / 20</span>
          <span style={{ color: "#ffffffb3" }}>{g.circuit}</span>
        </div>
      )}
    </>
  );
};

/* ---------- after the drop: one centred system for every screen (17/11) ----------
 * Every screen is symmetric about the centre line: a kicker in mono, one big
 * figure, its words under it, then the supporting line. The header (name and
 * date) stays put from the drop to the end instead of coming and going. */
const CX: React.CSSProperties = { position: "absolute", left: 80, right: 80, textAlign: "center" };
const KICK: React.CSSProperties = { ...MONO, fontSize: 18, color: C.muted };
/** the biggest a figure can be and still sit inside the margins */
const fitSize = (txt: string, cap: number) => Math.min(cap, 900 / (txt.length * 0.86));
const Rule: React.FC<{ f: number; at: number; top: number }> = ({ f, at, top }) => {
  const w = interpolate(f, [at, at + 16], [0, 1], { ...clamp, easing: out });
  return <div style={{ position: "absolute", top, left: "50%", width: 120 * w, height: 3, marginLeft: -60 * w, background: C.brand, boxShadow: `0 0 12px ${C.brand}` }} />;
};

/* ---------- 1: the days left ---------- */
const Lap: React.FC<{ f: number; p: TeaserProps }> = ({ f, p }) => {
  const d = fb(DROP);
  const slam = interpolate(f, [d + 3, d + 13], [0, 1], { ...clamp, easing: out });
  const bar = interpolate(f, [fb(S.lap + 4), fb(S.lap + 6)], [0, p.days / p.total], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  return (
    <AbsoluteFill>
      <div style={{ ...CX, top: 210, ...KICK, ...enter(f, d + 4, 0) }}>Days to launch</div>
      <div style={{ ...CX, top: 250, ...WIDE, fontSize: 420, lineHeight: 1, color: "#fff", textShadow: "0 0 60px #e1060055",
        transform: `scale(${1.15 - 0.15 * slam})`, transformOrigin: "50% 60%", filter: slam < 1 ? `blur(${(1 - slam) * 12}px)` : undefined, opacity: Math.min(1, slam * 2) }}>
        {p.total - p.days}
      </div>
      <div style={{ ...CX, top: 655, ...WIDE, fontSize: 72, color: "#fff", ...enter(f, fb(S.lap + 1), 30) }}>Days</div>
      <Rule f={f} at={fb(S.lap + 1.5)} top={770} />
      <div style={{ ...CX, top: 810, whiteSpace: "nowrap", ...enter(f, fb(S.lap + 2)) }}>
        <div style={{ ...WIDE, fontSize: 40, color: "#fff" }}>{p.headline}</div>
        <div style={{ ...WIDE, fontSize: 72, marginTop: 14, ...GLOW }}>{p.live}</div>
      </div>
      <div style={{ ...CX, top: 1010, ...BODY, fontSize: 32, color: "#cfcfcf", ...enter(f, fb(S.lap + 3)) }}>{p.line}</div>
      <div style={{ position: "absolute", left: 80, right: 80, bottom: 150, height: 4, background: "#262626", ...enter(f, fb(S.lap + 3.5), 0) }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${bar * 100}%`, background: "#fff" }}>
          <div style={{ position: "absolute", right: -2, top: -9, width: 4, height: 22, background: C.brand, boxShadow: `0 0 14px ${C.brand}, 0 0 30px ${C.brand}aa`, opacity: bar > 0 ? 1 : 0 }} />
        </div>
      </div>
      <div style={{ position: "absolute", left: 80, right: 80, bottom: 96, display: "flex", justifyContent: "space-between", ...MONO, fontSize: 17, color: C.muted, ...enter(f, fb(S.lap + 3.5), 0) }}>
        <span>07 Aug</span><span style={{ color: C.brand }}>{p.launch}</span>
      </div>
    </AbsoluteFill>
  );
};

/* ---------- 2: 1,345 moments, one tick each, by Grand Prix ---------- */
const Moments: React.FC<{ f: number }> = ({ f }) => {
  const a = fb(S.moments);
  const max = Math.max(...GPS.map((g) => g.moments));
  const count = Math.round(interpolate(f, [a + 2, fb(S.moments + 4)], [0, data.moments], { ...clamp, easing: Easing.out(Easing.cubic) }));
  const txt = data.moments.toLocaleString("en-US");
  const H = 430;
  return (
    <AbsoluteFill>
      <div style={{ ...CX, top: 210, ...KICK, ...enter(f, a, 0) }}>The 2026 season</div>
      <div style={{ ...CX, top: 255, ...WIDE, fontSize: fitSize(txt, 260), lineHeight: 1, color: "#fff", textShadow: "0 0 50px #e1060066", ...enter(f, a, 30) }}>{count.toLocaleString("en-US")}</div>
      <div style={{ ...CX, top: 500, ...WIDE, fontSize: 56, ...GLOW, ...enter(f, fb(S.moments + 0.5), 30) }}>Moments</div>
      <div style={{ ...CX, top: 600, ...BODY, fontSize: 32, lineHeight: 1.4, color: "#cfcfcf", ...enter(f, fb(S.moments + 1)) }}>
        Each one explained from the official timing data.
      </div>
      <div style={{ position: "absolute", left: 80, right: 80, bottom: 200, height: H, display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        {GPS.map((g, i) => {
          const grow = interpolate(f, [a + 6 + i * 3, a + 30 + i * 3], [0, 1], { ...clamp, easing: Easing.out(Easing.quad) });
          const last = i === GPS.length - 1;
          return (
            <div key={g.circuit} style={{ width: 30, height: (g.moments / max) * H * grow, overflow: "hidden", display: "flex", flexDirection: "column-reverse" }}>
              <div style={{ flex: "none", height: (g.moments / max) * H, background: `repeating-linear-gradient(0deg, ${last ? C.brand : "#ffffff3a"} 0 3px, transparent 3px 6.3px)`, boxShadow: last ? `0 0 16px ${C.brand}88` : undefined }} />
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", left: 80, right: 80, bottom: 150, display: "flex", justifyContent: "space-between", ...MONO, fontSize: 17, color: C.muted, ...enter(f, fb(S.moments + 2), 0) }}>
        <span>Albert Park</span><span style={{ color: C.brand }}>Interlagos</span>
      </div>
      <div style={{ ...CX, bottom: 96, ...MONO, fontSize: 17, color: "#ffffffb3", ...enter(f, fb(S.moments + 2), 0) }}>One line for every moment</div>
    </AbsoluteFill>
  );
};

/* ---------- 3: the season in figures, one a hit, counting up ---------- */
// from the site's own totals (the facts in web/data/<slug>/weekend.json, 16/11/2026)
const FIGS: { n: number; label: string; red?: boolean }[] = [
  { n: 963, label: "Passes on track" },
  { n: 687, label: "Pit stops" },
  { n: 1221, label: "Race laps" },
  { n: 2, label: "Games built from the real races", red: true },
];
const FIG_BEATS = 3;
const Numbers: React.FC<{ f: number }> = ({ f }) => {
  const i = Math.min(FIGS.length - 1, Math.floor((f - fb(S.numbers)) / (fb(S.numbers + FIG_BEATS) - fb(S.numbers))));
  const fig = FIGS[i];
  const a = fb(S.numbers + i * FIG_BEATS);
  const slam = interpolate(f, [a, a + 10], [0, 1], { ...clamp, easing: out });
  const n = Math.round(interpolate(f, [a, a + 22], [0, fig.n], { ...clamp, easing: Easing.out(Easing.cubic) }));
  const txt = fig.n.toLocaleString("en-US");
  return (
    <AbsoluteFill>
      <div style={{ ...CX, top: 210, ...KICK }}>The 2026 season</div>
      <div style={{ ...CX, top: 380, height: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{
          ...WIDE, fontSize: fitSize(txt, 340), lineHeight: 1, whiteSpace: "nowrap",
          ...(fig.red ? GLOW : { color: "#fff", textShadow: "0 0 50px #e1060066" }),
          transform: `scale(${1.2 - 0.2 * slam})`, transformOrigin: "50% 60%",
          filter: slam < 1 ? `blur(${(1 - slam) * 14}px)` : undefined, opacity: Math.min(1, slam * 2),
        }}>{n.toLocaleString("en-US")}</div>
      </div>
      <Rule f={f} at={a + 4} top={715} />
      <div style={{ ...CX, top: 750, ...WIDE, fontSize: fig.label.length > 20 ? 44 : 60, lineHeight: 1.15, textWrap: "balance", color: fig.red ? "#fff" : C.lit, ...(fig.red ? {} : { textShadow: GLOW.textShadow }), ...enter(f, a + 6, 30) }}>{fig.label}</div>
      <div style={{ position: "absolute", left: 80, right: 80, bottom: 150, height: 4, display: "flex", gap: 10 }}>
        {FIGS.map((_, k) => (
          <div key={k} style={{ flex: 1, background: k < i ? "#ffffff66" : k === i ? C.brand : "#262626", boxShadow: k === i ? `0 0 14px ${C.brand}` : undefined }} />
        ))}
      </div>
      <div style={{ ...CX, bottom: 96, ...MONO, fontSize: 17, color: C.muted }}>Every figure from the official timing data</div>
    </AbsoluteFill>
  );
};

/* ---------- 4: 20 Grands Prix ---------- */
const Season: React.FC<{ f: number }> = ({ f }) => {
  const a = fb(S.season);
  return (
    <AbsoluteFill>
      <div style={{ ...CX, top: 210, ...KICK, ...enter(f, a, 0) }}>From Albert Park to Interlagos</div>
      <div style={{ ...CX, top: 255, ...WIDE, fontSize: 220, lineHeight: 1, color: "#fff", textShadow: "0 0 50px #e1060066", ...enter(f, a, 30) }}>20</div>
      <div style={{ ...CX, top: 485, ...WIDE, fontSize: 56, ...GLOW, ...enter(f, fb(S.season + 0.5), 30) }}>Grands Prix</div>
      <div style={{ position: "absolute", left: 110, right: 110, top: 620, height: 520, display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gridTemplateRows: "repeat(4, minmax(0, 1fr))", gap: 30 }}>
        {GPS.map((g, i) => {
          const draw = interpolate(f, [a + 4 + i * 2.2, a + 22 + i * 2.2], [0, 1], { ...clamp, easing: out });
          const last = i === GPS.length - 1;
          return (
            <div key={g.circuit} style={{ position: "relative", minWidth: 0, minHeight: 0 }}>
              <TrackLine g={g} draw={draw} width={last ? 3 : 2} color={last ? C.lit : "#ffffffaa"} glow={last} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
            </div>
          );
        })}
      </div>
      <div style={{ ...CX, bottom: 96, ...MONO, fontSize: 17, color: C.muted, ...enter(f, fb(S.season + 2), 0) }}>Every session of every weekend</div>
    </AbsoluteFill>
  );
};

/* ---------- 5: the name and the day ---------- */
const End: React.FC<{ f: number; p: TeaserProps }> = ({ f, p }) => {
  const a = fb(S.end);
  const carY = interpolate(f, [a, a + 26], [1400, -1900], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  return (
    <AbsoluteFill>
      {f < a + 30 && <Car top={carY} drag={0.4} blur={2} opacity={0.85} />}
      <div style={{ ...CX, top: 380, whiteSpace: "nowrap" }}>
        <div style={{ ...WIDE, fontSize: 92, color: "#fff", ...enter(f, a + 8) }}>Every race</div>
        <div style={{ ...WIDE, fontSize: 92, ...GLOW, ...enter(f, fb(S.end + 1)) }}>Simplified</div>
      </div>
      <Rule f={f} at={fb(S.end + 1.5)} top={600} />
      <div style={{ ...CX, top: 640, whiteSpace: "pre-line", ...BODY, fontSize: 34, lineHeight: 1.4, color: "#d6d6d6", ...enter(f, fb(S.end + 2)) }}>{p.tagline}</div>
      {/* the sign-off sits where every other screen keeps its footer (17/11: "el texto abajo no queda bien") */}
      <div style={{ ...CX, bottom: 150, ...WIDE, fontSize: 64, lineHeight: 1, whiteSpace: "nowrap", color: "#fff", ...enter(f, fb(S.end + 3)) }}>
        <span style={GLOW}>Live</span> {p.soon.toLowerCase()}
      </div>
      <div style={{ ...CX, bottom: 96, ...MONO, fontSize: 18, color: C.brand, ...enter(f, fb(S.end + 3.5), 0) }}>{p.when}</div>
    </AbsoluteFill>
  );
};

/** the name and the date, fixed from the drop to the last frame */
const Header: React.FC<{ f: number; p: TeaserProps }> = ({ f, p }) => (
  <div style={{ position: "absolute", top: 72, left: 80, right: 80, display: "flex", justifyContent: "space-between", ...MONO, fontSize: 17, color: "#ffffffb3", ...enter(f, fb(DROP) + 6, 0) }}>
    <span>Racing Simplified</span><span style={{ color: C.brand }}>{p.day}</span>
  </div>
);

/* ---------- the film ---------- */
export const Teaser: React.FC<TeaserProps> = (p) => {
  const f = useCurrentFrame();
  const d = fb(DROP);
  const cuts = [fb(S.moments), fb(S.numbers), fb(S.season), fb(S.end)];
  // a knock on every new figure
  const knocks = [1, 2, 3].map((k) => fb(S.numbers + k * FIG_BEATS));
  // build flashes: one on the bass, every other beat after it, every beat in the climb, twice a beat at the end
  const hits = [fb(BASS), ...beats(BASS + 2, CLIMB, 2), ...beats(CLIMB, DROP - 2), ...beats(DROP - 2, DROP, 0.5)];
  const flash = f < d ? ring(f, hits, 7) * interpolate(f, [fb(BASS), d], [0.25, 0.5], clamp) + ring(f, [fb(BASS)], 12) * 0.6 : ring(f, cuts, 7) * 0.35 + ring(f, knocks, 7) * 0.25;
  const big = ring(f, [d], 6);
  // shake grows with the climb, peaks on the drop, a knock on every cut
  const amp = (f < d ? interpolate(f, [fb(CLIMB), d], [2, 9], clamp) + ring(f, hits, 6) * 5 : 0) + ring(f, [d], 10) * 22 + ring(f, cuts, 6) * 8 + ring(f, knocks, 6) * 7;
  const sx = (random(`sx${f}`) - 0.5) * 2 * amp;
  const sy = (random(`sy${f}`) - 0.5) * 2 * amp;
  const breathe = 0.5 + 0.5 * Math.sin((f / TEASER_FPS) * Math.PI * 2 * (114 / 60 / 4));
  const glow = f < d ? interpolate(f, [0, fb(BASS), d], [0.4, 0.55, 1], clamp) * (0.75 + 0.25 * breathe) : interpolate(f, [d, d + 30], [0.6, 0], clamp);
  const top = carTop(f);
  const drag = f < fb(BASS) ? 0.06 : f < fb(CLIMB) ? 0.14 : f < d ? 0.24 : 0.5;
  const carBlur = interpolate(f, [0, fb(BASS)], [10, 0], clamp);
  const streak = f < d ? interpolate(f, [fb(BASS), fb(CLIMB), d], [0, 0.45, 1], clamp) : interpolate(f, [d, d + 40], [1, 0.12], clamp);
  // a blade of light across every cut
  const lastCut = [...cuts].reverse().find((c) => f >= c);
  const blade = lastCut !== undefined ? interpolate(f, [lastCut, lastCut + 8], [0, 1], clamp) : 1;
  const end = interpolate(f, [TEASER_END - 40, TEASER_END - 1], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ background: C.night, overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `translate(${sx}px, ${sy}px)` }}>
        <AbsoluteFill style={{ background: `radial-gradient(ellipse 70% 45% at 50% ${Math.min(100, (top + CAR_H * 0.5) / 13.5)}%, #e10600 0%, #5a0805 35%, transparent 75%)`, opacity: glow * 0.55 }} />
        <Streaks f={f} amount={streak} />
        <Build f={f} p={p} />
        {f < d + 12 && <Car top={top} drag={drag} blur={carBlur} />}
        {f >= d && f < fb(S.moments) && <Lap f={f} p={p} />}
        {f >= fb(S.moments) && f < fb(S.numbers) && <Moments f={f} />}
        {f >= fb(S.numbers) && f < fb(S.season) && <Numbers f={f} />}
        {f >= fb(S.season) && f < fb(S.end) && <Season f={f} />}
        {f >= fb(S.end) && <End f={f} p={p} />}
        {f >= d && <Header f={f} p={p} />}
      </AbsoluteFill>
      {blade < 1 && (
        <div style={{ position: "absolute", left: 0, right: 0, top: -40 + blade * 1430, height: 3, background: "#fff",
          boxShadow: `0 0 18px #fff, 0 0 50px ${C.lit}, 0 0 120px ${C.lit}`, opacity: 1 - blade * 0.3 }} />
      )}
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 55% 45% at 50% ${Math.max(20, Math.min(90, (top + CAR_H * 0.45) / 13.5))}%, ${C.lit} 0%, #e1060055 45%, transparent 80%)`, opacity: Math.min(1, flash), mixBlendMode: "screen" }} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 80% 70% at 50% 40%, #fff 0%, #ffd2c8 40%, #e10600 100%)", opacity: Math.min(1, big) * 0.95, mixBlendMode: "screen" }} />
      <AbsoluteFill style={{ background: "#000", opacity: end }} />
      {/* a long fade (16/11: "que dure más"): from the circuits screen to the last frame, about 7 s */}
      <Html5Audio src={staticFile("music/teaser-rush.wav")} volume={(fr) => Math.pow(1 - interpolate(fr, [fb(S.fade), TEASER_END - 1], [0, 1], clamp), 1.6)} />
    </AbsoluteFill>
  );
};
