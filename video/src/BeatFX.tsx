/**
 * Light that marks the song's structure, never its every beat: a soft streak
 * where each eight-beat phrase starts, and a blade of light across the hard
 * cuts between scenes. Nothing pumps or flashes on the kick. Quiet in the
 * intro, the breakdown and the end card.
 */
import React from "react";
import { AbsoluteFill, random } from "remotion";
import beats from "./beats.json";
import { C } from "./kit";
import { BEAT, FPS, START, useFrame, X } from "./time";

const STRENGTH = beats.strength as number[];

/** how much of the pulse each part of the film carries */
const gate = (k: number) =>
  k < 16 ? 0 : k < 48 ? 0.55 : k < 73 ? 1 : k < 80 ? 0 : k < 144 ? 1 : 0;

export const useBeat = () => {
  const f = useFrame();
  const pos = f / (BEAT * FPS) + START;
  const k = Math.floor(pos);
  const ph = pos - k;
  const g = gate(k);
  const env = (STRENGTH[k] ?? 0) * Math.exp(-ph / 0.2) * g;
  return { pos, k, ph, g, env };
};

/** the picture itself takes the hit */
export const BeatPunch: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <AbsoluteFill>{children}</AbsoluteFill>;
};

/** light on top: the phrase streak and the cut blades */
export const BeatLight: React.FC = () => {
  const { pos, k, ph, g } = useBeat();
  if (g === 0) return null;
  const scrolled = k >= 32 && k < 75 + X;
  const simplified = k >= 80 && k < 112;
  // the streak on each bar's downbeat
  const bar = k % 8 === 0 && ph < 0.75;
  const sp = ph / 0.75;
  const streaks = bar
    ? [0, 1].map((j) => {
        const r = random(`bar${k}${j}`);
        const fade = Math.sin(Math.PI * Math.min(1, sp * 1.1));
        return scrolled ? (
          <div key={j} style={{ position: "absolute", left: 60 + r * 960, width: 3 + j * 2, height: 700,
            top: 1920 - sp * 2620, background: `linear-gradient(180deg, transparent, ${C.lit}, #ffd2c8)`,
            boxShadow: `0 0 24px ${C.lit}`, opacity: fade * 0.5 * g }} />
        ) : (
          <div key={j} style={{ position: "absolute", top: 260 + r * 1400, height: 3 + j * 2, width: 760,
            left: -760 + sp * 1840, background: `linear-gradient(90deg, transparent, ${C.lit}, #ffd2c8)`,
            boxShadow: `0 0 24px ${C.lit}`, opacity: fade * 0.5 * g }} />
        );
      })
    : null;
  // the hard cuts between scenes are crossed by a blade of light on the beat
  const CUTS = [112 + X, 126 + X, 136 + X];
  const cut = CUTS.map((c) => pos - c).find((d) => Math.abs(d) < 0.45);
  const blade = cut === undefined ? null : (() => {
    const t = (cut + 0.45) / 0.9;
    return (
      <div style={{ position: "absolute", top: -300, bottom: -300, width: 520, left: -700 + t * 2300,
        transform: "skewX(-18deg)", mixBlendMode: "screen", opacity: Math.sin(Math.PI * t),
        background: `linear-gradient(90deg, transparent, ${C.lit} 35%, #ffe2d8 50%, ${C.lit} 65%, transparent)`,
        filter: "blur(6px)" }} />
    );
  })();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {blade}
      {streaks}
    </AbsoluteFill>
  );
};
