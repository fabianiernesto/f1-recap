/**
 * The LinkedIn cover for the film: 1080x1920, with everything that matters
 * inside the centre 1080x1350, which is what the feed shows of a vertical
 * video. Four real screens of the site fanned out, the title lit above them.
 */
import React from "react";
import { AbsoluteFill, Img } from "remotion";
import { clipFrame } from "./Clip";
import { BODY, C, GLOW, MONO, WIDE } from "./kit";

const SCREENS = [
  { src: () => clipFrame("home", 0), x: 210, y: 960, r: -11, z: 1 },
  { src: () => clipFrame("race", 1.4), x: 420, y: 900, r: -4, z: 3 },
  { src: () => clipFrame("call", 999), x: 660, y: 910, r: 4, z: 2 },
  { src: () => clipFrame("exchange", 999), x: 870, y: 970, r: 11, z: 1 },
];
const W = 280, H = 498;

export const Thumbnail: React.FC = () => (
  <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
    <AbsoluteFill style={{ background: "radial-gradient(ellipse 80% 45% at 50% 62%, #5a0805 0%, #1a0202 55%, #000 85%)" }} />
    {/* the fan of real screens */}
    {SCREENS.map((s, i) => (
      <div key={i} style={{ position: "absolute", left: s.x - W / 2, top: s.y, width: W, height: H, borderRadius: 24, overflow: "hidden",
        zIndex: s.z, transform: `rotate(${s.r}deg)`, boxShadow: "0 0 0 2px #ffffff22, 0 50px 120px #000, 0 0 90px #e1060066" }}>
        <Img src={s.src()} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
    ))}
    <AbsoluteFill style={{ background: "linear-gradient(180deg, #000 0%, #000000e0 30%, transparent 46%, transparent 72%, #000000f0 82%, #000 100%)" }} />
    {/* the title, inside the feed's 4:5 crop (y 285 to 1635) */}
    <div style={{ position: "absolute", left: 0, right: 0, top: 430, textAlign: "center" }}>
      <div style={{ ...WIDE, fontSize: 96, color: "#fff" }}>Every race</div>
      <div style={{ ...WIDE, fontSize: 96, ...GLOW }}>Simplified</div>
      <div style={{ ...BODY, fontSize: 40, color: "#ffffffe0", marginTop: 30 }}>Every 2026 Grand Prix, rebuilt from the data</div>
    </div>
    <div style={{ position: "absolute", left: 0, right: 0, top: 1545, zIndex: 10, textAlign: "center", ...MONO, fontSize: 30, color: "#fff", textShadow: "0 0 20px #000, 0 0 40px #000" }}>
      Built from scratch by one person
    </div>
  </AbsoluteFill>
);
