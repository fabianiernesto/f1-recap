/**
 * Beats 69-128 in PC format: step 03, the two games, played on camera. Call the
 * race with the whole track on screen; the camera dives into it; the drop lands
 * on the red; and Paddock exchange with the track and the whole board.
 */
import React from "react";
import { AbsoluteFill, Easing, Img, interpolate } from "remotion";
import { ClipFrame, clipFrame, markers } from "../Clip";
import { at, BODY, C, clamp, MONO, WIDE } from "../kit";
import { F, FPS, span, useFrame } from "../time";
import { Column, Cursor, FRAME, S, Say, Seam, SITE, Sting } from "./kit";

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
/** where the race of game 1 sits on the song: its clip starts here (10/11: 70; 11/11: 70.8, so the way in can be read) */
export const CALL_K0 = 70.8;
/** the first game starts here, frozen until then in its window */
const GAME_AT = 73.8;
const expo = Easing.bezier(0.16, 1, 0.3, 1);
const PANEL = { w: 860, h: Math.round((860 * SITE.h) / SITE.w), top: 196, gap: 60 };
const LEFT = (FRAME.w - (PANEL.w * 2 + PANEL.gap)) / 2;
/** the frame of each game shown in its window: Call the race as it starts on 72, the exchange mid-race */
const CALL_AT = span(CALL_K0, GAME_AT) / FPS;
const EXCHANGE_AT = 8;
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

/**
 * How a game is presented (17/11: "que la animación para presentar la actividad 1 y la 2 sean
 * iguales"). Both games go through the same steps, timed from IN in beats: the curtain shuts
 * (0 to 0.67), a line rises on it (0.8), it whips off (2.5) onto the two games side by side
 * with their names (2.75, 2.9), the one that is not playing steps back (4.8), the words make
 * room (5.2) and the one that is playing grows into its place in the film (5.45 to 6.25).
 */
const STEP = { line: 0.8, off: 2.5, label1: 2.75, label2: 2.9, pick: 4.8, words: 5.2, grow: 5.45, grown: 6.25, gone: 6.05 };
const GamesIntro: React.FC<{ IN: number; line: string; play: 0 | 1; callT: number; exchangeT: number }> = ({ IN, line, play, callT, exchangeT }) => {
  const f = useFrame();
  const B = (o: number) => F(IN + o) - F(IN);
  const io = { ...clamp, easing: Easing.inOut(Easing.cubic) };
  // the curtain has shut once its last bar lands (five bars, one frame apart, seven frames each)
  const shut = 4 + 7;
  // the line sits on the curtain, big, and goes up to its place over the games as the curtain whips off
  const up = interpolate(f, [B(STEP.off), B(STEP.off + 0.55)], [0, 1], io);
  const pick = interpolate(f, [B(STEP.pick), B(STEP.pick + 0.3)], [0, 1], io);
  const words = interpolate(f, [B(STEP.words), B(STEP.words + 0.25)], [0, 1], io);
  const grow = interpolate(f, [B(STEP.grow), B(STEP.grown)], [0, 1], io);
  const away = interpolate(f, [B(STEP.grow), B(STEP.gone)], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  const lerp = (a: number, b: number) => a + (b - a) * grow;
  const slot = (i: 0 | 1) => ({ x: LEFT + i * (PANEL.w + PANEL.gap), y: PANEL.top, w: PANEL.w, h: PANEL.h });
  // the one playing grows into the site's place; the other leaves by its own side
  const rect = (i: 0 | 1) => {
    const r = slot(i);
    if (i === play) return { x: lerp(r.x, SITE.x), y: lerp(r.y, SITE.y), w: lerp(r.w, SITE.w), h: lerp(r.h, SITE.h) };
    return { ...r, x: i === 1 ? r.x + away * (FRAME.w - LEFT) : r.x - away * (r.x + r.w) };
  };
  const label = (i: 0 | 1, at: number, n: string, name: string) => (
    <div style={{ position: "absolute", left: slot(i).x, top: PANEL.top + PANEL.h + 36, width: PANEL.w, opacity: (1 - words) * (1 - (i === play ? 0 : 0.55 * pick)), transform: `translateY(${-words * 16}px)` }}>
      <Rise f={f} at={at} style={{ ...MONO, fontSize: 22, color: C.lit }}>{n}</Rise>
      <div style={{ marginTop: 14 }}>
        <Rise f={f} at={at + 2} style={{ ...WIDE, fontSize: 40, lineHeight: 1.1, color: "#fff" }}>{name}</Rise>
      </div>
    </div>
  );
  const win = (i: 0 | 1) => {
    const clip: Clip = i === 0 ? "pPlayCall" : "pPlayExchange";
    const t = i === 0 ? callT : exchangeT;
    if (i === play) return <Window key={i} clip={clip} t={t} rect={rect(i)} edge={pick * (1 - grow) > 0.01 ? `rgba(255,36,21,${pick * (1 - grow)})` : "#ffffff1c"} />;
    return away < 1 ? <Window key={i} clip={clip} t={t} rect={rect(i)} dim={0.6 * pick} style={{ opacity: 1 - away }} /> : null;
  };
  const other: 0 | 1 = play === 0 ? 1 : 0;
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {/* the two games, laid out behind the curtain once it has closed; the one playing on top */}
      {f >= shut && (
        <AbsoluteFill style={{ background: C.night }}>
          {win(other)}
          {label(1, B(STEP.label2), "Game 2 of 2", "Paddock exchange")}
          {win(play)}
          {label(0, B(STEP.label1), "Game 1 of 2", "Call the race")}
          <Seam opacity={interpolate(grow, [0.8, 1], [0, 1], clamp)} />
        </AbsoluteFill>
      )}
      <Sting f={f} inAt={0} offAt={B(STEP.off)} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 92, textAlign: "center", opacity: 1 - words,
        transform: `translateY(${(1 - up) * 408 - words * 16}px) scale(${1 + 0.15 * (1 - up)})` }}>
        <Rise f={f} at={B(STEP.line)} style={{ ...WIDE, fontSize: 44, lineHeight: 1.1, color: "#fff" }}>{line}</Rise>
      </div>
    </AbsoluteFill>
  );
};

/** game 1: in from 67.4, Call the race grows into its place for 73.8 */
export const PLAY_IN = 67.4;
export const PlayIntroPC: React.FC = () => (
  <GamesIntro IN={PLAY_IN} line="Two games, built from the real race." play={0} callT={CALL_AT} exchangeT={EXCHANGE_AT} />
);

/** game 2: the same steps, timed so that Paddock exchange grows into its place on the drop (beat 96) */
export const EXCHANGE_IN = 96 - STEP.grow;
export const EXCHANGE_START = EXCHANGE_IN + STEP.grown + 0.15;
export const ExchangeIntroPC: React.FC = () => (
  // Call the race stays on its result (CALLED IT +50, on screen from 91 to 92.5); the exchange on its first frame
  <GamesIntro IN={EXCHANGE_IN} line="Now the same race becomes a market." play={1} callT={span(CALL_K0, 92) / FPS} exchangeT={0} />
);

/* ---------- game 1: Call the race, Silverstone, Leclerc's stop on lap 24 ---------- */

/** (11/11) the words of game 1, in the order the screen shows it */
const CALL_LINES: Say[] = [
  { from: 74, to: 80.3, big: "The race stops at every turning point", small: "and asks you", smallAt: 76 },
  { from: 80.3, to: 85.8, big: "Answer, and say how sure you are" },
  { from: 85.8, to: 92, big: "Then the race answers", small: "You called it: 50 points", smallAt: 89.4 },
];

export const PlayCallPC: React.FC = () => <Game clip="pPlayCall" k0={CALL_K0} K={GAME_AT} game="Game 1 of 2" name="Call the race" lines={CALL_LINES} glide
  dims={[{ from: 80.5, to: 85.8 }]} />;

/* ---------- game 2: Paddock exchange, Silverstone, grid to flag ---------- */

/** (11/11) the words of game 2 */
const EXCHANGE_LINES: Say[] = [
  { from: 97.3, to: 105.5, big: "A driver's price is his place", small: "You start with 1,000", smallAt: 101.5 },
  { from: 105.5, to: 111.5, big: "Colapinto climbs, and so does your money" },
  { from: 111.5, to: 115.5, big: "Sell whenever you like" },
  { from: 115.5, to: 122.5, big: "Then Verstappen retires", small: "His share drops to zero", smallAt: 116.5 },
  { from: 122.5, to: 128, big: "1,000 became 1,300", small: "Challenge your friends", smallAt: 124 },
];

export const PlayExchangePC: React.FC = () => (
  <Game clip="pPlayExchange" k0={97.5} K={EXCHANGE_START} game="Game 2 of 2" name="Paddock exchange" lines={EXCHANGE_LINES}
    dims={[{ from: 101.6, to: 102.8 }, { from: 103.8, to: 105.8 }, { from: 111.6, to: 114.5 }, { from: 115.8, to: 119 }]} />
);
