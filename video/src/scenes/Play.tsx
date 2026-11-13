/**
 * Beats 69-128: step 03, play it. The two games played on camera,
 * the real screen edge to edge under one caption that says what is going on:
 * Call the race from 71 to 92, the dive into the drop, Paddock exchange from there.
 * Both recordings come from scripts/capture.mjs (playCall, playExchange), so
 * every price, lap and answer on screen is the site's own.
 */
import React from "react";
import { AbsoluteFill, Easing, Img, interpolate } from "remotion";
import { ClipFrame, clipFrame, markers } from "../Clip";
import { at, BODY, C, clamp, MONO, smear, WIDE } from "../kit";
import { FPS, span, useFrame } from "../time";
import { Fingers } from "./HowItWorks";

/** the game's screen in the frame: full width, under the caption */
const GAME = { y: 490, w: 1080, h: 1450 };
/** the caption clears the app's own bar at the top on Reels, Shorts and LinkedIn */
const CAPTION_Y = 208;
const S = GAME.w / 432; // CSS px of the capture -> px of the frame

type Line = { from: number; to: number; big: string; small?: string; soft?: boolean; smallAt?: number };

/** the caption: which game, what is happening in big, the detail in small */
const Caption: React.FC<{ f: number; b: (k: number) => number; K: number; game: string; lines: Line[] }> = ({ f, b, K, game, lines }) => (
  <div style={{ position: "absolute", left: 72, right: 56, top: CAPTION_Y }}>
    <div style={{ display: "flex", gap: 22 }}>
      <span style={{ ...MONO, fontSize: 30, color: C.lit }}>03 / 03</span>
      <span style={{ ...MONO, fontSize: 30, color: "#ffffff80" }}>{game}</span>
    </div>
    {lines.map((l, i) => {
      const inAt = b(l.from - K);
      const outAt = b(l.to - K);
      const last = i === lines.length - 1;
      const gone = last ? 0 : interpolate(f, [outAt - 6, outAt - 1], [0, 1], clamp);
      if (f < inAt - 1 || gone >= 1) return null;
      return (
        <div key={i} style={{ position: "absolute", left: 0, right: 0, top: 68 }}>
          <div style={{ ...(l.soft ? { ...BODY, fontSize: 46, fontWeight: 600, lineHeight: 1.25 } : { ...WIDE, fontSize: 52, lineHeight: 1.2 }), color: "#fff", textWrap: "balance", opacity: 1 - gone, transform: `translateY(${-gone * 24}px)`, ...smear(f, inAt, "up", 8, 50) }}>{l.big}</div>
          {l.small && (!l.smallAt || f >= b(l.smallAt - K)) && <div style={{ ...BODY, fontSize: 34, color: "#ffffffb8", marginTop: 22, opacity: 1 - gone, ...smear(f, (l.smallAt ? b(l.smallAt - K) : inAt) + 4, "up", 8, 40) }}>{l.small}</div>}
        </div>
      );
    })}
  </div>
);

type Clip = "playCall" | "playExchange";

/** a game on screen: the clip, the fingers, and the board dimmed around one row */
const Game: React.FC<{ clip: Clip; k0: number; K: number; game: string; lines: Line[]; dims?: { from: number; to: number }[]; glide?: boolean }> = ({ clip, k0, K, game, lines, dims = [], glide }) => {
  const f = useFrame();
  const b = at(K);
  const t = (f + span(k0, K)) / FPS;
  const m = markers(clip) as unknown as { taps?: [number, number, number][]; focus?: ([number, number, number, number] | null)[]; hud?: number };
  const io = { ...clamp, easing: Easing.inOut(Easing.cubic) };
  // the dim fades in and out around each window; the row and the wallet stay lit
  const dim = Math.max(0, ...dims.map((d) => Math.min(
    interpolate(f, [b(d.from - K), b(d.from - K + 0.5)], [0, 1], io),
    interpolate(f, [b(d.to - K - 0.5), b(d.to - K)], [1, 0], io),
  )));
  const at60 = Math.round(t * 60);
  let r = m.focus?.[Math.max(0, Math.min((m.focus?.length ?? 1) - 1, at60))] ?? null;
  if (glide && m.focus && r) {
    // the lit part travels from one thing to the next instead of jumping
    const near = m.focus.slice(Math.max(0, at60 - 12), at60 + 13).filter(Boolean) as [number, number, number, number][];
    r = [0, 1, 2, 3].map((n) => near.reduce((a, x) => a + x[n], 0) / near.length) as [number, number, number, number];
  }
  const hud = (m.hud ?? 0) * S;
  return (
    <AbsoluteFill style={{ background: C.night, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 0, top: GAME.y, width: GAME.w, height: GAME.h, overflow: "hidden" }}>
        <ClipFrame name={clip} t={t} />
        {dim > 0.001 && r && (
          <div style={{ position: "absolute", left: 0, right: 0, top: hud, bottom: 0, overflow: "hidden" }}>
            <div style={{ position: "absolute", left: r[0] * S - (glide ? 10 : 0), top: r[1] * S - hud - (glide ? 10 : 0), width: r[2] * S + (glide ? 20 : 0), height: r[3] * S + (glide ? 20 : 0), borderRadius: glide ? 14 : 0,
              boxShadow: `0 0 0 3000px rgba(0,0,0,${0.68 * dim})` }} />
          </div>
        )}
      </div>
      <Fingers f={f} taps={(m.taps ?? []).map(([i, x, y]) => ({ at: i / 2 - span(k0, K), x: x * S, y: GAME.y + y * S }))} />
      {/* the screen melts into the caption above it */}
      <div style={{ position: "absolute", left: 0, right: 0, top: GAME.y - 2, height: 2, background: "#ffffff14" }} />
      <Caption f={f} b={b} K={K} game={game} lines={lines} />
    </AbsoluteFill>
  );
};

/* ---------- the red cards: Play it on 64, Paddock exchange on the drop ---------- */

const RedCard: React.FC<{ kicker: string; title: React.ReactNode; size?: number; line?: React.ReactNode; lineStyle?: React.CSSProperties }> = ({ kicker, title, size = 112, line, lineStyle }) => (
  <div style={{ position: "absolute", left: 72, right: 60, top: 700 }}>
    <div style={{ ...MONO, fontSize: 30, color: "#fff" }}>{kicker}</div>
    <div style={{ ...WIDE, fontSize: size, lineHeight: 1.02, color: "#0a0a0a", marginTop: 26 }}>{title}</div>
    {line && <div style={{ ...BODY, fontSize: 50, color: "#0a0a0a", lineHeight: 1.22, marginTop: 34, ...lineStyle }}>{line}</div>}
  </div>
);

/** a ring of light leaves the centre of the red, on the hit */
const Shock: React.FC<{ f: number }> = ({ f }) => {
  const p = interpolate(f, [0, 16], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  if (p >= 1) return null;
  return <div style={{ position: "absolute", left: 540 - 1400 * p, top: 960 - 1400 * p, width: 2800 * p, height: 2800 * p, borderRadius: "50%",
    border: `${Math.max(1, 26 * (1 - p))}px solid #ffd8cc`, opacity: 1 - p, boxShadow: "0 0 60px #fff8" }} />;
};

export const PlayIntro: React.FC = () => {
  const f = useFrame();
  const b = at(69);
  return (
    <AbsoluteFill style={{ background: C.brand, overflow: "hidden" }}>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 80% 60% at 50% 62%, #ff3a1a, transparent 70%)", opacity: 0.6 }} />
      <Shock f={f} />
      <RedCard kicker="03 / 03 · Simplified" title="Play it." line="Two full games per race" lineStyle={smear(f, b(0.6), "left", 10)} />
    </AbsoluteFill>
  );
};

/* ---------- game 1: Call the race, Silverstone, Leclerc's stop on lap 24 ---------- */

const CALL_LINES: Line[] = [
  { from: 71, to: 73, big: "Call the race", small: "The real race, replayed" },
  // the question on the screen is the headline here: the caption steps back
  { from: 73, to: 79.5, big: "It stops and asks you", soft: true },
  { from: 79.5, to: 85, big: "Answer, then say how sure you are", soft: true },
  { from: 85, to: 88.5, big: "The race answers" },
  { from: 88.5, to: 92, big: "You were right: +50", small: "Wrong: −50" },
];

export const PlayCall: React.FC = () => <Game clip="playCall" k0={70} K={71} game="Game 1 of 2" lines={CALL_LINES} glide
  dims={[{ from: 79.7, to: 85 }]} />;

/* ---------- the dive, beats 92-96: the bass is gone and the song is climbing, and the
   camera goes with it, slowly and then all at once, into the red of the next game.
   The drop lands on the red. ---------- */

const NEXT_T = (f: number) => (span(70, 92) + f) / FPS;

export const Breakdown: React.FC = () => {
  const f = useFrame();
  const end = span(92, 96);
  const p = Math.min(1, f / end);
  const dive = Math.pow(p, 3.4);
  const scale = 1 + dive * 9;
  const src = clipFrame("playCall", NEXT_T(f));
  // a real zoom blur: the same frame a little further on, averaged (each layer 1/n over the rest)
  const smearBy = interpolate(p, [0.3, 1], [0, 0.038], clamp);
  const layers = smearBy > 0 ? 14 : 1;
  const flood = interpolate(p, [0.45, 1], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  const last = CALL_LINES[CALL_LINES.length - 1];
  const O = { x: 560, y: 1100 }; // the middle of the track
  return (
    <AbsoluteFill style={{ background: C.night, overflow: "hidden" }}>
      {Array.from({ length: layers }, (_, i) => (
        <div key={i} style={{ position: "absolute", left: 0, top: GAME.y, width: GAME.w, height: GAME.h, transformOrigin: `${O.x}px ${O.y - GAME.y}px`,
          transform: `scale(${scale * (1 + i * smearBy)})`, opacity: 1 / (i + 1) }}>
          <Img src={src} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      ))}
      <div style={{ position: "absolute", left: 0, right: 0, top: GAME.y - 2, height: 2, background: "#ffffff14", opacity: 1 - interpolate(p, [0, 0.3], [0, 1], clamp) }} />
      {/* the caption the last shot left, going first */}
      <div style={{ position: "absolute", left: 72, right: 56, top: CAPTION_Y, opacity: interpolate(p, [0.1, 0.45], [1, 0], clamp), transform: `translateY(${-dive * 300}px)` }}>
        <div style={{ display: "flex", gap: 22 }}>
          <span style={{ ...MONO, fontSize: 30, color: C.lit }}>03 / 03</span>
          <span style={{ ...MONO, fontSize: 30, color: "#ffffff80" }}>Game 1 of 2</span>
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, top: 68 }}>
          <div style={{ ...WIDE, fontSize: 52, lineHeight: 1.2, color: "#fff", textWrap: "balance" }}>{last.big}</div>
          <div style={{ ...BODY, fontSize: 34, color: "#ffffffb8", marginTop: 22 }}>{last.small}</div>
        </div>
      </div>
      {/* the red comes up from where the camera is going */}
      <AbsoluteFill style={{ background: `radial-gradient(circle at ${O.x}px ${O.y}px, ${C.brand} ${flood * 1500 - 300}px, #e1060000 ${flood * 2300}px)` }} />
      <AbsoluteFill style={{ background: C.brand, opacity: interpolate(p, [0.93, 1], [0, 1], clamp) }} />
    </AbsoluteFill>
  );
};

/* ---------- the drop, beats 96-98, and the doors onto the board ---------- */

const DROP_CARD: React.FC<{ f: number; b: (k: number) => number }> = ({ f, b }) => {
  const slam = interpolate(f, [0, 8], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  return (
    <AbsoluteFill style={{ background: C.brand, overflow: "hidden" }}>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 80% 60% at 50% 62%, #ff3a1a, transparent 70%)", opacity: 0.6 }} />
      <Shock f={f} />
      <div style={{ position: "absolute", inset: 0, transform: `scale(${1.5 - 0.5 * slam})`, transformOrigin: "50% 50%", opacity: slam, filter: `blur(${(1 - slam) * 14}px)` }}>
        <RedCard kicker="Game 2 of 2" title={<>Paddock<br />exchange</>} size={104} line="Buy drivers like shares" lineStyle={smear(f, b(0.3), "left", 10)} />
      </div>
    </AbsoluteFill>
  );
};

export const Drop: React.FC = () => {
  const f = useFrame();
  const b = at(96);
  const open = interpolate(f, [b(2), b(2.8)], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const half = (top: boolean) => (
    <AbsoluteFill style={{ clipPath: top ? "inset(0 0 50% 0)" : "inset(50% 0 0 0)", transform: `translateY(${(top ? -1 : 1) * open * 1000}px)` }}>
      <DROP_CARD f={f} b={b} />
    </AbsoluteFill>
  );
  return (
    <AbsoluteFill>
      {half(true)}
      {half(false)}
    </AbsoluteFill>
  );
};

/* ---------- game 2: Paddock exchange, Silverstone, grid to flag ---------- */

const EXCHANGE_LINES: Line[] = [
  { from: 98, to: 101.5, big: "A driver's price is his place" },
  { from: 101.5, to: 105.5, big: "You get 1,000 to buy drivers", small: "100 a tap" },
  { from: 105.5, to: 111.5, big: "Colapinto climbs, you earn" },
  { from: 111.5, to: 115.5, big: "Sell whenever you want", small: "Colapinto: 200 became 600" },
  { from: 115.5, to: 122.5, big: "Verstappen retires: you lose", small: "125 became 0", smallAt: 116.5 },
  { from: 122.5, to: 128, big: "1,000 became 1,300", small: "Beat your friends" },
];

export const PlayExchange: React.FC = () => (
  <Game clip="playExchange" k0={97.5} K={98} game="Game 2 of 2" lines={EXCHANGE_LINES}
    dims={[{ from: 101.6, to: 102.8 }, { from: 103.8, to: 105.8 }, { from: 111.6, to: 114.5 }, { from: 115.8, to: 119 }]} />
);
