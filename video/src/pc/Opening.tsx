/**
 * Beats 8-32 in PC format: the flight through the site, the name and what this
 * is, and 01 Pick a race on the real home.
 */
import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, random } from "remotion";
import { ClipFrame, clipFrame, markers } from "../Clip";
import { at, Blur, BODY, C, clamp, ease, Flash, GLOW, hum, out, shake, smear, WIDE } from "../kit";
import { Seq, span, useFrame } from "../time";
import { Column, Cursor, S, Say, Seam, SITE } from "./kit";

/* ---------- beats 8-16: the corridor of real screens, then the neon ---------- */

const P = 1600; // perspective: the camera's distance to the screen plane
const SCREENS = [
  { src: () => clipFrame("pNav", 0), z: -420 },
  { src: () => clipFrame("pRaceCard", 0), z: 1200 },
  { src: () => clipFrame("pRaceCard", 999), z: 2700 },
  { src: () => clipFrame("pPlayCall", 6.6), z: 4200 },
  { src: () => clipFrame("pPlayExchange", 7), z: 5700 },
];
const W = 1040, H = 802;
/** the title: where the neon catches and where the word lands on beat 16 */
const TITLE = { x: 120, y: 250, size: 150 };

export const IntroPC: React.FC = () => {
  const f = useFrame();
  const b = at(8);
  const travel = interpolate(f, [0, b(6)], [-80, 5150], { ...clamp, easing: Easing.bezier(0.3, 0.12, 0.45, 1) });
  const dark = interpolate(f, [b(5.1), b(6.2)], [0, 1], clamp);
  const scan = interpolate(f, [b(5.6), b(6.8)], [-0.15, 1.15], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const ignite = (() => {
    if (f < b(6.4)) return 0;
    if (f >= b(7.5)) return 1;
    const t = (f - b(6.4)) / (b(7.5) - b(6.4));
    return random(`tube${f}`) < 0.2 + t * 0.7 ? 0.55 + random(`lvl${f}`) * 0.45 : 0.04;
  })();
  return (
    <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 60% 50% at 50% 50%, #4a0604 0%, #160202 45%, #000 80%)" }} />
      <div style={{ position: "absolute", inset: 0, perspective: P, perspectiveOrigin: "50% 50%" }}>
        <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d" }}>
          {SCREENS.map((s, i) => {
            const z = travel - s.z;
            const near = i === 0 ? interpolate(z, [P * 0.3, P * 0.5], [1, 0], clamp) : interpolate(z, [P * 0.16, P * 0.34], [1, 0], clamp);
            const far = interpolate(z, [-2300, -1200], [0, 1], clamp);
            const op = near * far;
            if (op <= 0.01) return null;
            const sweep = interpolate(z, [-1400, P * 0.5], [-0.3, 1.3], clamp);
            return (
              <div key={i} style={{ position: "absolute", left: 960 - W / 2, top: 540 - H / 2, width: W, height: H, transform: `translate3d(0, 0, ${z}px)`, opacity: op,
                borderRadius: 18, overflow: "hidden", boxShadow: "0 0 0 2px #ffffff1f, 0 60px 160px #000, 0 0 140px #e1060055" }}>
                <Img src={s.src()} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <div style={{ position: "absolute", inset: 0, mixBlendMode: "screen",
                  background: `linear-gradient(115deg, transparent ${sweep * 100 - 18}%, #ff3a2255 ${sweep * 100 - 4}%, #ffb4a066 ${sweep * 100}%, #ff3a2255 ${sweep * 100 + 4}%, transparent ${sweep * 100 + 18}%)` }} />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, #e1060018, transparent 40%, #00000066)" }} />
              </div>
            );
          })}
        </div>
      </div>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 80% 70% at 50% 50%, transparent 50%, #000000cc 100%)" }} />
      <AbsoluteFill style={{ background: "#000", opacity: dark }} />
      {/* one line of light crosses the dark, at the height the word will take */}
      {scan > -0.15 && scan < 1.15 && (
        <div style={{ position: "absolute", top: TITLE.y + TITLE.size * 1.42, height: 4, left: `${scan * 100 - 30}%`, width: "30%",
          background: `linear-gradient(90deg, transparent, ${C.lit}, #ffd2c8)`, boxShadow: `0 0 30px ${C.lit}, 0 0 80px #e10600` }} />
      )}
      <div style={{ position: "absolute", left: TITLE.x, top: TITLE.y, ...WIDE, fontSize: TITLE.size }}>
        <div style={{ opacity: 0 }}>Racing</div>
        <div style={{ ...GLOW, opacity: ignite, filter: `brightness(${0.7 + ignite * 0.4})` }}>Simplified</div>
      </div>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 70% 50% at 38% ${(TITLE.y + TITLE.size * 1.4) / 10.8}%, #e1060030, transparent 70%)`, opacity: ignite }} />
    </AbsoluteFill>
  );
};

/* ---------- beats 16-24: the name, a car across the frame, and what this is ---------- */

const TitleBlock: React.FC<{ f?: number; live?: boolean; h?: number; slam?: number; k?: (n: number) => number }> = ({ f = 0, live, h = 1, slam = 1, k }) => (
  <div style={{ position: "absolute", left: TITLE.x, top: TITLE.y }}>
    <div style={{ ...WIDE, fontSize: TITLE.size, color: "#fff", transform: `scale(${1.2 - 0.2 * slam})`, transformOrigin: "0 50%",
      filter: `blur(${(1 - slam) * 18}px)`, textShadow: "0 4px 60px #000c" }}>
      Racing
      <div style={{ ...GLOW, filter: `brightness(${h})` }}>Simplified</div>
    </div>
    <div style={{ ...WIDE, fontSize: 44, lineHeight: 1.2, color: "#fff", marginTop: 72, whiteSpace: "nowrap", ...(live && k ? smear(f, k(1), "left") : {}) }}>
      The website that explains
      <br />
      every F1 race.
    </div>
    <div style={{ ...BODY, fontSize: 38, lineHeight: 1.3, color: "#ffffffd0", marginTop: 34, whiteSpace: "nowrap", ...(live && k ? smear(f, k(3), "left") : {}) }}>
      Every 2026 Grand Prix, rebuilt from the official data.
    </div>
  </div>
);

const Brand: React.FC = () => {
  const f = useFrame();
  const k = at(16);
  const s = shake(f, [0, k(2)], 18, 8);
  const carX = interpolate(f, [0, k(2.5)], [-900, 2800], { ...clamp, easing: ease });
  const slam = interpolate(f, [0, 7], [0, 1], { ...clamp, easing: out });
  const h = hum(f + 40);
  return (
    <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `translate(${s.x}px, ${s.y}px)` }}>
        {/* the car, top view, right across the frame */}
        <Blur src="img/car-top.jpg" dir="y" drag={0.22} fit="contain" screen
          style={{ left: carX - 340, width: 680, top: 540 - 620, height: 1240, mixBlendMode: "screen", overflow: "visible", transform: "rotate(90deg)" }} />
        <TitleBlock f={f} live h={h} slam={slam} k={k} />
      </AbsoluteFill>
      <Flash hits={[0]} color={C.lit} decay={5} max={0.7} />
    </AbsoluteFill>
  );
};

/* ---------- beats 24-32: 01, the real home: down to the circuits, along them to Silverstone ---------- */

/** (11/11) the act's words */
const PICK_LINES: Say[] = [
  { from: 25.5, to: 32, big: "The season, race by race", small: "Take one: Silverstone", smallAt: 28 },
];

const Pick: React.FC = () => {
  const f = useFrame();
  const b = at(24);
  const m = markers("pNav");
  const io = { ...clamp, easing: Easing.inOut(Easing.cubic) };
  const lift = interpolate(f, [0, b(1.4)], [0, 1], io);
  const rise = interpolate(f, [b(0.2), b(1.8)], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const push = interpolate(f, [b(8) - 12, b(8)], [0, 1], io);
  const tapX = SITE.x + (m.cardX + m.cardW / 2) * S;
  const tapY = SITE.y + (m.cardY + m.cardH * 0.45) * S;
  return (
    <AbsoluteFill style={{ background: C.night, overflow: "hidden" }}>
      {/* the title block as the beat before left it, lifting away */}
      {lift < 1 && (
        <div style={{ position: "absolute", inset: 0, opacity: 1 - lift, transform: `translateY(${-lift * 520}px)`, filter: `blur(${lift * 6}px)` }}>
          <TitleBlock />
        </div>
      )}
      <Column f={f} at={b(1.2)} n="01" name="Pick a race" lines={PICK_LINES} b={b} k0={24} until={b(7.85)} />
      {/* the site comes in from the right and takes its place */}
      <div style={{ position: "absolute", left: SITE.x, top: SITE.y, width: SITE.w, height: SITE.h, overflow: "hidden", transform: `translateX(${(1 - rise) * SITE.w}px)` }}>
        <AbsoluteFill style={{ background: C.night, transform: `translateX(${-push * SITE.w * 0.3}px)`, filter: `brightness(${1 - push * 0.5})` }}>
          <ClipFrame name="pNav" t={f / 30} />
        </AbsoluteFill>
        {push > 0 && (
          <AbsoluteFill style={{ background: C.night, transform: `translateX(${(1 - push) * SITE.w}px)` }}>
            <ClipFrame name="pWeek" t={0} />
          </AbsoluteFill>
        )}
      </div>
      <Seam opacity={rise} />
      <Cursor f={f} taps={[{ at: b(7), x: tapX, y: tapY }]} />
    </AbsoluteFill>
  );
};

export const LightsPC: React.FC = () => {
  const k = at(16);
  return (
    <AbsoluteFill>
      <Seq durationInFrames={span(16, 24)}><Brand /></Seq>
      <Seq from={k(8)} durationInFrames={span(24, 32)}><Pick /></Seq>
    </AbsoluteFill>
  );
};
