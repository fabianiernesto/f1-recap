/**
 * Beats 16-48. The title lands where the neon caught and says what this is:
 * the website that explains every F1 race. Then how it works, in three
 * steps (HowItWorks.tsx). The older home, circuits and doors scenes stay
 * below, unused, for reference.
 */
import React from "react";
import { AbsoluteFill, Easing, interpolate, Freeze } from "remotion";
import { Clip, ClipFrame } from "../Clip";
import { HowItWorks } from "./HowItWorks";
import { BlindInfo, PitInfo } from "./Activities";
import {
  at, Beam, Blur, BODY, C, clamp, ease, Flash, GLOW, GPS, hum, MONO, out, ring, shake, smear, Speedlines, Track, WIDE,
} from "../kit";
import { span, useFrame, Seq, SCALE } from "../time";

const K0 = 16;
const k = at(K0);

/* ---------- beats 0-4: lights out, the car, the name ---------- */

const Brand: React.FC = () => {
  const f = useFrame();
  const s = shake(f, [0, k(2)], 18, 8);
  const carY = interpolate(f, [0, k(2.5)], [1500, -2300], { ...clamp, easing: ease });
  const slam = interpolate(f, [0, 7], [0, 1], { ...clamp, easing: out });
  const h = hum(f + 40);
  return (
    <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `translate(${s.x}px, ${s.y}px)` }}>
        {/* the car, top view, through the frame bottom to top */}
        <Blur
          src="img/car-top.jpg" dir="y" drag={0.22} fit="contain" screen
          style={{ left: 190, width: 700, top: carY, height: 1300, mixBlendMode: "screen", overflow: "visible" }}
        />
        <div style={{ position: "absolute", left: 66, right: 30, top: 700 }}>
          <div style={{ ...MONO, fontSize: 30, marginBottom: 34, opacity: 0 }}>Formula 1 · Season 2026</div>
          <div
            style={{
              ...WIDE, fontSize: 102, color: "#fff",
              transform: `scale(${1.35 - 0.35 * slam})`, transformOrigin: "0 50%",
              filter: `blur(${(1 - slam) * 18}px)`, textShadow: "0 4px 60px #000c",
            }}
          >
            Racing
            <div style={{ ...GLOW, filter: `brightness(${h})` }}>Simplified</div>
          </div>
          <div style={{ ...WIDE, fontSize: 40, lineHeight: 1.1, color: "#fff", marginTop: 50, whiteSpace: "nowrap", ...smear(f, k(1), "left") }}>
            The website that explains
            <br />
            every F1 race.
          </div>
          <div style={{ ...BODY, fontSize: 40, lineHeight: 1.3, color: "#ffffffd0", marginTop: 30, maxWidth: 860, ...smear(f, k(3), "left") }}>
            Every 2026 Grand Prix, rebuilt from the official data.
          </div>
        </div>
      </AbsoluteFill>
      <Flash hits={[0]} color={C.lit} decay={5} max={0.7} />
    </AbsoluteFill>
  );
};

/* ---------- beats 4-12: the site. One push: the title travels up and out
   as the phone rises into its place, in a single motion ---------- */

const Home: React.FC = () => {
  const f = useFrame();
  const b = at(K0 + 4);
  const push = interpolate(f, [0, 16], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const drift = interpolate(f, [0, b(8)], [0, 1], clamp);
  const h = hum(f + 40);
  return (
    <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
      <Blur src="img/helmet.jpg" drag={0.12}
        style={{ inset: -40, opacity: 0.4 * push }}
        imgStyle={{ transform: `scale(${1.15 + drift * 0.1})`, filter: "brightness(.7)" }} />
      <AbsoluteFill style={{ background: "linear-gradient(180deg, #000000dd, #00000055 40%, #000000ee)" }} />
      {/* the title from the beat before, leaving upwards */}
      {push < 1 && (
        <div style={{ position: "absolute", left: 66, right: 30, top: 700, transform: `translateY(${-push * 1100}px)`, opacity: 1 - push }}>
          <div style={{ ...MONO, fontSize: 30, marginBottom: 34, opacity: 0 }}>Formula 1 · Season 2026</div>
          <div style={{ ...WIDE, fontSize: 102, color: "#fff" }}>
            Every race
            <div style={{ ...GLOW, filter: `brightness(${h})` }}>Simplified</div>
          </div>
          <div style={{ ...BODY, fontSize: 40, lineHeight: 1.3, color: "#ffffffd0", marginTop: 44, maxWidth: 820 }}>
            Every 2026 race, rebuilt from the official timing data.
          </div>
        </div>
      )}
      <div style={{ position: "absolute", inset: 0, perspective: 2400 }}>
        <div
          style={{
            position: "absolute", left: 90, top: 250, width: 900, height: 1600, borderRadius: 40, overflow: "hidden",
            transform: `translateY(${(1 - push) * 1500}px) rotateX(${(1 - push) * 18}deg) rotateY(${-6 + drift * 4}deg)`,
            boxShadow: "0 0 0 2px #ffffff18, 0 60px 160px #000, 0 0 140px #e1060050",
          }}
        >
          <Clip name="home" t0={0} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ---------- beats 12-20: fifteen circuits light up; then the others step
   back and Silverstone alone travels to the middle of the frame, exactly
   where the next scene picks it up ---------- */

const SIL_GP = GPS.find((g) => g.slug === "silverstone-2026")!;
/** where Silverstone sits when the doors scene opens */
const HERO = { x: 70, y: 470, w: 940, h: 752 };

const Circuits: React.FC = () => {
  const f = useFrame();
  const b = at(K0 + 12);
  const SIL = GPS.findIndex((g) => g.slug === "silverstone-2026");
  const cw = 312, ch = 236, gx = 72, gy = 520;
  const lastLit = GPS.filter((_, i) => f >= b(i * 0.42)).length;
  // the season steps back, Silverstone comes forward
  const away = interpolate(f, [b(6.2), b(7.4)], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const fly = interpolate(f, [b(6.4), b(8)], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const c0 = SIL % 3, r0 = Math.floor(SIL / 3);
  const from = { x: gx + c0 * (cw + 12) + 40, y: gy + r0 * ch + 6, w: cw - 80, h: 190 };
  const lerp = (a: number, z: number) => a + (z - a) * fly;
  return (
    <AbsoluteFill style={{ background: C.night, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 72, top: 150, opacity: interpolate(f, [b(5.8), b(6.5)], [1, 0], clamp), transform: `translateY(${-away * 40}px)` }}>
        <div style={smear(f, 0, "left")}>
        <div style={{ ...MONO, fontSize: 28, color: C.lit }}>Season 2026 so far</div>
        <div style={{ ...WIDE, fontWeight: 900, fontSize: 190, lineHeight: 0.9, marginTop: 18, ...GLOW }}>
          {String(lastLit).padStart(2, "0")}
        </div>
        <div style={{ ...WIDE, fontSize: 84, color: "#fff", marginTop: 6 }}>Grands Prix</div>
        </div>
      </div>
      {GPS.map((g, i) => {
        if (i === SIL) return null;
        const st = b(i * 0.42);
        const on = f >= st;
        const draw = interpolate(f, [st, st + 9], [0, 1], { ...clamp, easing: out });
        const c = i % 3, r = Math.floor(i / 3);
        const delay = ((i * 7) % 5) * 0.06;
        const a = interpolate(away, [delay, Math.min(1, delay + 0.7)], [0, 1], clamp);
        return (
          <div key={g.slug} style={{ position: "absolute", left: gx + c * (cw + 12), top: gy + r * ch, width: cw, height: ch - 18,
            opacity: 1 - a, transform: `translateY(${a * 60}px) scale(${1 - a * 0.15})` }}>
            <Track g={g} draw={on ? draw : 0} width={9}
              style={{ position: "absolute", left: 40, top: 6, width: cw - 80, height: 190, opacity: 0.8 }} />
          </div>
        );
      })}
      <div style={{ position: "absolute", left: 72, right: 60, top: 250, opacity: interpolate(f, [b(6.8), b(7.3)], [0, 1], clamp) }}>
        <div style={{ ...WIDE, fontSize: 64, color: "#fff", ...smear(f, b(6.8), "left", 10) }}>Take one race:</div>
        <div style={{ ...WIDE, fontSize: 64, ...GLOW, marginTop: 6, ...smear(f, b(7.1), "left", 10) }}>Silverstone</div>
      </div>
      {(() => {
        const st = b(SIL * 0.42);
        const draw = interpolate(f, [st, st + 9], [0, 1], { ...clamp, easing: out });
        return (
          <Track g={SIL_GP} draw={f >= st ? draw : 0} width={interpolate(fly, [0, 1], [9, 6])} color={fly > 0 ? "#fff" : C.lit}
            style={{ position: "absolute", left: lerp(from.x, HERO.x), top: lerp(from.y, HERO.y), width: lerp(from.w, HERO.w), height: lerp(from.h, HERO.h) }} />
        );
      })()}
    </AbsoluteFill>
  );
};

/* ---------- beats 20-32: every race has two doors. Silverstone settles on
   the line between them; the black door says what it is, then the red one
   rises from below with its own line; then the black door opens ---------- */

/** both door blocks are kicker 36 + 26 + word 105 + 34 + two lines 112 = 313 tall: centred in a 960 half */
/** each block: kicker and word (167) + 34 + a row of 356: the line and the list on the left, a live screen on the right */
const ROW = 427, MINI = { w: 240, h: 427, x: 1080 - 72 - 240 };
const DOOR_TOP = Math.round((960 - 167 - 34 - ROW) / 2);
/** what Simplified shows in its mini screen: the two games, as they end */
const GAMES = [<Freeze key="b" frame={(span(84, 97) - 14) * SCALE}><BlindInfo /></Freeze>, <Freeze key="p" frame={(span(97, 112) - 4) * SCALE}><PitInfo /></Freeze>];

const Mini: React.FC<{ top: number; op: number; ry: number; children: React.ReactNode }> = ({ top, op, ry, children }) => (
  <div style={{ position: "absolute", inset: 0, perspective: 1600, perspectiveOrigin: `${MINI.x + MINI.w / 2}px ${top + MINI.h / 2}px`, opacity: op, pointerEvents: "none" }}>
    <div style={{ position: "absolute", left: MINI.x, top, width: MINI.w, height: MINI.h, borderRadius: 18, overflow: "hidden",
      transform: `translateY(${(1 - Math.min(1, op * 1.2)) * 40}px) rotateY(${ry}deg)`,
      boxShadow: "0 0 0 2px #ffffff22, 0 30px 80px #000c" }}>
      <div style={{ width: 1080, height: 1920, transformOrigin: "0 0", transform: `scale(${MINI.w / 1080})` }}>{children}</div>
    </div>
  </div>
);

const Doors: React.FC = () => {
  const f = useFrame();
  const b = at(K0 + 20);
  const io = { ...clamp, easing: Easing.inOut(Easing.cubic) };
  // the circuit glides from the middle to the seam, right-hand side
  const settle = interpolate(f, [b(0.3), b(2.2)], [0, 1], io);
  const redUp = interpolate(f, [b(4.6), b(6)], [0, 1], io);
  const open = interpolate(f, [b(9.6), b(12)], [0, 1], io);
  const seam = 960 + open * 960;
  const phonesOut = interpolate(f, [b(9.1), b(9.7)], [0, 1], clamp);
  const redTop = 1920 - redUp * 960 + open * 960;
  const T = { x: MINI.x + 16, y: DOOR_TOP + 201 + 110, w: MINI.w - 32, h: (MINI.w - 32) * 0.8 };
  const lerp = (a: number, z: number, p: number) => a + (z - a) * p;
  const h = hum(f);
  return (
    <AbsoluteFill style={{ background: C.night, overflow: "hidden" }}>
      {/* 02: the red door, rising from the bottom edge */}
      <div style={{ position: "absolute", left: 0, right: 0, top: redTop, height: 960, background: C.brand }} />

      <div style={{ position: "absolute", left: 72, right: 60, top: 250, opacity: interpolate(f, [0, b(1)], [1, 0], clamp) }}>
        <div style={{ ...WIDE, fontSize: 64, color: "#fff" }}>Take one race:</div>
        <div style={{ ...WIDE, fontSize: 64, ...GLOW, marginTop: 6 }}>Silverstone</div>
      </div>

      {/* door 01: laid out exactly as the Scrolled act opens */}
      <div style={{ position: "absolute", left: 72, right: 60, top: interpolate(open, [0, 1], [DOOR_TOP, 640]) }}>
        <div style={{ ...MONO, fontSize: 30, color: C.lit, ...smear(f, b(1.6), "left", 10) }}>01</div>
        <div style={{ ...WIDE, fontSize: 112, color: "#fff", marginTop: 26, ...smear(f, b(1.9), "left", 10) }}>Scrolled</div>
        <div style={{ ...BODY, fontSize: 46, color: "#ffffffd8", marginTop: 34, lineHeight: 1.22, ...smear(f, b(2.6), "left", 10) }}>
          Understand the race,
          <br />
          moment by moment
        </div>
      </div>
      {/* door 02, carried up by its panel */}
      <div style={{ position: "absolute", left: 72, right: 60, top: redTop + DOOR_TOP }}>
        <div style={{ ...MONO, fontSize: 30, color: "#fff", ...smear(f, b(4.7), "left", 10) }}>02</div>
        <div style={{ ...WIDE, fontSize: 112, color: "#0a0a0a", marginTop: 26, ...smear(f, b(4.9), "left", 10) }}>Simplified</div>
        <div style={{ ...BODY, fontSize: 46, color: "#0a0a0a", marginTop: 34, lineHeight: 1.22, ...smear(f, b(5.4), "left", 10) }}>
          Play the race,
          <br />
          call by call
        </div>
      </div>

      {/* the live screens: the race page scrolling, then the two games */}
      <Mini top={DOOR_TOP + 201 + open * 960} op={interpolate(f, [b(1.9), b(2.6)], [0, 1], clamp) * (1 - phonesOut)} ry={-12}>
        <AbsoluteFill style={{ background: C.night }}>
          <ClipFrame name="race" t={1.4 + Math.max(0, f - b(1.9)) / 30} />
        </AbsoluteFill>
      </Mini>
      <Mini top={redTop + DOOR_TOP + 201} op={interpolate(f, [b(5.2), b(5.9)], [0, 1], clamp) * (1 - phonesOut)} ry={-12}>
        <AbsoluteFill>{GAMES[0]}</AbsoluteFill>
        <AbsoluteFill style={{ opacity: interpolate(f, [b(8.2), b(8.6)], [0, 1], clamp) }}>{GAMES[1]}</AbsoluteFill>
      </Mini>
      {/* the circuit, from the middle into the Scrolled screen, a car lapping it */}
      <Track g={SIL_GP} width={6} color={redUp > 0.5 && open < 0.5 ? "#fff" : C.lit}
        car={f > b(0.3) ? ((f - b(0.3)) / 70) % 1 : undefined}
        style={{ position: "absolute", left: lerp(HERO.x, T.x, settle), top: lerp(HERO.y, T.y, settle) + open * 960,
          width: lerp(HERO.w, T.w, settle), height: lerp(HERO.h, T.h, settle), opacity: (1 - open) * interpolate(f, [b(1.9), b(2.5)], [1, 0], clamp), filter: `brightness(${h})` }} />
    </AbsoluteFill>
  );
};

export const LightsOut: React.FC = () => (
  <AbsoluteFill>
    <Seq durationInFrames={span(K0, K0 + 8)}><Brand /></Seq>
    <Seq from={k(8)} durationInFrames={span(K0 + 8, K0 + 16)}><HowItWorks /></Seq>
  </AbsoluteFill>
);
