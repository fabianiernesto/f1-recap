/**
 * Beats 8-16, four seconds: a flight through the site. Five real screens
 * hang in a dark red space, staggered left and right down a corridor; the
 * camera is already moving on the first frame, passes the home close
 * enough to touch, and flies on past the race, Alfred, the blind test and
 * the pit wall while a red light sweeps each one. Then the space goes dark,
 * one line of light crosses it, and the neon of SIMPLIFIED catches where
 * the title lands on beat 16.
 */
import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, random } from "remotion";
import { useFrame } from "../time";
import { clipFrame } from "../Clip";
import { at, C, clamp, GLOW, MONO, WIDE } from "../kit";

const K0 = 8;
const P = 1600; // perspective: the camera's distance to the screen plane

/** the screens, where they hang in the corridor (z: how far down it) */
const SCREENS = [
  { src: () => clipFrame("home", 0), x: 0, y: 0, z: -420, ry: 0 },
  { src: () => clipFrame("race", 3.4), x: -360, y: -40, z: 1200, ry: 22 },
  { src: () => clipFrame("race", 999), x: 360, y: 30, z: 2700, ry: -22 },
  { src: () => clipFrame("blind", 999), x: -340, y: -20, z: 4200, ry: 20 },
  { src: () => clipFrame("pitwall", 0.4), x: 0, y: 0, z: 5700, ry: 0 },
];
const W = 640, H = 1138; // each screen, 9:16

export const Intro: React.FC = () => {
  const f = useFrame();
  const b = at(K0);
  // the camera: already travelling on frame 0, easing off towards the end
  const travel = interpolate(f, [0, b(6)], [-80, 5150], { ...clamp, easing: Easing.bezier(0.3, 0.12, 0.45, 1) });
  const sway = Math.sin(f / 22) * 4;
  const roll = interpolate(f, [0, b(6.2)], [-3, 2], clamp);
  // the dark, the line of light, the neon
  const dark = interpolate(f, [b(5.2), b(6.4)], [0, 0.92], clamp);
  const scan = interpolate(f, [b(5.6), b(6.8)], [-0.15, 1.15], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const ignite = (() => {
    if (f < b(6.4)) return 0;
    if (f >= b(7.5)) return 1;
    const t = (f - b(6.4)) / (b(7.5) - b(6.4));
    return random(`tube${f}`) < 0.2 + t * 0.7 ? 0.55 + random(`lvl${f}`) * 0.45 : 0.04;
  })();

  return (
    <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
      {/* red fog down the corridor */}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 60% 40% at 50% 50%, #4a0604 0%, #160202 45%, #000 80%)" }} />
      <div style={{ position: "absolute", inset: 0, perspective: P, perspectiveOrigin: "50% 50%" }}>
        <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d", transform: `rotateY(${sway}deg) rotateZ(${roll}deg)` }}>
          {SCREENS.map((s, i) => {
            // depth relative to the camera: positive = nearer than the screen plane
            const z = travel - s.z;
            const near = interpolate(z, [P * 0.38, P * 0.6], [1, 0], clamp); // fade before it reaches the lens
            const far = interpolate(z, [-2300, -1200], [0, 1], clamp); // and rise out of the fog
            const op = near * far;
            if (op <= 0.01) return null;
            // a light sweeping across each screen as the camera passes
            const sweep = interpolate(z, [-1400, P * 0.5], [-0.3, 1.3], clamp);
            return (
              <div key={i} style={{ position: "absolute", left: 540 - W / 2, top: 960 - H / 2, width: W, height: H,
                transform: `translate3d(${s.x}px, ${s.y}px, ${z}px) rotateY(${s.ry}deg)`, opacity: op,
                borderRadius: 30, overflow: "hidden",
                boxShadow: "0 0 0 2px #ffffff1f, 0 60px 160px #000, 0 0 140px #e1060055" }}>
                <Img src={s.src()} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <div style={{ position: "absolute", inset: 0, mixBlendMode: "screen",
                  background: `linear-gradient(115deg, transparent ${sweep * 100 - 18}%, #ff3a2255 ${sweep * 100 - 4}%, #ffb4a066 ${sweep * 100}%, #ff3a2255 ${sweep * 100 + 4}%, transparent ${sweep * 100 + 18}%)` }} />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, #e1060018, transparent 40%, #00000066)" }} />
              </div>
            );
          })}
        </div>
      </div>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 80% 60% at 50% 50%, transparent 50%, #000000cc 100%)" }} />
      <AbsoluteFill style={{ background: "#000", opacity: dark }} />

      {/* one line of light crosses the dark, at the height the title will take */}
      {scan > -0.15 && scan < 1.15 && (
        <div style={{ position: "absolute", top: 880, height: 4, left: `${scan * 100 - 30}%`, width: "30%",
          background: `linear-gradient(90deg, transparent, ${C.lit}, #ffd2c8)`, boxShadow: `0 0 30px ${C.lit}, 0 0 80px #e10600` }} />
      )}

      {/* the title block, laid out exactly as on beat 16 so the tube is where the word lands */}
      <div style={{ position: "absolute", left: 66, right: 30, top: 700 }}>
        <div style={{ ...MONO, fontSize: 30, marginBottom: 34, opacity: 0 }}>Formula 1 · Season 2026</div>
        <div style={{ ...WIDE, fontSize: 102 }}>
          <div style={{ opacity: 0 }}>Every race</div>
          <div style={{ ...GLOW, opacity: ignite, filter: `brightness(${0.7 + ignite * 0.4})` }}>Simplified</div>
        </div>
      </div>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 70% 40% at 50% 46%, #e1060030, transparent 70%)", opacity: ignite }} />
    </AbsoluteFill>
  );
};
