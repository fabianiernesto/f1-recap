/**
 * Beats 32-91: step 02, read it (Scrolled), as scripted on 13/10/2026
 * (GUION_INICIO.md). One idea per shot, held still long enough to read: the
 * phone How it works handed over stays where it is, every shot rises into it
 * like the next part of the page, and once it has arrived the camera leans in
 * to the one thing the shot is about (its rect is recorded on every frame of
 * the capture) while the rest of the screen goes dim. The line under the
 * header says, in plain words, what you are looking at.
 */
import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, staticFile } from "remotion";
import { ClipFrame, markers } from "../Clip";
import { at, BODY, C, clamp, GLOW, smear } from "../kit";
import { FPS, useFrame } from "../time";
import { PHONE, StepHead, Tap } from "./HowItWorks";
import strips from "../../public/clips/strips/strips.json";

const K0 = 32;
const S = PHONE.w / 432; // CSS px of the capture -> px of the phone

type Clip = "sWeek" | "sTrack" | "sMoment" | "sPurple" | "sYellow" | "sPred" | "sSteward" | "sGuess" | "sMate";
type Shot = { clip: Clip; from: number; to: number; z: number; cam: number; dim?: number; fan?: boolean };
/** the shots, in film beats; `cam` is the beat whose focus rect the camera frames */
const SHOTS: Shot[] = [
  { clip: "sWeek", from: 32, to: 38, z: 1.08, cam: 35 },
  { clip: "sTrack", from: 38, to: 44.5, z: 1, cam: 40, dim: 0 },
  { clip: "sMoment", from: 44.5, to: 51, z: 1.14, cam: 46.5 },
  { clip: "sPurple", from: 51, to: 55, z: 1.14, cam: 52.5 },
  { clip: "sYellow", from: 55, to: 59.5, z: 1.14, cam: 57 },
  { clip: "sPred", from: 59.5, to: 67.5, z: 1.12, cam: 64 },
  // the three kinds of call: the last shot dims under three strips
  { clip: "sPred", from: 67.5, to: 72, z: 1.12, cam: 64, fan: true },
  { clip: "sSteward", from: 72, to: 77.5, z: 1.08, cam: 76 },
  { clip: "sGuess", from: 77.5, to: 83.5, z: 1.12, cam: 81 },
  { clip: "sMate", from: 83.5, to: 92, z: 1, cam: 87 },
];
/** the beat a clip's first frame belongs to */
const START: Record<Clip, number> = {
  sWeek: 32, sTrack: 38, sMoment: 44.5, sPurple: 51, sYellow: 55, sPred: 59.5, sSteward: 72, sGuess: 77.5, sMate: 83.5,
};

/** the lines under the header, in film beats: a big one and a small one */
const LINES: { from: number; to: number; big: string; small?: string }[] = [
  { from: 32.8, to: 38, big: "Pick any session", small: "Practice, qualifying, sprint, race" },
  { from: 38.4, to: 44.5, big: "Scroll, and the car drives the real track", small: "Lap by lap" },
  { from: 44.9, to: 51, big: "Every moment of the race, explained", small: "In the order it happened" },
  { from: 51.4, to: 55, big: "Purple: the fastest lap" },
  { from: 55.4, to: 59.5, big: "Yellow: safety car and flags" },
  { from: 59.9, to: 63, big: "Guess what happens next", small: "Colapinto starts P19. Where does he finish?" },
  { from: 63, to: 67.5, big: "Guess what happens next", small: "You called it: P19 to P9" },
  { from: 67.7, to: 77.5, big: "Make the call yourself", small: "As the pit wall · the steward · what if" },
  { from: 77.9, to: 83.5, big: "Guess the number", small: "How far behind was Russell at the flag?" },
  { from: 83.9, to: 92, big: "Ask Alfred anything about the race" },
];
const bigText = (s: string) =>
  s.includes("Alfred") ? <>Ask <span style={GLOW}>Alfred</span> anything about the race</> : s;

const STRIPS = [
  { key: "pit", at: 67.9, r: -1.2, x: -14 },
  { key: "steward", at: 68.5, r: 0.8, x: 16 },
  { key: "whatif", at: 69.1, r: -0.6, x: -6 },
] as const;

const smooth = { ...clamp, easing: Easing.inOut(Easing.sin) };
const io = { ...clamp, easing: Easing.inOut(Easing.cubic) };
const WHIP = 8; // frames (30fps units) a new shot takes to rise into the phone
const W = PHONE.w, H = PHONE.h;

/** a frame of a shot: the clip, the camera leaning in, the rest dimmed */
const ShotFrame: React.FC<{ s: Shot; f: number; b: (k: number) => number; last: boolean }> = ({ s, f, b, last }) => {
  const t = (f - b(START[s.clip] - K0)) / FPS;
  const m = markers(s.clip) as unknown as { focus?: ([number, number, number, number] | null)[] };
  const list = m.focus ?? [];
  const idx = (tt: number) => Math.max(0, Math.min(list.length - 1, Math.round(tt * 60)));
  const camR = list[idx((b(s.cam - K0) - b(START[s.clip] - K0)) / FPS)];
  const r = list[idx(t)];
  // the camera arrives a beat after the shot has, and lets go at the very end
  let c = interpolate(f, [b(s.from - K0 + 0.5), b(s.from - K0 + 1.6)], [0, 1], io);
  if (last) c *= interpolate(f, [b(90.1 - K0), b(90.9 - K0)], [1, 0], io);
  if (s.fan) c = 1;
  const z = 1 + (s.z - 1) * c;
  let tx = 0, ty = 0;
  if (camR) {
    const cx = (camR[0] + camR[2] / 2) * S, cy = (camR[1] + camR[3] / 2) * S;
    tx = Math.min(0, Math.max(W - W * s.z, W / 2 - cx * s.z)) * c;
    ty = Math.min(0, Math.max(H - H * s.z, H * 0.48 - cy * s.z)) * c;
  }
  // the hole in the dim, where the thing is on this frame, kept on screen
  let hole: { x: number; y: number; w: number; h: number } | null = null;
  if (r) {
    const pad = 6;
    const x0 = Math.max(-40, r[0] * S * z + tx - pad), y0 = Math.max(-40, r[1] * S * z + ty - pad);
    const x1 = Math.min(W + 40, (r[0] + r[2]) * S * z + tx + pad), y1 = Math.min(H + 40, (r[1] + r[3]) * S * z + ty + pad);
    if (x1 > x0 && y1 > y0) hole = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
  const dim = (s.dim ?? 0.6) * c;
  return (
    <AbsoluteFill style={{ background: C.night, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, transformOrigin: "0 0", transform: `translate(${tx}px, ${ty}px) scale(${z})` }}>
        <ClipFrame name={s.clip} t={t} />
      </div>
      {hole && dim > 0.001 && (
        <div style={{ position: "absolute", left: hole.x, top: hole.y, width: hole.w, height: hole.h, borderRadius: 16,
          boxShadow: `0 0 0 3000px rgba(0,0,0,${dim})` }} />
      )}
    </AbsoluteFill>
  );
};

export const Scrolled: React.FC = () => {
  const f = useFrame();
  const B = 60 / 110;
  const u = f / FPS / B; // local beat, continuous
  const b = at(K0);
  const m = markers("sWeek");

  // one slow, continuous turn of the phone
  const curve = (keys: number[], vals: number[]) => interpolate(u, keys, vals, smooth);
  const ry = curve([0, 1.5, 59], [0, -5, 4]);
  const rx = curve([0, 1.5, 30, 59], [0, 3, 2, 3]);
  const out = interpolate(f, [b(58.6), b(59)], [0, 1], clamp);

  const si = Math.max(0, SHOTS.findIndex((s) => f < b(s.to - K0)));
  const cur = SHOTS[si];
  const prev = SHOTS[si - 1];
  // the sessions hand over to the race with a tap and a push, like a link;
  // every other shot rises from below, like the next part of the page; the
  // fan has no shot of its own, the last one just dims under the strips
  const rises = si > 1 && !cur.fan;
  const into = rises ? interpolate(f, [b(cur.from - K0), b(cur.from - K0) + WHIP], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) }) : 1;
  const pushAt = b(38 - K0);
  const push = si === 0 ? interpolate(f, [pushAt - 12, pushAt], [0, 1], io) : 0;
  const fanDim = cur.fan ? interpolate(f, [b(67.5 - K0), b(68.2 - K0)], [0, 1], io) : 0;

  return (
    <AbsoluteFill style={{ background: C.night, overflow: "hidden" }}>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 70% 45% at 50% 62%, #e106001c, transparent 70%)" }} />

      {/* the phone, where How it works left it */}
      <div style={{ position: "absolute", inset: 0, perspective: 2600 }}>
        <div style={{ position: "absolute", left: PHONE.x, top: PHONE.y, width: W, height: H, borderRadius: 34, overflow: "hidden",
          transform: `rotateY(${ry}deg) rotateX(${rx}deg)`,
          boxShadow: "0 0 0 2px #ffffff1a, 0 70px 180px #000, 0 0 160px #e1060048" }}>
          {prev && into < 1 && (
            <AbsoluteFill style={{ transform: `translateY(${-into * H * 0.35}px)`, filter: `brightness(${(prev.fan ? 0.3 : 1) * (1 - into * 0.6)})` }}>
              <ShotFrame s={prev} f={f} b={b} last={false} />
            </AbsoluteFill>
          )}
          <AbsoluteFill style={{ transform: `translateY(${(1 - into) * H}px) translateX(${-push * W * 0.3}px)`,
            filter: `brightness(${(1 - push * 0.5) * (1 - fanDim * 0.7)})`, boxShadow: into < 1 ? "0 -30px 60px #000" : undefined }}>
            <ShotFrame s={cur} f={f} b={b} last={si === SHOTS.length - 1} />
          </AbsoluteFill>
          {push > 0 && (
            <AbsoluteFill style={{ background: C.night, transform: `translateX(${(1 - push) * W}px)` }}>
              <ClipFrame name="sTrack" t={0} />
            </AbsoluteFill>
          )}
        </div>
      </div>
      <Tap f={f} at={b(37 - K0)} x={PHONE.x + (m.raceX + m.raceW / 2) * S} y={PHONE.y + (m.raceY + m.raceH / 2) * S} />

      {/* the three kinds of call: each card's own kicker and question */}
      {cur.fan && (() => {
        const gone = interpolate(f, [b(71.5 - K0), b(72 - K0)], [0, 1], io);
        const sw = 960, gap = 30;
        const hs = STRIPS.map((s) => (strips[s.key].h / strips[s.key].w) * sw);
        const total = hs.reduce((p, q) => p + q, 0) + gap * 2;
        let y = PHONE.y + H * 0.47 - total / 2;
        return STRIPS.map((s, i) => {
          const top = y;
          y += hs[i] + gap;
          const inP = interpolate(f, [b(s.at - K0), b(s.at - K0) + 9], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
          return (
            <div key={s.key} style={{ position: "absolute", left: (1080 - sw) / 2 + s.x, top, width: sw, height: hs[i],
              opacity: inP * (1 - gone), transform: `translateY(${(1 - inP) * 70 - gone * 120}px) rotate(${s.r}deg)`,
              boxShadow: "0 0 0 2px #ffffff14, 0 40px 90px #000c", borderRadius: 6, overflow: "hidden" }}>
              <Img src={staticFile(`clips/strips/${s.key}.png`)} style={{ width: "100%", height: "100%", display: "block" }} />
            </div>
          );
        });
      })()}

      {/* step 02 */}
      <div style={{ opacity: 1 - out }}>
        <StepHead f={f} at={0} n="02" tag="Scrolled" word="Read it.">
          <div style={{ position: "relative", height: 110, marginTop: 18 }}>
            {LINES.map((l, i) => {
              const inAt = b(l.from - K0);
              const next = LINES[i + 1];
              const sameBig = i > 0 && LINES[i - 1].big === l.big;
              const keepBig = !!next && next.big === l.big;
              const outAt = next ? b(l.to - K0) : null;
              const gone = outAt === null ? 0 : interpolate(f, [outAt - 4, outAt + 1], [0, 1], clamp);
              if (f < inAt - 1 || gone >= 1) return null;
              return (
                <div key={i} style={{ position: "absolute", left: 0, top: 0, whiteSpace: "nowrap" }}>
                  <div style={{ ...BODY, fontSize: 46, fontWeight: 600, color: "#fff", opacity: keepBig ? 1 : 1 - gone,
                    transform: `translateY(${keepBig ? 0 : -gone * 24}px)`, ...(sameBig ? {} : smear(f, inAt, "up", 8, 50)) }}>{bigText(l.big)}</div>
                  {l.small && (
                    <div style={{ ...BODY, fontSize: 32, color: "#ffffffa8", marginTop: 8, opacity: 1 - gone, ...smear(f, inAt + 4, "up", 8, 40) }}>{l.small}</div>
                  )}
                </div>
              );
            })}
          </div>
        </StepHead>
      </div>
    </AbsoluteFill>
  );
};
