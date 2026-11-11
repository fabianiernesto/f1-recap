import React from "react";
import { AbsoluteFill, Html5Audio, Img, interpolate, staticFile } from "remotion";
import { clipFrame } from "../Clip";
import { BODY, C, clamp, GLOW, MONO, WIDE } from "../kit";
import { END, F, Seq, SCALE, useFrame, X } from "../time";
import { BuiltPC, EndCardPC } from "./BuiltPC";
import { BeatLightPC, FinishPC } from "./kit";
import { IntroPC, LightsPC } from "./Opening";
import { BreakdownPC, DropPC, PlayCallPC, PlayExchangePC, PlayIntroPC } from "./PlayPC";
import { ScrolledPC } from "./ScrolledPC";

const SCENES: [number, number, React.FC][] = [
  [8, 16, IntroPC],
  [16, 32, LightsPC],
  [32, 69, ScrolledPC],
  // (10/11) the site's change curtain over the end of Scrolled, then the two games;
  // (11/11) slower, so it can be read: 67.4-73.8, and the first game starts on 73.8
  [67.4, 73.8, PlayIntroPC],
  [73.8, 92, PlayCallPC],
  [92, 96, BreakdownPC],
  [98, 112 + X, PlayExchangePC],
  // after the exchange, so that its doors open onto the board
  [96, 98.8, DropPC],
  [112 + X, 144 + X, BuiltPC],
];

export const ShowcasePC: React.FC = () => {
  const f = useFrame();
  const fadeOut = interpolate(f, [END - 36, END - 1], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {SCENES.map(([a, b, S]) => (
        <Seq key={a} from={F(a)} durationInFrames={F(b) - F(a)}>
          <S />
        </Seq>
      ))}
      <Seq from={F(144 + X)} durationInFrames={END - F(144 + X)}>
        <EndCardPC />
      </Seq>
      <BeatLightPC />
      <FinishPC />
      <AbsoluteFill style={{ background: "#000", opacity: fadeOut }} />
      <Html5Audio src={staticFile("music/soundtrack.wav")} volume={(fr) => interpolate(fr / SCALE, [END - 40, END - 1], [1, 0], clamp)} />
    </AbsoluteFill>
  );
};

/** the cover for the PC film: the title on the left, the real site fanned out on the right */
const COVER = [
  { src: () => clipFrame("pNav", 0), x: 1090, y: 150, r: -6, z: 1 },
  { src: () => clipFrame("pPlayCall", 6.6), x: 1500, y: 130, r: 4, z: 2 },
  { src: () => clipFrame("pRaceCard", 2.4), x: 1110, y: 560, r: 4, z: 2 },
  { src: () => clipFrame("pPlayExchange", 7), x: 1530, y: 570, r: -4, z: 3 },
];

export const ThumbnailPC: React.FC = () => (
  <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
    <AbsoluteFill style={{ background: "radial-gradient(ellipse 60% 70% at 72% 50%, #5a0805 0%, #1a0202 55%, #000 85%)" }} />
    {COVER.map((s, i) => (
      <div key={i} style={{ position: "absolute", left: s.x - 240, top: s.y, width: 480, height: 370, borderRadius: 14, overflow: "hidden", zIndex: s.z, transform: `rotate(${s.r}deg)`, boxShadow: "0 0 0 2px #ffffff22, 0 40px 100px #000, 0 0 80px #e1060066" }}>
        <Img src={s.src()} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
    ))}
    <div style={{ position: "absolute", left: 80, top: 360, zIndex: 10 }}>
      <div style={{ ...WIDE, fontSize: 76, lineHeight: 1.08, color: "#fff" }}>Every race</div>
      <div style={{ ...WIDE, fontSize: 76, lineHeight: 1.08, ...GLOW }}>Simplified</div>
      <div style={{ ...BODY, fontSize: 31, lineHeight: 1.3, color: "#ffffffe0", marginTop: 44, whiteSpace: "nowrap" }}>Every 2026 Grand Prix, rebuilt from the data</div>
      <div style={{ ...MONO, fontSize: 20, color: C.lit, marginTop: 40, whiteSpace: "nowrap" }}>Built from scratch by one person</div>
    </div>
  </AbsoluteFill>
);
