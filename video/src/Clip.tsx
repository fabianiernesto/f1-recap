/**
 * Plays a recording of the real web (scripts/record.mjs) as a 30fps image
 * sequence. `t0` is the clip time (seconds) shown on the sequence's first
 * frame and `speed` how fast clip time runs; `freeze` holds the last frame.
 */
import React from "react";
import { Img, staticFile } from "remotion";
import index from "../public/clips/index.json";
import { FPS, useFrame } from "./time";

type Name = keyof typeof index;

export const clipFrame = (name: Name, t: number) => {
  const c = index[name];
  const i = Math.max(0, Math.min(c.frames.length - 1, Math.round(t * ((c as { fps?: number }).fps ?? 30))));
  return staticFile(`clips/${name}/${c.frames[i]}`);
};

/** the sub-frame captures inside a frame, when the clip has them (motion blur) */
export const clipSubs = (name: Name, t: number) => {
  const c = index[name] as { frames: string[]; half?: string[][] };
  if (!c.half) return [];
  const i = Math.max(0, Math.min(c.frames.length - 1, Math.round(t * ((c as { fps?: number }).fps ?? 30))));
  return c.half.map((list) => staticFile(`clips/${name}/${list[i]}`));
};

/** a frame of a clip, averaged with its sub-frames for motion blur */
export const ClipFrame: React.FC<{ name: Name; t: number; style?: React.CSSProperties; fit?: "cover" | "contain" }> = ({ name, t, style, fit = "cover" }) => {
  const subs = clipSubs(name, t);
  const st: React.CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: fit, ...style };
  return (
    <>
      <Img src={clipFrame(name, t)} style={st} />
      {/* layer k on top at 1/(k+1): a running average, so every sample weighs the same */}
      {subs.map((src, k) => <Img key={k} src={src} style={{ ...st, opacity: 1 / (k + 2) }} />)}
    </>
  );
};

export const Clip: React.FC<{
  name: Name;
  t0: number;
  speed?: number;
  style?: React.CSSProperties;
  fit?: "cover" | "contain";
}> = ({ name, t0, speed = 1, style, fit = "cover" }) => {
  const f = useFrame();
  const t = t0 + (f / FPS) * speed;
  return <ClipFrame name={name} t={t} style={style} fit={fit} />;
};

export const markers = (name: Name) => index[name].markers as Record<string, number>;
