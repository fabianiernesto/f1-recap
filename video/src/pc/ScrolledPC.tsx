/**
 * Beats 32-69 in PC format: step 02, Scrolled. The weekend's sessions and a click
 * on the Race, how that page works on a desktop (the real track, the car on it,
 * a card for every moment), a short look at the colours of the boxes, and most of
 * the time the decisions it hands you, played on camera.
 */
import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, staticFile } from "remotion";
import { ClipFrame, markers } from "../Clip";
import { at, C, clamp } from "../kit";
import { FPS, useFrame } from "../time";
import { Column, Cursor, Dot, DOT, S, Say, ScrollCue, Seam, SITE } from "./kit";

const K0 = 32;
/** (10/11) the coloured cards start here: 2 beats earlier than before, taken from the still end of the race page */
const DEAL_AT = 45;
const W = SITE.w, H = SITE.h;

type Clip = "pWeek" | "pRaceCard" | "pWall" | "pSteward" | "pGuess";
type Shot = { from: number; to: number; clip?: Clip; still?: "boxes"; dimAt?: number; dimBy?: number; rise?: boolean };
const SHOTS: Shot[] = [
  { clip: "pWeek", from: 32, to: 36.5 },
  { clip: "pRaceCard", from: 36.5, to: DEAL_AT, dimBy: 0 },
  { still: "boxes", from: DEAL_AT, to: 49.5 },
  { clip: "pWall", from: 49.5, to: 57.5, dimAt: 52, dimBy: 0.4, rise: true },
  { clip: "pSteward", from: 57.5, to: 64, dimAt: 58, dimBy: 0.4, rise: true },
  { clip: "pGuess", from: 64, to: 69, dimAt: 64.4, dimBy: 0.4 },
];

/** (11/11) what the act says, frame by frame: the thread of a film with no voice */
const LINES: Say[] = [
  { from: 32.4, to: 41.5, big: "Open any session and scroll it", small: "The race plays out lap by lap", smallAt: 36.5 },
  { from: 41.5, to: 49.5, big: "Key moments, explained", small: "You read the colour first", smallAt: DEAL_AT },
  { from: 49.5, to: 57.5, big: "Then it's your call", small: "You're on the pit wall", smallAt: 51.8 },
  { from: 57.5, to: 64, big: "Now you're the steward" },
  { from: 64, to: 69, big: "Last one: guess the gap" }, // the curtain covers it from 67.4
];

const io = { ...clamp, easing: Easing.inOut(Easing.cubic) };
const WHIP = 8; // frames (30fps units) a new shot takes to rise into the screen

/**
 * The colours of the boxes (10/11: "una tarjeta debajo de la otra" looked cheap). The
 * race page goes out of focus behind, and three real cards are dealt onto a stack:
 * each one that lands pushes the last one back, which stays in sight by its coloured
 * edge and its label. Purple, the fastest lap; yellow, the safety car; red, the race
 * stopped, on top and readable. Cards from `pBoxes`, taken standing still.
 */
const DEAL = [
  { name: "fast", at: DEAL_AT, light: "168,85,247" },
  { name: "car", at: DEAL_AT + 1, light: "234,179,8" },
  { name: "red", at: DEAL_AT + 2, light: "225,6,0" },
] as const;
const CARD_W = 900; // on screen
const PEEK = 88; // what stays in sight of a card under the next one: its colour and its label, never its title
const LAND = 1; // beats a card takes to land: one a beat, then the stack holds 1.5 beats
const FROM = 420; // px below its place a card comes from: it is solid before it reaches the one in front
const land = Easing.bezier(0.22, 1, 0.36, 1);
const Boxes: React.FC<{ f: number; b: (k: number) => number }> = ({ f, b }) => {
  const m = markers("pBoxes") as unknown as Record<string, { w: number; h: number }>;
  const hs = DEAL.map((c) => (m[c.name].h * CARD_W) / m[c.name].w);
  const s = DEAL.map((c) => interpolate(f, [b(c.at - K0), b(c.at + LAND - K0)], [0, 1], { ...clamp, easing: land }));
  // the stack stays centred: its top with n cards on it
  const y0 = (n: number) => (H - (PEEK * (n - 1) + hs[n - 1])) / 2;
  // the page you were scrolling goes out of focus as the first card comes up
  const blur = interpolate(f, [b(DEAL_AT - K0), b(DEAL_AT + 0.8 - K0)], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const tPage = (b(DEAL_AT - K0) - b(36.5 - K0)) / FPS;
  const drift = interpolate(f, [b(DEAL_AT - K0), b(49.5 - K0)], [1, 1.02], clamp);
  return (
    <AbsoluteFill style={{ background: C.night, overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `scale(${1 + blur * 0.04})`, filter: `blur(${blur * 10}px) brightness(${1 - blur * 0.7})` }}>
        <ClipFrame name="pRaceCard" t={tPage} />
      </AbsoluteFill>
      <AbsoluteFill style={{ transform: `scale(${drift})` }}>
        {DEAL.map((c, i) => {
          if (f < b(c.at - K0)) return null;
          // on top of the stack when it lands, then pushed back by every card after it
          let top = y0(i + 1) + PEEK * i;
          let depth = 0;
          for (let j = i + 1; j < DEAL.length; j++) {
            top += (y0(j + 1) - y0(j)) * s[j];
            depth += s[j];
          }
          const rise = 1 - s[i];
          const fade = interpolate(f, [b(c.at - K0), b(c.at + 0.12 - K0)], [0, 1], clamp);
          return (
            <div key={c.name} style={{
              position: "absolute", left: (W - CARD_W) / 2, top: top + rise * FROM, width: CARD_W, height: hs[i], opacity: fade,
              transform: `scale(${(1 - 0.045 * depth) * (1 + 0.04 * rise)})`, transformOrigin: "50% 0",
              boxShadow: `0 -10px 24px -8px rgba(0,0,0,0.85), 0 34px 100px -34px rgba(${c.light},${0.55 * Math.max(0, 1 - depth)})`,
              filter: depth > 0.001 ? `brightness(${1 - 0.17 * depth})` : undefined,
            }}>
              <Img src={staticFile(`clips/pBoxes/${c.name}.png`)} style={{ display: "block", width: "100%", height: "100%" }} />
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** a frame of a shot: the clip, and the rest dimmed round what it is about */
const ShotFrame: React.FC<{ s: Shot; f: number; b: (k: number) => number }> = ({ s, f, b }) => {
  if (s.still === "boxes") return <Boxes f={f} b={b} />;
  const clip = s.clip!;
  const t = (f - b(s.from - K0)) / FPS;
  const m = markers(clip) as unknown as { focus?: ([number, number, number, number] | null)[]; rows?: [number, number, number, number][] };
  let hole: { x: number; y: number; w: number; h: number } | null = null;
  let dim = 0;
  if (m.rows) {
    // the page comes down to the sessions, then one by one down to the Race: the mouse goes there
    const when = [33.5, 33.95, 34.4, 34.85, 35.3].map((k) => b(k - K0));
    const walk = [0, 1, 2, 3, 4].map((i) => m.rows![i % m.rows!.length]);
    const pick = (n: number) => interpolate(f, when, walk.map((r) => r[n]), io);
    const pad = 4;
    hole = { x: pick(0) * S - pad, y: pick(1) * S - pad, w: pick(2) * S + pad * 2, h: pick(3) * S + pad * 2 };
    dim = 0.62 * interpolate(f, [b(33.2 - K0), b(33.6 - K0)], [0, 1], clamp);
  } else if ((s.dimBy ?? 0) > 0) {
    const list = m.focus ?? [];
    const r = list[Math.max(0, Math.min(list.length - 1, Math.round(t * 60)))];
    if (r) {
      const pad = 6;
      const x0 = Math.max(-40, r[0] * S - pad), y0 = Math.max(-40, r[1] * S - pad);
      const x1 = Math.min(W + 40, (r[0] + r[2]) * S + pad), y1 = Math.min(H + 40, (r[1] + r[3]) * S + pad);
      if (x1 > x0 && y1 > y0) hole = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    }
    const st = s.dimAt ?? s.from + 0.5;
    dim = s.dimBy! * interpolate(f, [b(st - K0), b(st + 0.6 - K0)], [0, 1], io);
  }
  return (
    <AbsoluteFill style={{ background: C.night, overflow: "hidden" }}>
      <ClipFrame name={clip} t={t} />
      {hole && dim > 0.001 && (
        <div style={{ position: "absolute", left: hole.x, top: hole.y, width: hole.w, height: hole.h, borderRadius: 8, boxShadow: `0 0 0 3000px rgba(0,0,0,${dim})` }} />
      )}
    </AbsoluteFill>
  );
};

export const ScrolledPC: React.FC = () => {
  const f = useFrame();
  const b = at(K0);
  const si = Math.max(0, SHOTS.findIndex((s) => f < b(s.to - K0)));
  const cur = SHOTS[si];
  const prev = SHOTS[si - 1];
  const into = cur.rise ? interpolate(f, [b(cur.from - K0), b(cur.from - K0) + WHIP], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) }) : 1;
  // the Race opens with a click and a push, like a link
  const pushAt = b(36.5 - K0);
  const push = si === 0 ? interpolate(f, [pushAt - 9, pushAt], [0, 1], io) : 0;
  const week = markers("pWeek") as unknown as { rows: [number, number, number, number][] };
  const row = week.rows[week.rows.length - 1];
  const taps = SHOTS.flatMap((s) => (s.clip ? (markers(s.clip) as unknown as { taps?: [number, number, number][] }).taps ?? [] : [])
    .map(([i, x, y]) => ({ at: b(s.from - K0) + i / 2, x: SITE.x + x * S, y: SITE.y + y * S })));
  const thumbs = (markers("pGuess") as unknown as { thumbs: ([number, number] | null)[] }).thumbs;
  const th = thumbs[Math.max(0, Math.min(thumbs.length - 1, Math.round(((f - b(64 - K0)) / FPS) * 60)))];
  const drag = Math.min(interpolate(f, [b(64.1 - K0), b(64.4 - K0)], [0, 1], clamp), interpolate(f, [b(65.5 - K0), b(65.8 - K0)], [1, 0], clamp));
  return (
    <AbsoluteFill style={{ background: C.night, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: SITE.x, top: SITE.y, width: W, height: H, overflow: "hidden" }}>
        {prev && into < 1 && (
          <AbsoluteFill style={{ transform: `translateY(${-into * H * 0.35}px)`, filter: `brightness(${1 - into * 0.6})` }}>
            <ShotFrame s={prev} f={f} b={b} />
          </AbsoluteFill>
        )}
        <AbsoluteFill style={{ transform: `translateY(${(1 - into) * H}px) translateX(${-push * W * 0.3}px)`, filter: `brightness(${1 - push * 0.5})`, boxShadow: into < 1 ? "0 -30px 60px #000" : undefined }}>
          <ShotFrame s={cur} f={f} b={b} />
        </AbsoluteFill>
        {push > 0 && (
          <AbsoluteFill style={{ background: C.night, transform: `translateX(${(1 - push) * W}px)` }}>
            <ClipFrame name="pRaceCard" t={0} />
          </AbsoluteFill>
        )}
      </div>
      <Seam />
      <ScrollCue f={f} at={[b(37.4 - K0), b(42 - K0)]} len={b(1)} />
      <ScrollCue f={f} at={[b(49.7 - K0)]} len={b(1.6)} />
      <Cursor f={f} taps={[{ at: b(35.8 - K0), x: SITE.x + (row[0] + row[2] * 0.72) * S, y: SITE.y + (row[1] + row[3] / 2) * S }, ...taps]} />
      {th && drag > 0 && <Dot x={SITE.x + th[0] * S} y={SITE.y + th[1] * S} size={DOT.open} opacity={drag} />}
      <Column f={f} at={0} n="02" name="Scrolled" lines={LINES} b={b} k0={K0} />
    </AbsoluteFill>
  );
};
