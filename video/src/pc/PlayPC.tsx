/**
 * Beats 69-128 in PC format: step 03, the two games, played on camera. Call the
 * race with the whole track on screen; the camera dives into it; the drop lands
 * on the red; and Paddock exchange with the track and the whole board.
 */
import React from "react";
import { AbsoluteFill, Easing, Img, interpolate } from "remotion";
import { ClipFrame, clipFrame, markers } from "../Clip";
import { at, BODY, C, clamp, MONO, smear, WIDE } from "../kit";
import { F, FPS, span, useFrame } from "../time";
import { Column, Cursor, FRAME, S, Say, Seam, SITE } from "./kit";

type Clip = "pPlayCall" | "pPlayExchange";

/** a game on screen: the clip, the mouse, and the board dimmed around one row */
const Game: React.FC<{ clip: Clip; k0: number; K: number; game: string; name: string; lines: Say[]; dims?: { from: number; to: number }[]; glide?: boolean; head?: number }> = ({ clip, k0, K, game, name, lines, dims = [], glide, head }) => {
  const f = useFrame();
  const b = at(K);
  const t = (f + span(k0, K)) / FPS;
  const m = markers(clip) as unknown as { taps?: [number, number, number][]; focus?: ([number, number, number, number] | null)[] };
  const io = { ...clamp, easing: Easing.inOut(Easing.cubic) };
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
  return (
    <AbsoluteFill style={{ background: C.night, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: SITE.x, top: SITE.y, width: SITE.w, height: SITE.h, overflow: "hidden" }}>
        <ClipFrame name={clip} t={t} />
        {dim > 0.001 && r && (
          <div style={{ position: "absolute", left: r[0] * S - (glide ? 10 : 0), top: r[1] * S - (glide ? 10 : 0), width: r[2] * S + (glide ? 20 : 0), height: r[3] * S + (glide ? 20 : 0), borderRadius: glide ? 12 : 0,
            boxShadow: `0 0 0 3000px rgba(0,0,0,${0.62 * dim})` }} />
        )}
      </div>
      <Seam />
      <Cursor f={f} taps={(m.taps ?? []).map(([i, x, y]) => ({ at: i / 2 - span(k0, K), x: SITE.x + x * S, y: SITE.y + y * S }))} />
      <Column f={f} at={head === undefined ? 0 : b(head - K)} n="03" tag={game} name={name} lines={lines} b={b} k0={K} />
    </AbsoluteFill>
  );
};

/* ---------- the red cards: Play it, and Paddock exchange on the drop ---------- */

const RedCard: React.FC<{ kicker: string; title: React.ReactNode; size?: number; line?: React.ReactNode; lineStyle?: React.CSSProperties }> = ({ kicker, title, size = 170, line, lineStyle }) => (
  <div style={{ position: "absolute", left: 120, right: 120, top: 300 }}>
    <div style={{ ...MONO, fontSize: 30, color: "#fff" }}>{kicker}</div>
    <div style={{ ...WIDE, fontSize: size, lineHeight: 1.04, color: "#0a0a0a", marginTop: 34 }}>{title}</div>
    {line && <div style={{ ...BODY, fontSize: 54, color: "#0a0a0a", lineHeight: 1.22, marginTop: 44, ...lineStyle }}>{line}</div>}
  </div>
);

/* ---------- into the games, beats 68-72 (10/11) ----------
   Ernesto, 10/11: the change from scrolling to the games has to be felt ("usa una cortina
   de cambio"), with a clearer line than "Play it". Turned down on the way: a hard cut onto
   a flat red with a ring and blades of light; red panels wiping across; the Activities page
   and a click; F1 start lights; the two games side by side on their own.
   Now: the site's own change curtain (PageFX, "the sting": five slanted black bars that rip
   in from the right, each dragging a hot edge, one white frame on the impact), with the line
   where the site puts its mark (no R//S in the film). It whips off to the left onto the two
   games side by side, each with its name; the second dims and the first grows into its
   place in the film, frozen on the very frame the game starts on (beat 72, where the song
   turns its phrase), so the hand-over has no seam. */
const IN = 67.4;
/** where the race of game 1 sits on the song: its clip starts here (10/11: 70; 11/11: 70.8, so the way in can be read) */
export const CALL_K0 = 70.8;
/** the first game starts here, frozen until then in its window */
const GAME_AT = 73.8;
/** frames (30fps units) from the start of the scene to a beat */
const B = (k: number) => F(k) - F(IN);
const expo = Easing.bezier(0.16, 1, 0.3, 1);
const PANEL = { w: 860, h: Math.round((860 * SITE.h) / SITE.w), top: 196, gap: 60 };
const LEFT = (FRAME.w - (PANEL.w * 2 + PANEL.gap)) / 2;
/** the frame of each game shown in its window: Call the race as it starts on 72, the exchange mid-race */
const CALL_AT = span(CALL_K0, GAME_AT) / FPS;
const EXCHANGE_AT = 8;
/** the curtain: in from 68, the line on it from 68.8, off from 69.7 */
const CUT = { in: 67.4, words: 68.2, off: 69.9 };
const BARS = 5;

/** the site's change curtain (web/app/globals.css, "the sting"), redrawn for the film */
const Curtain: React.FC<{ f: number }> = ({ f }) => (
  <div style={{ position: "absolute", left: "-14%", right: "-14%", top: "-8%", bottom: "-8%", display: "flex", transform: "skewX(-13deg)" }}>
    {Array.from({ length: BARS }, (_, i) => {
      // in from beyond the right edge, the far one first; off beyond the left edge, the near one first
      const a = B(CUT.in) + i * 1.0;
      const inP = interpolate(f, [a, a + 7], [0, 1], { ...clamp, easing: Easing.bezier(0.25, 0.9, 0.25, 1) });
      const o = B(CUT.off) + (BARS - 1 - i) * 0.8;
      const outP = interpolate(f, [o, o + 7], [0, 1], { ...clamp, easing: Easing.bezier(0.6, 0, 0.9, 0.3) });
      const x = ((BARS - i) * 100 + 30) * (1 - inP) - ((i + 1) * 100 + 30) * outP;
      // each bar drags a hot edge, which burns off once it lands
      const hot = 1 - interpolate(f, [a + 5, a + 14], [0, 1], clamp);
      return (
        <div key={i} style={{ position: "relative", flex: 1, background: "#000", transform: `translateX(${x}%)` }}>
          {hot > 0 && <div style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: "44%", opacity: hot,
            background: "linear-gradient(90deg, #e1060000, #e1060033 52%, #e10600d9 88%, #ffe3e1 100%)" }} />}
        </div>
      );
    })}
  </div>
);

/** a line that comes up from behind its own edge */
const Rise: React.FC<{ f: number; at: number; style: React.CSSProperties; children: React.ReactNode }> = ({ f, at: t, style, children }) => {
  const p = interpolate(f, [t, t + 12], [0, 1], { ...clamp, easing: expo });
  return (
    <div style={{ ...style, overflow: "hidden", padding: "0.12em 0 0.22em", margin: "-0.12em 0 -0.22em" }}>
      <div style={{ transform: `translateY(${(1 - p) * 118}%)` }}>{children}</div>
    </div>
  );
};

/** a game's window */
const Window: React.FC<{ clip: Clip; t: number; rect: { x: number; y: number; w: number; h: number }; dim?: number; edge?: string; style?: React.CSSProperties }> = ({ clip, t, rect, dim = 0, edge = "#ffffff1c", style }) => (
  <div style={{ position: "absolute", left: rect.x, top: rect.y, width: rect.w, height: rect.h, overflow: "hidden", background: C.night, ...style }}>
    <div style={{ position: "absolute", inset: 0, filter: dim > 0 ? `brightness(${1 - dim})` : undefined }}>
      <ClipFrame name={clip} t={t} />
    </div>
    <div style={{ position: "absolute", inset: 0, boxShadow: `inset 0 0 0 ${edge === "#ffffff1c" ? 1 : 2}px ${edge}` }} />
  </div>
);

export const PlayIntroPC: React.FC = () => {
  const f = useFrame();
  const io = { ...clamp, easing: Easing.inOut(Easing.cubic) };
  // one faint white frame as the last bar lands, the site's impact, kept low for the film
  const shut = B(CUT.in) + (BARS - 1) * 1.0 + 7;
  const flash = interpolate(f, [shut - 2, shut, shut + 4], [0, 0.16, 0], clamp);
  // the line sits on the curtain, big, and goes up to its place over the games as the curtain whips off
  const up = interpolate(f, [B(CUT.off), B(CUT.off + 0.55)], [0, 1], io);
  // the first game is the one: the second steps back, the words make room, the first grows into its place
  const pick = interpolate(f, [B(72.2), B(72.5)], [0, 1], io);
  const words = interpolate(f, [B(72.6), B(72.85)], [0, 1], io);
  const grow = interpolate(f, [B(72.85), B(73.65)], [0, 1], io);
  const away = interpolate(f, [B(72.85), B(73.45)], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  const lerp = (a: number, b: number) => a + (b - a) * grow;
  const call = { x: lerp(LEFT, SITE.x), y: lerp(PANEL.top, SITE.y), w: lerp(PANEL.w, SITE.w), h: lerp(PANEL.h, SITE.h) };
  const right = { x: LEFT + PANEL.w + PANEL.gap + away * (FRAME.w - LEFT), y: PANEL.top, w: PANEL.w, h: PANEL.h };
  const label = (x: number, at: number, n: string, name: string, dimBy: number) => (
    <div style={{ position: "absolute", left: x, top: PANEL.top + PANEL.h + 36, width: PANEL.w, opacity: (1 - words) * (1 - dimBy), transform: `translateY(${-words * 16}px)` }}>
      <Rise f={f} at={at} style={{ ...MONO, fontSize: 22, color: C.lit }}>{n}</Rise>
      <div style={{ marginTop: 14 }}>
        <Rise f={f} at={at + 2} style={{ ...WIDE, fontSize: 40, lineHeight: 1.1, color: "#fff" }}>{name}</Rise>
      </div>
    </div>
  );
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {/* the two games, laid out behind the curtain once it has closed */}
      {f >= shut && (
        <AbsoluteFill style={{ background: C.night }}>
          {away < 1 && <Window clip="pPlayExchange" t={EXCHANGE_AT} rect={right} dim={0.6 * pick} style={{ opacity: 1 - away }} />}
          {label(LEFT + PANEL.w + PANEL.gap, B(70.3), "Game 2 of 2", "Paddock exchange", 0.55 * pick)}
          <Window clip="pPlayCall" t={CALL_AT} rect={call} edge={pick * (1 - grow) > 0.01 ? `rgba(255,36,21,${pick * (1 - grow)})` : "#ffffff1c"} />
          {label(LEFT, B(70.15), "Game 1 of 2", "Call the race", 0)}
          <Seam opacity={interpolate(grow, [0.8, 1], [0, 1], clamp)} />
        </AbsoluteFill>
      )}
      <Curtain f={f} />
      <AbsoluteFill style={{ background: "#fff", opacity: flash }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 92, textAlign: "center", opacity: 1 - words,
        transform: `translateY(${(1 - up) * 408 - words * 16}px) scale(${1 + 0.15 * (1 - up)})` }}>
        <Rise f={f} at={B(CUT.words)} style={{ ...WIDE, fontSize: 44, lineHeight: 1.1, color: "#fff" }}>Two games, built from the real race.</Rise>
      </div>
    </AbsoluteFill>
  );
};

/* ---------- game 1: Call the race, Silverstone, Leclerc's stop on lap 24 ---------- */

/** (11/11) the words of game 1, in the order the screen shows it */
const CALL_LINES: Say[] = [
  { from: 74, to: 80.3, big: "The race stops at every turning point", small: "and asks you", smallAt: 76 },
  { from: 80.3, to: 85.8, big: "Answer, and say how sure you are" },
  { from: 85.8, to: 92, big: "Then the race answers", small: "You called it: 50 points", smallAt: 89.4 },
];

export const PlayCallPC: React.FC = () => <Game clip="pPlayCall" k0={CALL_K0} K={GAME_AT} game="Game 1 of 2" name="Call the race" lines={CALL_LINES} glide
  dims={[{ from: 80.5, to: 85.8 }]} />;

/* ---------- the dive, beats 92-96: the song climbs, the camera goes with it, into the red ---------- */

export const BreakdownPC: React.FC = () => {
  const f = useFrame();
  const end = span(92, 96);
  const p = Math.min(1, f / end);
  const dive = Math.pow(p, 3.4);
  const scale = 1 + dive * 9;
  const src = clipFrame("pPlayCall", (span(CALL_K0, 92) + f) / FPS);
  // a real zoom blur: the same frame a little further on, averaged (each layer 1/n over the rest)
  const smearBy = interpolate(p, [0.3, 1], [0, 0.038], clamp);
  const layers = smearBy > 0 ? 14 : 1;
  const flood = interpolate(p, [0.45, 1], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  const last = CALL_LINES[CALL_LINES.length - 1];
  const O = { x: SITE.x + 690, y: 620 }; // the middle of the track
  return (
    <AbsoluteFill style={{ background: C.night, overflow: "hidden" }}>
      {Array.from({ length: layers }, (_, i) => (
        <div key={i} style={{ position: "absolute", left: SITE.x, top: SITE.y, width: SITE.w, height: SITE.h, transformOrigin: `${O.x - SITE.x}px ${O.y - SITE.y}px`,
          transform: `scale(${scale * (1 + i * smearBy)})`, opacity: 1 / (i + 1) }}>
          <Img src={src} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      ))}
      <Seam opacity={1 - interpolate(p, [0, 0.3], [0, 1], clamp)} />
      {/* the words the last shot left, going first */}
      <div style={{ position: "absolute", inset: 0, opacity: interpolate(p, [0.1, 0.45], [1, 0], clamp), transform: `translateX(${-dive * 300}px)` }}>
        <Column f={9999} at={0} n="03" tag="Game 1 of 2" name="Call the race" lines={[{ ...last, from: 0, to: 1, smallAt: undefined }]} b={(k) => k} k0={0} />
      </div>
      {/* the red comes up from where the camera is going */}
      <AbsoluteFill style={{ background: `radial-gradient(circle at ${O.x}px ${O.y}px, ${C.brand} ${flood * 1500 - 300}px, #e1060000 ${flood * 2300}px)` }} />
      <AbsoluteFill style={{ background: C.brand, opacity: interpolate(p, [0.93, 1], [0, 1], clamp) }} />
    </AbsoluteFill>
  );
};

/* ---------- the drop, beats 96-98, and the doors onto the board ---------- */

const DropCard: React.FC<{ f: number; b: (k: number) => number }> = ({ f, b }) => {
  const slam = interpolate(f, [0, 8], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  return (
    <AbsoluteFill style={{ background: C.brand, overflow: "hidden" }}>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 70% 70% at 55% 55%, #ff3a1a, transparent 70%)", opacity: 0.6 }} />
      <div style={{ position: "absolute", inset: 0, transform: `scale(${1.5 - 0.5 * slam})`, transformOrigin: "50% 50%", opacity: slam, filter: `blur(${(1 - slam) * 14}px)` }}>
        <RedCard kicker="Game 2 of 2" title={<>Paddock<br />exchange</>} size={140} line="Buy drivers like shares" lineStyle={smear(f, b(0.3), "left", 10)} />
      </div>
    </AbsoluteFill>
  );
};

export const DropPC: React.FC = () => {
  const f = useFrame();
  const b = at(96);
  const open = interpolate(f, [b(2), b(2.8)], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const half = (top: boolean) => (
    <AbsoluteFill style={{ clipPath: top ? "inset(0 0 50% 0)" : "inset(50% 0 0 0)", transform: `translateY(${(top ? -1 : 1) * open * 600}px)` }}>
      <DropCard f={f} b={b} />
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

/** (11/11) the words of game 2 */
const EXCHANGE_LINES: Say[] = [
  { from: 98.9, to: 105.5, big: "A driver's price is his place", small: "You start with 1,000", smallAt: 101.5 },
  { from: 105.5, to: 111.5, big: "Colapinto climbs, and so does your money" },
  { from: 111.5, to: 115.5, big: "Sell whenever you like" },
  { from: 115.5, to: 122.5, big: "Then Verstappen retires", small: "His share drops to zero", smallAt: 116.5 },
  { from: 122.5, to: 128, big: "1,000 became 1,300", small: "Challenge your friends", smallAt: 124 },
];

export const PlayExchangePC: React.FC = () => (
  <Game clip="pPlayExchange" k0={97.5} K={98} game="Game 2 of 2" name="Paddock exchange" lines={EXCHANGE_LINES} head={98.6}
    dims={[{ from: 101.6, to: 102.8 }, { from: 103.8, to: 105.8 }, { from: 111.6, to: 114.5 }, { from: 115.8, to: 119 }]} />
);
