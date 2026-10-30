/**
 * The web's speed kit, redrawn for a 1080 x 1920 frame: lit type, mono
 * kickers, the LED face, photographs with their smear dragging behind,
 * speed lines, the neon tube and the red tear. Sizes are the site's own
 * values times 2.5 (the site is read on a 432px-wide phone).
 */
import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, random, staticFile } from "remotion";
import data from "./data.json";
import { F, useFrame } from "./time";

export const C = {
  night: "#0a0a0a",
  brand: "#e10600",
  lit: "#ff2415",
  led: "#ff1c12",
  paper: "#fffce8",
  ink: "#1b1c22",
  printed: "#a9170b",
  muted: "#8c8c8c",
  yellow: "#eab308",
  ok: "#2fd06a",
};

export const WIDE: React.CSSProperties = {
  fontFamily: "Anybody",
  fontWeight: 800,
  fontStretch: "150%",
  textTransform: "uppercase",
  lineHeight: 0.94,
  letterSpacing: 0,
};

export const MONO: React.CSSProperties = {
  fontFamily: "JetBrains Mono",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.2em",
};

export const LED: React.CSSProperties = {
  fontFamily: "Doto",
  fontWeight: 900,
  color: C.led,
  textShadow: `0 0 4px ${C.led}, 0 0 22px ${C.led}cc, 0 0 60px #e1060099`,
};

export const BODY: React.CSSProperties = {
  fontFamily: "Space Grotesk",
  fontWeight: 500,
};

export const SERIF: React.CSSProperties = {
  fontFamily: "Instrument Serif",
  fontStyle: "italic",
  fontWeight: 400,
};

/** the site's .glow, scaled to the frame */
export const GLOW: React.CSSProperties = {
  color: C.lit,
  textShadow:
    "0 0 5px #ff7a62, 0 0 24px #ff2415, 0 0 64px #e10600cc, 0 0 150px #e1060080, 0 0 300px #e1060040",
};

/** the same light for small type, so the halo never swallows the figure */
export const GLOW_S: React.CSSProperties = {
  color: C.lit,
  textShadow: "0 0 3px #ff7a62, 0 0 12px #ff2415, 0 0 30px #e10600aa",
};

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const ease = Easing.bezier(0.7, 0, 0.2, 1);
export const out = Easing.bezier(0.16, 1, 0.3, 1);

/** the site's glow-hum: a neon tube that cannot quite hold steady */
export const hum = (f: number, period = 150) => {
  const p = (f % period) / period;
  const keys = [0, 0.44, 0.46, 0.47, 0.49, 0.52, 1];
  const vals = [1, 1.12, 0.78, 1.2, 0.9, 1.1, 1];
  return interpolate(p, keys, vals);
};

/** how hard the latest hit still rings: 1 on the frame, decaying after */
export const ring = (f: number, hits: number[], decay = 10) => {
  let v = 0;
  for (const h of hits) if (f >= h) v = Math.max(v, Math.exp(-(f - h) / decay));
  return v;
};

/** a deterministic shake that dies with the hit */
/** how much of the impact effects the film keeps: low, so nobody gets dizzy */
export const CALM = 0.3;

export const shake = (f: number, hits: number[], px = 14, decay = 7) => {
  px *= CALM;
  const r = ring(f, hits, decay);
  return {
    x: (random(`sx${f}`) - 0.5) * 2 * px * r,
    y: (random(`sy${f}`) - 0.5) * 2 * px * r,
  };
};

/**
 * "arriving at speed", kept legible: a short slide and fade (about 0.25s)
 * with only a trace of blur, so every word is readable the moment it lands
 */
export const smear = (
  f: number,
  start: number,
  from: "left" | "right" | "up" | "down" | "zoom" = "left",
  dur = 8,
  dist = 160,
): React.CSSProperties => {
  const p = interpolate(f, [start, start + dur], [0, 1], { ...clamp, easing: out });
  const d = (1 - p) * dist * 0.4;
  const t =
    from === "left" ? `translateX(${-d}px)` :
    from === "right" ? `translateX(${d}px)` :
    from === "up" ? `translateY(${-d}px)` :
    from === "down" ? `translateY(${d}px)` :
    `scale(${1 + (1 - p) * 0.2})`;
  return {
    opacity: f < start ? 0 : interpolate(p, [0, 0.5], [0, 1], clamp),
    filter: `blur(${(1 - p) * 3}px)`,
    transform: t,
  };
};

/** a photograph with its smeared copy dragging behind it (Mood.tsx Blur) */
export const Blur: React.FC<{
  src: string;
  style?: React.CSSProperties;
  imgStyle?: React.CSSProperties;
  drag?: number;
  dir?: "x" | "y";
  fit?: "cover" | "contain";
  /** fade the photograph's edges out, so no rectangle ever shows */
  mask?: boolean;
  /** for a cutout on black: the photograph screens over its own smear */
  screen?: boolean;
}> = ({ src, style, imgStyle, drag = 0.1, dir = "x", fit = "cover", mask, screen }) => {
  const s = staticFile(src);
  const trail =
    dir === "x"
      ? `translateX(${-drag * 100}%) scaleX(${1 + drag * 1.4})`
      : `translateY(${drag * 100}%) scaleY(${1 + drag * 1.4})`;
  return (
    <div
      style={{
        position: "absolute", overflow: "hidden",
        ...(mask ? { WebkitMaskImage: "radial-gradient(ellipse 50% 50% at 50% 50%, #000 55%, transparent 100%)" } : {}),
        ...style,
      }}
    >
      <Img
        src={s}
        style={{
          position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: fit,
          filter: "blur(40px) saturate(1.35) brightness(1.1)", opacity: 0.55,
          mixBlendMode: "screen", transform: trail, ...imgStyle,
        }}
      />
      <Img src={s} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: fit, ...(screen ? { mixBlendMode: "screen" } : {}), ...imgStyle }} />
    </div>
  );
};

/** light streaking across a dark stage */
export const Speedlines: React.FC<{
  n?: number; seed?: string; dir?: "x" | "y"; speed?: number; opacity?: number; start?: number;
}> = ({ n = 9, seed = "s", dir = "x", speed = 1, opacity = 1, start = 0 }) => {
  const f = useFrame() - start;
  if (f < 0) return null;
  const L = dir === "x" ? 1080 : 1920;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden", opacity }}>
      {Array.from({ length: n }, (_, i) => {
        const r = random(`${seed}${i}`);
        const len = 260 + r * 520;
        const period = Math.round((30 + random(`${seed}p${i}`) * 26) / speed);
        const ph = Math.floor(random(`${seed}o${i}`) * period);
        const p = ((f + ph) % period) / period;
        const pos = -len + p * (L + len * 2);
        const across = 6 + random(`${seed}a${i}`) * 88;
        const thick = i % 2 ? 2 : 4;
        const fade = interpolate(p, [0, 0.12, 0.7, 1], [0, 0.95, 0.55, 0]);
        const grad = `linear-gradient(${dir === "x" ? 90 : 180}deg, transparent, ${C.lit} 60%, #ffd2c8 92%, transparent)`;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              ...(dir === "x"
                ? { left: pos, top: `${across}%`, width: len, height: thick }
                : { top: pos, left: `${across}%`, height: len, width: thick }),
              background: grad,
              boxShadow: `0 0 30px ${C.lit}`,
              opacity: fade,
              filter: "blur(1px)",
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/** the neon tube cutting the frame on a diagonal; draw = 0..1 */
export const Beam: React.FC<{ draw: number; x?: number; angle?: number; pulse?: number; opacity?: number }> = ({
  draw, x = 140, angle = -31, pulse = -1, opacity = 1,
}) => (
  <div
    style={{
      position: "absolute", left: x, top: -380, height: 2600, width: 0,
      transform: `rotate(${angle}deg)`, transformOrigin: "50% 0", opacity,
    }}
  >
    <div
      style={{
        position: "absolute", left: 0, top: 0, width: 20, height: `${draw * 100}%`, borderRadius: 20,
        background: "linear-gradient(180deg, #ff1a0e 0%, #ff3a12 35%, #ff6a1a 70%, #ff9a2e 100%)",
        boxShadow: "0 0 14px 4px #ff2415, 0 0 60px 18px #ff2415aa, 0 0 220px 70px #e1060055",
      }}
    />
    <div
      style={{
        position: "absolute", left: 10, top: 0, width: 620, height: `${draw * 100}%`,
        background: "linear-gradient(90deg, #e10600aa, transparent 70%)", filter: "blur(70px)", opacity: 0.4,
      }}
    />
    {pulse >= 0 && pulse <= 1 && (
      <div
        style={{
          position: "absolute", left: 0, top: `${pulse * 100 * draw}%`, width: 20, height: 520,
          background: "linear-gradient(180deg, transparent, #fff3e6, transparent)",
          filter: "blur(4px)", mixBlendMode: "screen",
          opacity: interpolate(pulse, [0, 0.1, 0.9, 1], [0, 0.9, 0.9, 0]),
        }}
      />
    )}
  </div>
);

/** the red tear between sections: three lines that rip across */
export const Rip: React.FC<{ start: number; y?: number; flip?: boolean }> = ({ start, y = 960, flip }) => {
  const f = useFrame() - start;
  if (f < 0) return null;
  return (
    <>
      {[0, 1, 2].map((i) => {
        const p = interpolate(f - i * 2, [0, 9], [0, 1], { ...clamp, easing: ease });
        const o = interpolate(f - i * 2, [9, 22], [1, 0.4], clamp);
        return (
          <div
            key={i}
            style={{
              position: "absolute", left: 0, right: 0, top: y + (i - 1) * 26 + i * i * 6,
              height: i === 1 ? 12 : 4,
              background: `linear-gradient(90deg, transparent, ${C.lit} 20%, #ffb4a3 60%, ${C.lit} 85%, transparent)`,
              boxShadow: `0 0 40px ${C.lit}`,
              transform: `scaleX(${p}) skewY(${flip ? 2 : -2}deg)`,
              transformOrigin: flip ? "100% 50%" : "0 50%",
              opacity: o,
            }}
          />
        );
      })}
    </>
  );
};

/** film grain and a vignette over everything */
export const Finish: React.FC = () => {
  const f = useFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill
        style={{ background: "radial-gradient(ellipse 85% 70% at 50% 48%, transparent 68%, #00000066 100%)" }}
      />
      <svg width="1080" height="1920" style={{ position: "absolute", inset: 0, opacity: 0.075, mixBlendMode: "overlay" }}>
        <filter id="g">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={f % 12} />
        </filter>
        <rect width="1080" height="1920" filter="url(#g)" />
      </svg>
    </AbsoluteFill>
  );
};

/** a full-frame flash that decays */
export const Flash: React.FC<{ hits: number[]; color?: string; decay?: number; max?: number }> = ({
  hits, color = "#ff4a2e", decay = 5, max = 0.85,
}) => {
  const f = useFrame();
  const v = ring(f, hits, decay) * max * 0.45;
  if (v < 0.01) return null;
  return <AbsoluteFill style={{ background: color, opacity: v, mixBlendMode: "screen" }} />;
};

/** the real shape of a circuit, as an SVG path in its 1000 box */
export type GP = (typeof data.gps)[number];
export const GPS = data.gps as GP[];
export const TOTALS = data.totals;
export const trackPath = (g: GP) =>
  g.pts.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ") + " Z";
export const trackBox = (g: GP) => {
  const xs = g.pts.map((p) => p[0]), ys = g.pts.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const pad = 30;
  return `${x0 - pad} ${y0 - pad} ${x1 - x0 + pad * 2} ${y1 - y0 + pad * 2}`;
};

export const Track: React.FC<{
  g: GP; draw?: number; width?: number; color?: string; glow?: boolean; style?: React.CSSProperties; car?: number;
}> = ({ g, draw = 1, width = 6, color = C.lit, glow = true, style, car }) => {
  const d = trackPath(g);
  // the car: a point at fraction `car` along the polyline
  let cx = 0, cy = 0;
  if (car !== undefined) {
    const pts = g.pts;
    const idx = (car % 1) * (pts.length - 1);
    const i = Math.floor(idx), t = idx - i;
    const a = pts[i], b = pts[Math.min(i + 1, pts.length - 1)];
    cx = a[0] + (b[0] - a[0]) * t;
    cy = a[1] + (b[1] - a[1]) * t;
  }
  return (
    <svg viewBox={trackBox(g)} style={{ overflow: "visible", ...style }}>
      <path
        d={d} fill="none" stroke={color} strokeWidth={width} strokeLinejoin="round" strokeLinecap="round"
        pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw}
        style={glow ? { filter: `drop-shadow(0 0 ${width * 1.5}px ${color}) drop-shadow(0 0 ${width * 5}px ${color}aa)` } : undefined}
      />
      {car !== undefined && (
        <circle cx={cx} cy={cy} r={width * 2.2} fill="#fff"
          style={{ filter: `drop-shadow(0 0 ${width * 2}px #fff) drop-shadow(0 0 ${width * 5}px ${C.lit})` }} />
      )}
    </svg>
  );
};

/** helper for scenes: beat-relative frames inside a sequence that starts at beat k0 */
export const at = (k0: number) => (k: number) => F(k0 + k) - F(k0);
