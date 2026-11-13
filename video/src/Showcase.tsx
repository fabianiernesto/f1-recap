import React from "react";
import { AbsoluteFill, Html5Audio, interpolate, staticFile } from "remotion";
import { BeatLight, BeatPunch } from "./BeatFX";
import { clamp, Finish } from "./kit";
import { Intro } from "./scenes/Intro";
import { LightsOut } from "./scenes/LightsOut";
import { Scrolled } from "./scenes/Scrolled";
import { Breakdown, Drop, PlayCall, PlayExchange, PlayIntro } from "./scenes/Play";
import { Built, EndCard } from "./scenes/Built";
import { END, F, useFrame, Seq, SCALE, X } from "./time";

const SCENES: [number, number, React.FC][] = [
  [8, 16, Intro],
  [16, 32, LightsOut],
  [32, 69, Scrolled],
  [69, 71, PlayIntro],
  [71, 92, PlayCall],
  [92, 96, Breakdown],
  [98, 112 + X, PlayExchange],
  // after the exchange, so that its doors open onto the board
  [96, 98.8, Drop],
  [112 + X, 144 + X, Built],
];

export const Showcase: React.FC = () => {
  const f = useFrame();
  const fadeOut = interpolate(f, [END - 36, END - 1], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <BeatPunch>
      {SCENES.map(([a, b, S]) => (
        <Seq key={a} from={F(a)} durationInFrames={F(b) - F(a)}>
          <S />
        </Seq>
      ))}
      <Seq from={F(144 + X)} durationInFrames={END - F(144 + X)}>
        <EndCard />
      </Seq>
      </BeatPunch>
      <BeatLight />
      <Finish />
      <AbsoluteFill style={{ background: "#000", opacity: fadeOut }} />
      <Html5Audio
        src={staticFile("music/soundtrack.wav")}
        volume={(fr) => interpolate(fr / SCALE, [END - 40, END - 1], [1, 0], clamp)}
      />
    </AbsoluteFill>
  );
};
