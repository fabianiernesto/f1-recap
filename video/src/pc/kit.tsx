/**
 * The film in PC format, 1920x1080. The frame has one idea: the words on the
 * left, with room to be read, and the real site on the right at full height
 * (the desktop layout, recorded at 1040x802 by scripts/capture.mjs, clips p*).
 * A mouse, not a finger.
 */
import React from "react";
import { AbsoluteFill, Easing, interpolate, random } from "remotion";
import { BODY, C, clamp, MONO, smear, WIDE } from "../kit";
import { BEAT, FPS, START, useFrame, X } from "../time";

export const FRAME = { w: 1920, h: 1080 };
/** the site's place in the frame */
export const SITE = { x: 520, y: 0, w: 1400, h: 1080 };
/** CSS px of the recording -> px of the frame */
export const S = SITE.w / 1040;
/** the words' column */
export const COL = { x: 64, w: 420, top: 300 };

/** the seam between the words and the site */
export const Seam: React.FC<{ opacity?: number }> = ({ opacity = 1 }) => (
  <div style={{ position: "absolute", left: SITE.x - 1, top: 0, bottom: 0, width: 1, background: "#ffffff17", opacity }} />
);

/** the counter over every act: where we are in the three steps */
export const Counter: React.FC<{ n: string; tag?: string; style?: React.CSSProperties }> = ({ n, tag, style }) => (
  <div style={{ display: "flex", gap: 20, alignItems: "baseline", ...style }}>
    <span style={{ ...MONO, fontSize: 24, color: C.lit, whiteSpace: "nowrap" }}>{n} / 03</span>
    {tag && <span style={{ ...MONO, fontSize: 24, color: "#ffffff80", whiteSpace: "nowrap" }}>{tag}</span>}
  </div>
);

/**
 * The words' column (11/11, Ernesto: "no se ve lo suficiente", the copy is the thread of a
 * film with no voice). One system for every act: where we are, small and steady at the top
 * (the act's number and its name); what is happening now, big, because it is what tells the
 * film; and a detail under it when the picture needs one. Lines come up from behind their
 * own edge and leave over the top, never two at once.
 */
export type Say = { from: number; to: number; big: string; small?: string; smallAt?: number };
export const NARRATE = { size: 48, line: 1.14, width: 436, small: 30 };

const riseIn = Easing.bezier(0.16, 1, 0.3, 1);
/** a line that comes up from behind its own edge and, when its time is up, leaves over the top */
export const Mask: React.FC<{ f: number; at: number; out?: number; dur?: number; style?: React.CSSProperties; children: React.ReactNode }> = ({ f, at: st, out: end, dur = 8, style, children }) => {
  if (f < st - 1 || (end !== undefined && f >= end)) return null;
  const p = interpolate(f, [st, st + dur], [0, 1], { ...clamp, easing: riseIn });
  const q = end === undefined ? 0 : interpolate(f, [end - 4, end], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  return (
    <div style={{ ...style, overflow: "hidden", paddingTop: "0.1em", paddingBottom: "0.2em", marginTop: "-0.1em", marginBottom: "-0.2em" }}>
      <div style={{ transform: `translateY(${(1 - p - q) * 115}%)` }}>{children}</div>
    </div>
  );
};

export const Column: React.FC<{ f: number; at: number; n: string; tag?: string; name: string; lines: Say[]; b: (k: number) => number; k0: number; until?: number }> = ({ f, at: st, n, tag, name, lines, b, k0, until }) => (
  <div style={{ position: "absolute", left: COL.x, width: NARRATE.width, top: COL.top }}>
    <Mask f={f} at={st} out={until} dur={9}><Counter n={n} tag={tag} /></Mask>
    <div style={{ marginTop: 16 }}>
      <Mask f={f} at={st + 2} out={until} style={{ ...WIDE, fontSize: 26, lineHeight: 1.1, color: "#fff", whiteSpace: "nowrap" }}>{name}</Mask>
    </div>
    <div style={{ position: "relative", marginTop: 64 }}>
      {lines.map((l, i) => {
        const inAt = b(l.from - k0);
        const outAt = i === lines.length - 1 ? until : b(l.to - k0);
        if (f < inAt - 1 || (outAt !== undefined && f >= outAt)) return null;
        return (
          <div key={i} style={{ position: "absolute", left: 0, right: 0, top: 0 }}>
            <Mask f={f} at={inAt} out={outAt} style={{ ...BODY, fontSize: NARRATE.size, fontWeight: 600, lineHeight: NARRATE.line, color: "#fff", textWrap: "balance" } as React.CSSProperties}>{l.big}</Mask>
            {l.small && (
              <div style={{ marginTop: 26 }}>
                <Mask f={f} at={l.smallAt !== undefined ? b(l.smallAt - k0) : inAt + 4} out={outAt}
                  style={{ ...BODY, fontSize: NARRATE.small, lineHeight: 1.3, color: "#ffffffb8", textWrap: "balance" } as React.CSSProperties}>{l.small}</Mask>
              </div>
            )}
          </div>
        );
      })}
    </div>
  </div>
);

/** the site's cursor (web/components/CustomCursor.tsx): a dot that inverts what is under it, open over what you can press */
export const DOT = { rest: 16, open: 56 };
export const Dot: React.FC<{ x: number; y: number; size?: number; opacity?: number }> = ({ x, y, size = DOT.rest, opacity = 1 }) => (
  <div style={{ position: "absolute", left: x - size / 2, top: y - size / 2, width: size, height: size, borderRadius: "50%", backdropFilter: "grayscale(1) invert(1)", opacity }} />
);

/** the mouse on a run of clicks: it travels from one to the next, opens over the target, presses, and a thin ring opens */
export const Cursor: React.FC<{ f: number; taps: { at: number; x: number; y: number }[] }> = ({ f, taps }) => {
  const LEAD = 14, TAIL = 16, JOIN = 70;
  const io = { ...clamp, easing: Easing.inOut(Easing.cubic) };
  const i = taps.findIndex((t) => f <= t.at + TAIL);
  let dot: React.ReactNode = null;
  if (i >= 0 && f >= taps[i].at - LEAD - 8) {
    const t = taps[i], prev = taps[i - 1], next = taps[i + 1];
    const joined = !!prev && t.at - prev.at < JOIN;
    const from = joined ? prev : { x: t.x + 150, y: t.y + 130 };
    const p = interpolate(f, [t.at - LEAD - 2, t.at], [0, 1], io);
    const op = Math.min(joined ? 1 : interpolate(f, [t.at - LEAD - 8, t.at - LEAD], [0, 1], clamp),
      next && next.at - t.at < JOIN ? 1 : interpolate(f, [t.at + 3, t.at + TAIL], [1, 0], clamp));
    const open = interpolate(f, [t.at - 9, t.at - 2], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
    const press = 1 - 0.18 * interpolate(Math.abs(f - t.at), [0, 3], [1, 0], clamp);
    dot = <Dot x={from.x + (t.x - from.x) * p} y={from.y + (t.y - from.y) * p} size={(DOT.rest + (DOT.open - DOT.rest) * open) * press} opacity={op} />;
  }
  return (
    <>
      {taps.map((t) => {
        const p = interpolate(f, [t.at, t.at + 16], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
        if (f < t.at || p >= 1) return null;
        return <div key={t.at} style={{ position: "absolute", left: t.x - 60, top: t.y - 60, width: 120, height: 120, borderRadius: "50%",
          border: "2px solid #fff", transform: `scale(${0.45 + p * 0.65})`, opacity: (1 - p) * 0.7 }} />;
      })}
      {dot}
    </>
  );
};

/** the mouse wheel at work: the dot rests on the page while it scrolls */
export const ScrollCue: React.FC<{ f: number; at: number[]; len: number }> = ({ f, at, len }) => (
  <>
    {at.map((st) => {
      const p = interpolate(f, [st - 8, st + len + 4], [0, 1], clamp);
      if (p <= 0 || p >= 1) return null;
      return <Dot key={st} x={SITE.x + SITE.w * 0.85} y={620} opacity={Math.min(1, Math.sin(Math.PI * p) * 2.6)} />;
    })}
  </>
);

/* ---------- the song's light, redrawn for the wide frame (BeatFX.tsx) ---------- */

const gate = (k: number) => (k < 16 ? 0 : k < 48 ? 0.55 : k < 73 ? 1 : k < 80 ? 0 : k < 144 ? 1 : 0);

export const BeatLightPC: React.FC = () => {
  const f = useFrame();
  const pos = f / (BEAT * FPS) + START;
  const k = Math.floor(pos), ph = pos - k, g = gate(k);
  if (g === 0) return null;
  // nothing runs across the boxes and the games while you read them
  const quiet = k >= 36 && k < 112 + X;
  const bar = !quiet && k % 8 === 0 && ph < 0.75;
  const sp = ph / 0.75;
  const streaks = bar
    ? [0, 1].map((j) => {
        const r = random(`bar${k}${j}`);
        const fade = Math.sin(Math.PI * Math.min(1, sp * 1.1));
        return <div key={j} style={{ position: "absolute", top: 120 + r * 840, height: 3 + j * 2, width: 900, left: -900 + sp * 2820,
          background: `linear-gradient(90deg, transparent, ${C.lit}, #ffd2c8)`, boxShadow: `0 0 24px ${C.lit}`, opacity: fade * 0.5 * g }} />;
      })
    : null;
  // the hard cuts between scenes are crossed by a blade of light on the beat
  // (69 and 71 left on 10/11: Play it is no longer a cut, the site's change curtain carries it, PlayIntroPC)
  const CUTS = [112 + X, 126 + X, 136 + X];
  const cut = CUTS.map((c) => pos - c).find((d) => Math.abs(d) < 0.45);
  const blade = cut === undefined ? null : (() => {
    const t = (cut + 0.45) / 0.9;
    return <div style={{ position: "absolute", top: -300, bottom: -300, width: 620, left: -800 + t * 3200, transform: "skewX(-18deg)", mixBlendMode: "screen", opacity: Math.sin(Math.PI * t),
      background: `linear-gradient(90deg, transparent, ${C.lit} 35%, #ffe2d8 50%, ${C.lit} 65%, transparent)`, filter: "blur(6px)" }} />;
  })();
  return <AbsoluteFill style={{ pointerEvents: "none" }}>{blade}{streaks}</AbsoluteFill>;
};

/** film grain and a vignette over everything */
export const FinishPC: React.FC = () => {
  const f = useFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 85% 75% at 50% 50%, transparent 72%, #00000055 100%)" }} />
      <svg width={FRAME.w} height={FRAME.h} style={{ position: "absolute", inset: 0, opacity: 0.075, mixBlendMode: "overlay" }}>
        <filter id="gpc"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={f % 12} /></filter>
        <rect width={FRAME.w} height={FRAME.h} filter="url(#gpc)" />
      </svg>
    </AbsoluteFill>
  );
};

/**
 * The site's change curtain (web/app/globals.css, "the sting"), for any cut in
 * the film: five slanted black bars rip in from the right, each dragging a hot
 * edge, hold, and whip off to the left. `inAt` and `offAt` are frames (30fps
 * units) of the scene it sits in. (17/11: also the cut from the name to 01.)
 */
export const Sting: React.FC<{ f: number; inAt: number; offAt: number }> = ({ f, inAt, offAt }) => {
  const BARS = 5;
  const shut = inAt + (BARS - 1) * 1.0 + 7;
  const flash = interpolate(f, [shut - 2, shut, shut + 4], [0, 0.16, 0], clamp);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: "-14%", right: "-14%", top: "-8%", bottom: "-8%", display: "flex", transform: "skewX(-13deg)" }}>
        {Array.from({ length: BARS }, (_, i) => {
          const a = inAt + i * 1.0;
          const inP = interpolate(f, [a, a + 7], [0, 1], { ...clamp, easing: Easing.bezier(0.25, 0.9, 0.25, 1) });
          const o = offAt + (BARS - 1 - i) * 0.8;
          const outP = interpolate(f, [o, o + 7], [0, 1], { ...clamp, easing: Easing.bezier(0.6, 0, 0.9, 0.3) });
          const x = ((BARS - i) * 100 + 30) * (1 - inP) - ((i + 1) * 100 + 30) * outP;
          const hot = 1 - interpolate(f, [a + 5, a + 14], [0, 1], clamp);
          return (
            <div key={i} style={{ position: "relative", flex: 1, background: "#000", transform: `translateX(${x}%)` }}>
              {hot > 0 && <div style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: "44%", opacity: hot,
                background: "linear-gradient(90deg, #e1060000, #e1060033 52%, #e10600d9 88%, #ffe3e1 100%)" }} />}
            </div>
          );
        })}
      </div>
      <AbsoluteFill style={{ background: "#fff", opacity: flash }} />
    </AbsoluteFill>
  );
};
