import React from "react";
import { Sequence, useCurrentFrame } from "remotion";
/**
 * Everything in the film sits on the song's grid: 110 BPM. The film starts
 * on beat 8 (START); since 13/10/2026 film beat k is song beat k up to 128,
 * then the soundtrack splices into the song's last phrase (see
 * scripts/soundtrack.mjs), so the grid never breaks.
 *
 *   beats   8-16   the intro flight
 *   beats  16-24   what it is: Racing Simplified, the website that explains every F1 race
 *   beats  24-32   01 Pick a race (the drums come in on 32)
 *   beats  32-69   02 Scrolled: every part of the weekend, its cards, and above all the decisions
 *   beats  64-91   03 Play it: game 1, Call the race, played on camera
 *   beats  91-96   the breakdown (the bass drops out)
 *   beats  96-128  the drop: game 2, Paddock exchange, played on camera
 *   beats 128-160  the last phrase of the song: how it was built
 *   beats 160-     the end card, while the song rings out
 */
export const FPS = 30;
export const BEAT = 60 / 110;
export const START = 8;
/** frame of a beat, from the start of the film */
export const F = (beat: number) => Math.round((beat - START) * BEAT * FPS);
/** frames between two beats, computed on the absolute grid so nothing drifts */
export const span = (a: number, b: number) => F(b) - F(a);
/** beats added to the Scrolled act on 13/10/2026: everything after it moves
 *  by this much. The soundtrack starts 16 beats earlier in the song to pay
 *  for them (film beat k = song beat k up to 128, see scripts/soundtrack.mjs) */
export const X = 16;
export const END = F(144 + X) + Math.round(9.3 * FPS);

/**
 * The film renders at 60fps. Scene code keeps counting in 30fps units (now
 * fractional), so every timing written above still means the same moment in
 * the song; useFrame and Seq do the conversion at the edge.
 */
export const OUT_FPS = 60;
export const SCALE = OUT_FPS / FPS;
export const useFrame = () => useCurrentFrame() / SCALE;
export const Seq: React.FC<{ from?: number; durationInFrames?: number; children?: React.ReactNode }> = ({
  from = 0, durationInFrames = Infinity, children,
}) => (
  <Sequence from={Math.round(from * SCALE)} durationInFrames={durationInFrames === Infinity ? Infinity : Math.round(durationInFrames * SCALE)}>
    {children}
  </Sequence>
);
