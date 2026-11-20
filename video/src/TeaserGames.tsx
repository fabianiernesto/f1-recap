/**
 * Second teaser (19/11/2026), posted Friday 20/11 at 11:00. The same build and drop as the approved teaser
 * (Teaser.tsx: the car, the countdown, the 20 circuits, "Rush") landing on 5 DAYS; then the real website,
 * recorded on 19/11 from the build that is live (clips tHome, tWeek, tRaceCard, tPlayCall, tPlayExchange in
 * scripts/capture.mjs): what it is, then the two games played on screen, then the sign-off.
 * Ernesto, 19/11: "muestra más de la web sin miedo, que genere hype". Versions: v1 drawn cards (38 s), v2 a tour of the site, v3/v4 the recorded games; now the games told as animations (TeaserGamesArt.tsx). The first version
 * is in the 19/11 session scratchpad, teaser2/TeaserGames_v1.tsx.
 *
 * Beats (114 BPM): drop on 24, days to 32, what it is 32 to 40 (three shots), "then you play it" 40 to 42,
 * Call the race 42 to 58, Paddock Exchange 58 to 74, sign-off 74, the song fades from 80, out on 88.
 */
import React from "react";
import { AbsoluteFill, Html5Audio, interpolate, random, staticFile, useCurrentFrame } from "remotion";
import { BODY, C, GLOW, WIDE, clamp, out } from "./kit";
import { ExchangeArt, GameHead } from "./TeaserGamesArt";
import { CallArt } from "./TeaserCallArt";
import {
  BASS, Build, CAR_H, CLIMB, CX, Car, DROP, End, Header, KICK, Lap, Streaks, TEASER_FPS,
  TeaserProps, beats, carTop, enter, fb, ring,
} from "./Teaser";

/* 19/11, Ernesto: "solo hables de los juegos": from the days screen straight into the two games, no site tour */
const S = { call: 32, exch: 50, end: 68, fade: 74, out: 82 };
export const TEASER_GAMES_END = Math.round(fb(S.out));

/** posted Friday 20/11/2026 at 11:00: 105 days since 7 August, launch on day 110 (Wednesday 25/11) */
export const TEASER_GAMES_PROPS: TeaserProps = {
  days: 105, total: 110, headline: "Until Racing Simplified", live: "goes live", day: "Fri 20.11",
  line: "Built one night at a time since 7 August.", launch: "Live 25 Nov",
  tagline: "The website that explains every F1 race,\nand lets you play it.",
  soon: "In 5 days", when: "Wednesday 25.11",
};

export const CALL_LINES: [number, string][] = [[32.3, "The race replays on the real track."], [37, "It stops. You call what happens next."], [44.5, "Right wins points. Wrong loses them."]];
export const EXCH_LINES: [number, string][] = [[50.3, "Every driver is a share, priced by his place."], [55.5, "Buy cheap. Sell when he climbs."], [64.5, "A retirement is worth nothing."]];
export const CALL_PUNCH = [37, 44.5];
export const EXCH_PUNCH = [58, 65];

/* ---------- the film ---------- */
export const TeaserGames: React.FC<TeaserProps> = (p) => {
  const f = useCurrentFrame();
  const d = fb(DROP);
  const cuts = [fb(S.exch), fb(S.end)];
  const knocks = [...CALL_PUNCH, ...EXCH_PUNCH].map(fb);
  const hits = [fb(BASS), ...beats(BASS + 2, CLIMB, 2), ...beats(CLIMB, DROP - 2), ...beats(DROP - 2, DROP, 0.5)];
  const flash = f < d ? ring(f, hits, 7) * interpolate(f, [fb(BASS), d], [0.25, 0.5], clamp) + ring(f, [fb(BASS)], 12) * 0.6 : ring(f, cuts, 7) * 0.35 + ring(f, knocks, 7) * 0.25;
  const big = ring(f, [d], 6);
  const amp = (f < d ? interpolate(f, [fb(CLIMB), d], [2, 9], clamp) + ring(f, hits, 6) * 5 : 0) + ring(f, [d], 10) * 22 + ring(f, cuts, 6) * 8 + ring(f, knocks, 6) * 7;
  const sx = (random(`sx${f}`) - 0.5) * 2 * amp;
  const sy = (random(`sy${f}`) - 0.5) * 2 * amp;
  const breathe = 0.5 + 0.5 * Math.sin((f / TEASER_FPS) * Math.PI * 2 * (114 / 60 / 4));
  const glow = f < d ? interpolate(f, [0, fb(BASS), d], [0.4, 0.55, 1], clamp) * (0.75 + 0.25 * breathe) : interpolate(f, [d, d + 30], [0.6, 0], clamp);
  const top = carTop(f);
  const drag = f < fb(BASS) ? 0.06 : f < fb(CLIMB) ? 0.14 : f < d ? 0.24 : 0.5;
  const carBlur = interpolate(f, [0, fb(BASS)], [10, 0], clamp);
  const streak = f < d ? interpolate(f, [fb(BASS), fb(CLIMB), d], [0, 0.45, 1], clamp)
    : interpolate(f, [d, d + 40], [1, 0.12], clamp);
  const lastCut = [...cuts].reverse().find((c) => f >= c);
  const blade = lastCut !== undefined ? interpolate(f, [lastCut, lastCut + 8], [0, 1], clamp) : 1;
  const end = interpolate(f, [TEASER_GAMES_END - 40, TEASER_GAMES_END - 1], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ background: C.night, overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `translate(${sx}px, ${sy}px)` }}>
        <AbsoluteFill style={{ background: `radial-gradient(ellipse 70% 45% at 50% ${Math.min(100, (top + CAR_H * 0.5) / 13.5)}%, #e10600 0%, #5a0805 35%, transparent 75%)`, opacity: glow * 0.55 }} />
        <Streaks f={f} amount={streak} />
        <Build f={f} p={p} />
        {f < d + 12 && <Car top={top} drag={drag} blur={carBlur} />}
        {f >= d && f < fb(S.call) && (
          <AbsoluteFill style={{ opacity: interpolate(f, [fb(S.call) - 14, fb(S.call)], [1, 0], clamp) }}><Lap f={f} p={p} /></AbsoluteFill>
        )}
        {f >= fb(S.call) && f < fb(S.exch) && (
          <AbsoluteFill><GameHead f={f} at={S.call} kick="Game 01" lines={CALL_LINES} title={<>Call the <span style={GLOW}>race</span></>} /><CallArt f={f} s={S.call} /></AbsoluteFill>
        )}
        {f >= fb(S.exch) && f < fb(S.end) && (
          <AbsoluteFill><GameHead f={f} at={S.exch} kick="Game 02" lines={EXCH_LINES} title={<>Paddock <span style={GLOW}>Exchange</span></>} /><ExchangeArt f={f} s={S.exch} /></AbsoluteFill>
        )}
        {f >= fb(S.end) && <End f={f} p={p} at={S.end} />}
        {f >= d && <Header f={f} p={p} />}
      </AbsoluteFill>
      {blade < 1 && (
        <div style={{ position: "absolute", left: 0, right: 0, top: -40 + blade * 1430, height: 3, background: "#fff",
          boxShadow: `0 0 18px #fff, 0 0 50px ${C.lit}, 0 0 120px ${C.lit}`, opacity: 1 - blade * 0.3 }} />
      )}
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 55% 45% at 50% ${Math.max(20, Math.min(90, (top + CAR_H * 0.45) / 13.5))}%, ${C.lit} 0%, #e1060055 45%, transparent 80%)`, opacity: Math.min(1, flash), mixBlendMode: "screen" }} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 80% 70% at 50% 40%, #fff 0%, #ffd2c8 40%, #e10600 100%)", opacity: Math.min(1, big) * 0.95, mixBlendMode: "screen" }} />
      <AbsoluteFill style={{ background: "#000", opacity: end }} />
      <Html5Audio src={staticFile("music/teaser-rush-long.wav")} volume={(fr) => Math.pow(1 - interpolate(fr, [fb(S.fade), TEASER_GAMES_END - 1], [0, 1], clamp), 1.6)} />
    </AbsoluteFill>
  );
};
