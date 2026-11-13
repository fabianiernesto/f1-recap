/**
 * Beats 32-69: step 02, Scrolled. It has to say what Scrolled is: every part of a
 * GP weekend, interactive. First the weekend's sessions and a tap on the Race,
 * then how that page works: a finger scrolls down it and its cards explain the
 * moments; a short look at the colours of the boxes; and most of the time the
 * decisions it hands you, played on camera. Every card is the real site. The line under the header says, in
 * plain words, what you are looking at.
 */
import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, staticFile } from "remotion";
import { ClipFrame, markers } from "../Clip";
import { at, BODY, C, clamp, GLOW, smear, WIDE } from "../kit";
import { FPS, useFrame } from "../time";
import { Fingers, PHONE, StepHead, Swipe } from "./HowItWorks";

const K0 = 32;
const S = PHONE.w / 432; // CSS px of the capture -> px of the screen
const W = PHONE.w, H = PHONE.h;

type Clip = "sWeek" | "sRaceCard" | "sWall" | "sSteward" | "sGuess";
/** the shots, in film beats; `dimAt` or `dims`: when the rest of the screen steps back from the card */
type Shot = { from: number; to: number; clip?: Clip; still?: "boxes" | "decide"; dimAt?: number; dims?: [number, number][]; dimBy?: number; rise?: boolean };
const SHOTS: Shot[] = [
  { clip: "sWeek", from: 32, to: 36.5 },
  { clip: "sRaceCard", from: 36.5, to: 47, dims: [[38.4, 42], [43, 48]], dimBy: 0.72 },
  { still: "boxes", from: 47, to: 49.5, rise: true },
  { still: "decide", from: 49.5, to: 51.5 },
  { clip: "sWall", from: 51.5, to: 57.5, dimAt: 52, rise: true },
  { clip: "sSteward", from: 57.5, to: 64, dimAt: 58, rise: true },
  { clip: "sGuess", from: 64, to: 69, dimAt: 64.4 },
];

/** the lines under the header, in film beats */
const LINES: { from: number; to: number; big: string }[] = [
  { from: 32.4, to: 36.5, big: "Every part of a GP weekend, interactive" },
  { from: 36.5, to: 42, big: "Scroll down the race, lap by lap" },
  { from: 42, to: 47, big: "Cards explain every key moment" },
  { from: 47, to: 49.5, big: "Colours say what happened" },
  { from: 49.5, to: 51.5, big: "And as you scroll," },
  { from: 51.5, to: 54.5, big: "You run the pit wall" },
  { from: 54.5, to: 57.5, big: "They boxed, you stayed out" },
  { from: 57.5, to: 60.8, big: "You're the steward" },
  { from: 60.8, to: 64, big: "Then see what they really did" },
  { from: 64, to: 69, big: "Now guess the gap" },
];

const io = { ...clamp, easing: Easing.inOut(Easing.cubic) };
const WHIP = 8; // frames (30fps units) a new shot takes to rise into the screen

/** the colours of the boxes, the real cards, together for one look */
const BOXES = [
  { name: "fast", at: 47 },
  { name: "car", at: 47.5 },
  { name: "red", at: 48 },
] as const;
const Boxes: React.FC<{ f: number; b: (k: number) => number }> = ({ f, b }) => {
  const m = markers("boxes") as unknown as Record<string, { w: number; h: number }>;
  const gap = 26;
  const total = BOXES.reduce((a, c) => a + m[c.name].h, 0) + gap * (BOXES.length - 1);
  let y = (H - total) / 2;
  return (
    <AbsoluteFill style={{ background: C.night, overflow: "hidden" }}>
      {BOXES.map((c) => {
        const st = b(c.at - K0);
        const p = interpolate(f, [st, st + 7], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
        const top = y;
        y += m[c.name].h + gap;
        if (p <= 0) return null;
        return <Img key={c.name} src={staticFile(`clips/boxes/${c.name}.png`)} style={{ position: "absolute", left: (W - m[c.name].w) / 2, top, width: m[c.name].w, height: m[c.name].h,
          opacity: p, transform: `translateY(${(1 - p) * 60}px)` }} />;
      })}
    </AbsoluteFill>
  );
};

/** the hinge of the act: from here on it is yours */
const Decide: React.FC<{ f: number; b: (k: number) => number }> = ({ f, b }) => {
  const st = b(49.5 - K0);
  return (
    <AbsoluteFill style={{ background: C.night, overflow: "hidden" }}>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 80% 45% at 40% 42%, #e1060030, transparent 70%)" }} />
      <div style={{ position: "absolute", left: 72, top: H * 0.27, ...WIDE, fontSize: 158, lineHeight: 1.02, ...GLOW, ...smear(f, st, "up", 8, 70) }}>
        You<br />decide.
      </div>
    </AbsoluteFill>
  );
};

/** a frame of a shot: the clip, and the rest dimmed round what it is about */
const ShotFrame: React.FC<{ s: Shot; f: number; b: (k: number) => number }> = ({ s, f, b }) => {
  if (s.still === "boxes") return <Boxes f={f} b={b} />;
  if (s.still === "decide") return <Decide f={f} b={b} />;
  const clip = s.clip!;
  const t = (f - b(s.from - K0)) / FPS;
  const m = markers(clip) as unknown as { focus?: ([number, number, number, number] | null)[]; rows?: [number, number, number, number][] };
  let hole: { x: number; y: number; w: number; h: number } | null = null;
  let dim = 0;
  if (m.rows) {
    // the sessions, one by one, top to bottom, down to the Race: the finger goes there
    const when = [32.9, 33.4, 33.9, 34.4, 34.9].map((k) => b(k - K0));
    const walk = [0, 1, 2, 3, 4].map((i) => m.rows![i % m.rows!.length]);
    const pick = (n: number) => interpolate(f, when, walk.map((r) => r[n]), io);
    const pad = 4;
    hole = { x: pick(0) * S - pad, y: pick(1) * S - pad, w: pick(2) * S + pad * 2, h: pick(3) * S + pad * 2 };
    dim = 0.62 * interpolate(f, [b(32.5 - K0), b(32.9 - K0)], [0, 1], clamp);
  } else {
    const list = m.focus ?? [];
    const r = list[Math.max(0, Math.min(list.length - 1, Math.round(t * 60)))];
    if (r) {
      const pad = 6;
      const x0 = Math.max(-40, r[0] * S - pad), y0 = Math.max(-40, r[1] * S - pad);
      const x1 = Math.min(W + 40, (r[0] + r[2]) * S + pad), y1 = Math.min(H + 40, (r[1] + r[3]) * S + pad);
      if (x1 > x0 && y1 > y0) hole = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    }
    const st = s.dimAt ?? s.from + 0.5;
    dim = (s.dimBy ?? 0.45) * (s.dims
      ? Math.max(...s.dims.map(([a, z]) => Math.min(interpolate(f, [b(a - K0), b(a + 0.6 - K0)], [0, 1], io), interpolate(f, [b(z - 0.4 - K0), b(z - K0)], [1, 0], io))))
      : interpolate(f, [b(st - K0), b(st + 0.6 - K0)], [0, 1], io));
  }
  return (
    <AbsoluteFill style={{ background: C.night, overflow: "hidden" }}>
      <ClipFrame name={clip} t={t} />
      {hole && dim > 0.001 && (
        <div style={{ position: "absolute", left: hole.x, top: hole.y, width: hole.w, height: hole.h, borderRadius: 12,
          boxShadow: `0 0 0 3000px rgba(0,0,0,${dim})` }} />
      )}
    </AbsoluteFill>
  );
};

export const Scrolled: React.FC = () => {
  const f = useFrame();
  const b = at(K0);

  const si = Math.max(0, SHOTS.findIndex((s) => f < b(s.to - K0)));
  const cur = SHOTS[si];
  const prev = SHOTS[si - 1];
  const into = cur.rise ? interpolate(f, [b(cur.from - K0), b(cur.from - K0) + WHIP], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) }) : 1;
  // the Race opens with a tap and a push, like a link
  const pushAt = b(36.5 - K0);
  const push = si === 0 ? interpolate(f, [pushAt - 9, pushAt], [0, 1], io) : 0;
  const week = markers("sWeek") as unknown as { rows: [number, number, number, number][] };
  const row = week.rows[week.rows.length - 1];

  // the fingers on the decisions, where the recording pressed, and on the slider
  const taps = SHOTS.flatMap((s) => (s.clip ? (markers(s.clip) as unknown as { taps?: [number, number, number][] }).taps ?? [] : [])
    .map(([i, x, y]) => ({ at: b(s.from - K0) + i / 2, x: PHONE.x + x * S, y: PHONE.y + y * S })));
  const thumbs = (markers("sGuess") as unknown as { thumbs: ([number, number] | null)[] }).thumbs;
  const th = thumbs[Math.max(0, Math.min(thumbs.length - 1, Math.round(((f - b(64 - K0)) / FPS) * 60)))];
  const drag = Math.min(interpolate(f, [b(64.1 - K0), b(64.4 - K0)], [0, 1], clamp), interpolate(f, [b(65.5 - K0), b(65.8 - K0)], [1, 0], clamp));

  return (
    <AbsoluteFill style={{ background: C.night, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: PHONE.x, top: PHONE.y, width: W, height: H, overflow: "hidden", boxShadow: "0 -2px 0 #ffffff14" }}>
        {prev && into < 1 && (
          <AbsoluteFill style={{ transform: `translateY(${-into * H * 0.35}px)`, filter: `brightness(${1 - into * 0.6})` }}>
            <ShotFrame s={prev} f={f} b={b} />
          </AbsoluteFill>
        )}
        <AbsoluteFill style={{ transform: `translateY(${(1 - into) * H}px) translateX(${-push * W * 0.3}px)`,
          filter: `brightness(${1 - push * 0.5})`, boxShadow: into < 1 ? "0 -30px 60px #000" : undefined }}>
          <ShotFrame s={cur} f={f} b={b} />
        </AbsoluteFill>
        {push > 0 && (
          <AbsoluteFill style={{ background: C.night, transform: `translateX(${(1 - push) * W}px)` }}>
            <ClipFrame name="sRaceCard" t={0} />
          </AbsoluteFill>
        )}
      </div>

      <Swipe f={f} at={[b(37.3 - K0), b(41.9 - K0)]} len={b(1.1)} />
      <Fingers f={f} taps={[{ at: b(35.8 - K0), x: PHONE.x + (row[0] + row[2] * 0.72) * S, y: PHONE.y + (row[1] + row[3] / 2) * S }, ...taps]} />
      {th && drag > 0 && (
        <div style={{ position: "absolute", left: PHONE.x + th[0] * S - 22, top: PHONE.y + th[1] * S - 22, width: 44, height: 44, borderRadius: "50%",
          background: "#ffffffd8", boxShadow: `0 0 0 6px ${C.lit}55, 0 0 26px ${C.lit}`, opacity: drag }} />
      )}

      <StepHead f={f} at={0} n="02" tag="Scroll it" word="Scrolled.">
        <div style={{ position: "relative", height: 100, marginTop: 30 }}>
          {LINES.map((l, i) => {
            const inAt = b(l.from - K0);
            const gone = i === LINES.length - 1 ? 0 : interpolate(f, [b(l.to - K0) - 6, b(l.to - K0) - 1], [0, 1], clamp);
            if (f < inAt - 1 || gone >= 1) return null;
            return (
              <div key={i} style={{ position: "absolute", left: 0, top: 0, whiteSpace: "nowrap", ...BODY, fontSize: 46, fontWeight: 600, color: "#fff",
                opacity: 1 - gone, transform: `translateY(${-gone * 24}px)`, ...smear(f, inAt, "up", 8, 50) }}>{l.big}</div>
            );
          })}
        </div>
      </StepHead>
    </AbsoluteFill>
  );
};
