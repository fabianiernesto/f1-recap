/**
 * Beats 112-144, the song's last phrase. The splice lands on cream paper:
 * built from scratch. Then the pipeline down a lit line, the season's
 * numbers stacking into a timing tower, and all fifteen circuits drawn over
 * each other and folded into a point on the last hit.
 * Beats 144-: the end card while the song rings out.
 */
import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, random } from "remotion";
import {
  at, Beam, Blur, BODY, C, clamp, ease, Flash, GLOW, GLOW_S, GPS, hum, LED, MONO, out, Rip, ring, shake, smear, Speedlines,
  TOTALS, Track, WIDE,
} from "../kit";
import { END, F, span, useFrame, Seq, X } from "../time";
import { clipFrame } from "../Clip";
import CODE from "../code.json";

const K0 = 112 + X;
const k = at(K0);

/* ---------- beats 0-8: built from scratch, by one person: words only ---------- */

/** the shot at local frame f (in film units); the pipeline draws its last frame as it pushes it away */
/** what one person built, landing one per beat behind the words */
const BUILT = [
  { src: () => clipFrame("home", 0), at: 3, x: 190, y: 1010, r: -9 },
  { src: () => clipFrame("race", 1.4), at: 4, x: 420, y: 960, r: -3 },
  { src: () => clipFrame("blind", 999), at: 5, x: 650, y: 990, r: 4 },
  { src: () => clipFrame("pitwall", 999), at: 6, x: 875, y: 1050, r: 10 },
];
const SW = 260, SH = 462;

const ScratchShot: React.FC<{ f: number }> = ({ f }) => {
  const b = at(K0);
  const h = hum(f);
  const io = { ...clamp, easing: Easing.inOut(Easing.cubic) };
  const word = (txt: string, beat: number, glow?: boolean) => (
    <div style={{ ...WIDE, fontWeight: 900, fontSize: 116, lineHeight: 0.98, ...(glow ? { ...GLOW, filter: `brightness(${h})` } : { color: "#fff" }),
      ...smear(f, b(beat), "left", 8, 160) }}>{txt}</div>
  );
  const glow = interpolate(f, [b(1.4), b(4)], [0, 1], io);
  // the real pipeline code, rising behind everything
  const code = interpolate(f, [b(2), b(3)], [0, 1], clamp);
  const rise = (f / 30) * 44;
  return (
    <>
      <div style={{ position: "absolute", left: 66, right: 40, top: 120 - rise, opacity: 0.2 * code, ...MONO, textTransform: "none",
        letterSpacing: 0, fontSize: 22, lineHeight: "34px", color: C.lit, whiteSpace: "pre",
        WebkitMaskImage: "linear-gradient(180deg, transparent, #000 20%, #000 80%, transparent)" }}>
        {CODE.join("\n")}
      </div>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 70% 40% at 35% 30%, #e1060030, transparent 70%)", opacity: glow }} />
      {/* the words */}
      <div style={{ position: "absolute", left: 66, top: 300 }}>
        {word("Built", 0)}
        {word("from", 0.5)}
        {word("scratch", 1, true)}
      </div>
      <div style={{ position: "absolute", left: 70, top: 670, ...WIDE, fontSize: 64, color: "#fff", ...smear(f, b(2), "left", 9) }}>
        by one person.
      </div>
      {/* the site, one screen per beat */}
      <div style={{ position: "absolute", inset: 0, perspective: 1800 }}>
        {BUILT.map((s, i) => {
          const st = b(s.at);
          const p = interpolate(f, [st - 3, st + 6], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.4)) });
          if (f < st - 3) return null;
          return (
            <div key={i} style={{ position: "absolute", left: s.x - SW / 2, top: s.y, width: SW, height: SH, borderRadius: 20, overflow: "hidden",
              opacity: Math.min(1, p * 1.5),
              transform: `translateY(${(1 - p) * 260}px) rotate(${s.r * p}deg) scale(${0.8 + p * 0.2})`,
              boxShadow: "0 0 0 2px #ffffff1a, 0 40px 100px #000, 0 0 80px #e1060044" }}>
              <Img src={s.src()} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
          );
        })}
      </div>
    </>
  );
};

/** the frame Scratch ends on, also drawn by the pipeline as it pushes it away */
const ScratchFinal: React.FC = () => <ScratchShot f={at(K0)(8)} />;

const Scratch: React.FC = () => {
  const f = useFrame();
  const b = at(K0);
  const hold = interpolate(f, [b(2), b(8)], [1, 1.04], clamp);
  return (
    <AbsoluteFill style={{ background: C.night, overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `scale(${hold})`, transformOrigin: "30% 50%" }}>
        <ScratchShot f={f} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ---------- beats 6-12: the pipeline, down a lit line ---------- */

const NODES = [
  { v: "OpenF1 + FastF1", l: "The official timing data", big: false },
  { v: TOTALS.cacheJson.toLocaleString("en-US"), l: "Timing files", big: true },
  { v: TOTALS.pythonLines.toLocaleString("en-US"), l: "Lines of Python", big: true },
  { v: "35", l: "Animations inside the site", big: true },
];

const Pipeline: React.FC = () => {
  const f = useFrame();
  const b = at(K0 + 8);
  const top = 380, bottom = 1680, GAP = 300;
  // the line travels to each figure and lands on it on the beat, then waits
  const nodeY = NODES.map((n, i) => top + 60 + i * GAP + (n.big ? 56 : 20) + 19);
  const arrive = [b(1), b(2), b(3), b(4)];
  const keys: number[] = [0], vals: number[] = [top];
  NODES.forEach((_, i) => {
    keys.push(Math.max(keys[keys.length - 1] + 1, arrive[i] - (i === 0 ? arrive[0] : b(1))), arrive[i]);
    vals.push(i === 0 ? top : nodeY[i - 1], nodeY[i]);
  });
  keys.push(b(4.5), b(5.5));
  vals.push(nodeY[NODES.length - 1], bottom);
  const tip = interpolate(f, keys, vals, { ...clamp, easing: Easing.inOut(Easing.cubic) });
  return (
    <AbsoluteFill style={{ background: C.night, overflow: "hidden" }}>
      {(() => {
        const go = interpolate(f, [0, 14], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
        if (go >= 1) return null;
        return (
          <div style={{ position: "absolute", left: 0, right: 0, top: -go * 1920, height: 1920, background: C.night, zIndex: 5 }}>
            <div style={{ position: "absolute", inset: 0, transform: "scale(1.04)", transformOrigin: "30% 50%" }}>
              <ScratchFinal />
            </div>
          </div>
        );
      })()}
      <div style={{ position: "absolute", left: 72, top: 230, ...MONO, fontSize: 32, color: C.lit, ...smear(f, 6, "left") }}>
        How it's built
      </div>
      {/* the lit line, and its bright head */}
      <div style={{ position: "absolute", left: 104, top, width: 14, height: tip - top, borderRadius: 14,
        background: "linear-gradient(180deg, #ff1a0e, #ff3a12 35%, #ff6a1a 70%, #ff9a2e)",
        boxShadow: "0 0 14px 4px #ff2415, 0 0 60px 18px #ff2415aa, 0 0 200px 60px #e1060044" }} />
      <div style={{ position: "absolute", left: 99, top: tip - 12, width: 24, height: 24, borderRadius: "50%", background: "#fff3e6",
        boxShadow: "0 0 20px 6px #ff9a6a, 0 0 60px 20px #ff2415" }} />
      {NODES.map((n, i) => {
        const st = arrive[i];
        const lit = f >= st;
        const hit = ring(f, [st], 8);
        return (
          <div key={i} style={{ position: "absolute", left: 0, right: 40, top: top + 60 + i * GAP }}>
            <div style={{ position: "absolute", left: 92, top: n.big ? 56 : 20, width: 38, height: 38, background: "#fff", opacity: lit ? 1 : 0, transform: `scale(${lit ? 1 + hit * 0.4 : 0})`,
              boxShadow: lit ? `0 0 ${20 + hit * 40}px #ff2415, 0 0 ${60 + hit * 80}px #e10600` : "none" }} />
            <div style={{ position: "absolute", left: 180, right: 0, ...smear(f, st, "left", 10, 120) }}>
              <div style={{ ...WIDE, fontWeight: 900, fontSize: n.big ? 140 : 70, lineHeight: 0.95, ...(n.big ? GLOW : { color: "#fff" }) }}>
                {n.v}
              </div>
              <div style={{ ...BODY, fontSize: 42, color: "#ffffffd8", marginTop: 14, lineHeight: 1.2 }}>{n.l}</div>
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/* ---------- beats 12-24: the season, stacking into a timing tower ---------- */

const SEASON = [
  { n: 15, l: "Grands Prix" },
  { n: 1027, l: "Moments told" },
  { n: 906, l: "Race laps" },
  { n: 705, l: "Passes on track" },
  { n: 462, l: "Pit stops" },
  { n: 125, l: "Calls to make" },
];

const Tower: React.FC = () => {
  const f = useFrame();
  const b = at(K0 + 14);
  // the same lit line as the pipeline carries on down, and each figure is
  // switched on by a thread of light running out to it
  const rowY = (i: number) => 290 + i * 225;
  const centre = (i: number) => rowY(i) + 66;
  const keys: number[] = [0], vals: number[] = [250];
  SEASON.forEach((_, i) => {
    const st = b(1 + i);
    keys.push(Math.max(keys[keys.length - 1] + 1, st - 10), Math.max(keys[keys.length - 1] + 2, st));
    vals.push(i === 0 ? 250 : centre(i - 1), centre(i));
  });
  const tip = interpolate(f, keys, vals, { ...clamp, easing: Easing.inOut(Easing.cubic) });
  return (
    <AbsoluteFill style={{ background: C.night, overflow: "hidden" }}>
      <Beam draw={1} x={980} angle={28} opacity={0.3} pulse={(f % b(4)) / b(4)} />
      <div style={{ position: "absolute", left: 72, top: 150, ...MONO, fontSize: 28, color: C.lit, ...smear(f, 0, "left", 10) }}>
        Season 2026 so far
      </div>
      <div style={{ position: "absolute", left: 104, top: 250, width: 14, height: tip - 250, borderRadius: 14,
        background: "linear-gradient(180deg, #ff1a0e, #ff3a12 35%, #ff6a1a 70%, #ff9a2e)",
        boxShadow: "0 0 14px 4px #ff2415, 0 0 60px 18px #ff2415aa, 0 0 200px 60px #e1060044" }} />
      <div style={{ position: "absolute", left: 99, top: tip - 12, width: 24, height: 24, borderRadius: "50%", background: "#fff3e6",
        boxShadow: "0 0 20px 6px #ff9a6a, 0 0 60px 20px #ff2415" }} />
      {SEASON.map((r, i) => {
        const st = b(1 + i);
        const thread = interpolate(f, [st, st + 8], [0, 1], { ...clamp, easing: out });
        const count = interpolate(f, [st + 4, st + 4 + b(1)], [0, r.n], { ...clamp, easing: out });
        return (
          <React.Fragment key={r.l}>
            <div style={{ position: "absolute", left: 118, top: centre(i) - 2, width: 56 * thread, height: 4, background: "#ff6a3a",
              boxShadow: "0 0 12px #ff2415, 0 0 30px #e10600", opacity: f >= st ? 1 : 0 }} />
            <div style={{ position: "absolute", left: 190, right: 60, top: rowY(i), ...smear(f, st + 4, "left", 10, 80) }}>
              <div style={{ ...WIDE, fontWeight: 900, fontSize: 132, lineHeight: 1, ...GLOW }}>{Math.round(count).toLocaleString("en-US")}</div>
              <div style={{ ...WIDE, fontSize: 40, color: "#fff", marginTop: 12 }}>{r.l}</div>
            </div>
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};

/* ---------- beats 24-32: the season folds into one line ---------- */

const Converge: React.FC = () => {
  const f = useFrame();
  const b = at(K0 + 24);
  const spin = interpolate(f, [0, b(8)], [-8, 8], clamp);
  const crush = interpolate(f, [b(7), b(8)], [1, 0.04], { ...clamp, easing: Easing.in(Easing.cubic) });
  const white = interpolate(f, [b(8) - 6, b(8)], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
  const n = GPS.filter((_, i) => f >= b(i * 0.4)).length;
  const h = hum(f);
  return (
    <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `rotate(${spin}deg) scale(${crush})`, filter: `brightness(${h})` }}>
        {GPS.map((g, i) => {
          const st = b(i * 0.4);
          const draw = interpolate(f, [st, st + 10], [0, 1], { ...clamp, easing: out });
          return (
            <Track key={g.slug} g={g} draw={draw} width={4} color={i % 3 === 0 ? "#fff" : C.lit}
              style={{ position: "absolute", left: 90, top: 560, width: 900, height: 800, opacity: f >= st ? 0.75 : 0,
                transform: `rotate(${(i - 7) * 4}deg)` }} />
          );
        })}
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "#fff", opacity: white }} />
    </AbsoluteFill>
  );
};

export const Built: React.FC = () => (
  <AbsoluteFill>
    <Seq durationInFrames={k(8)}><Scratch /></Seq>
    <Seq from={k(8)} durationInFrames={span(K0 + 8, K0 + 14)}><Pipeline /></Seq>
    <Seq from={k(14)} durationInFrames={span(K0 + 14, K0 + 24)}><Tower /></Seq>
    <Seq from={k(24)} durationInFrames={span(K0 + 24, K0 + 32)}><Converge /></Seq>
  </AbsoluteFill>
);

/* ---------- the end card ---------- */

/** the screens the film showed, for the carousel the end card turns */
const ORBIT = [
  () => clipFrame("home", 0), () => clipFrame("race", 1.2), () => clipFrame("race", 7.4), () => clipFrame("race", 9.6),
  () => clipFrame("race", 999), () => clipFrame("blind", 999), () => clipFrame("pitwall", 0.4), () => clipFrame("pitwall", 999),
];

export const EndCard: React.FC = () => {
  const f = useFrame();
  const b = at(144 + X);
  const h = hum(f + 20);
  const len = END - F(144 + X);
  const io = { ...clamp, easing: Easing.inOut(Easing.cubic) };
  // out of the white the fold left, the point opens into the whole site,
  // turning slowly round the name: the intro's corridor, now a ring
  const white = interpolate(f, [0, 10], [1, 0], clamp);
  const open = interpolate(f, [0, b(2.4)], [0.05, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const turn = interpolate(f, [0, len], [-30, 40], clamp);
  const rule = interpolate(f, [b(3), b(4)], [0, 1], io);
  const blade = interpolate(f, [b(4.5), b(7)], [-0.3, 1.3], io);
  const RADIUS = 560, CW = 330, CH = 587;
  return (
    <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 70% 45% at 50% 50%, #3a0503 0%, #120101 55%, #000 85%)" }} />
      <div style={{ position: "absolute", inset: 0, perspective: 1700, perspectiveOrigin: "50% 46%" }}>
        <div style={{ position: "absolute", left: 540, top: 960, transformStyle: "preserve-3d",
          transform: `translateZ(${-RADIUS * 0.9}px) scale(${open}) rotateX(-6deg) rotateY(${turn}deg)` }}>
          {ORBIT.map((src, i) => {
            const a = (i / ORBIT.length) * 360;
            // screens on the far side sink into the dark, the near ones stay dim behind the name
            const facing = Math.cos(((a + turn) * Math.PI) / 180);
            return (
              <div key={i} style={{ position: "absolute", left: -CW / 2, top: -CH / 2, width: CW, height: CH, borderRadius: 24, overflow: "hidden",
                backfaceVisibility: "hidden", transform: `rotateY(${a}deg) translateZ(${RADIUS}px)`,
                opacity: facing > 0 ? 0.08 + 0.85 * Math.pow(1 - facing, 0.6) : 0.3 + 0.5 * (1 + facing),
                boxShadow: "0 0 0 2px #ffffff14, 0 0 80px #e1060044" }}>
                <Img src={src()} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            );
          })}
        </div>
      </div>
      {/* a pool of dark under the name, so it reads over the ring */}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 48% 17% at 50% 49%, #000000f4 0%, #000000c0 55%, transparent 100%)" }} />

      {/* the name, centred */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 720, textAlign: "center" }}>
        <div style={{ ...LED, fontSize: 84, lineHeight: 1, marginBottom: 40, letterSpacing: "0.04em" }}>
          {"R//S".split("").map((ch, i) => {
            const st = b(1 + i * 0.5), on = b(1.25 + i * 0.5);
            const lvl = f < st ? 0 : f >= on ? 1 : random(`rs${i}${f}`) < 0.45 ? 0.5 + random(`rl${i}${f}`) * 0.5 : 0.05;
            return <span key={i} style={{ opacity: lvl, textShadow: lvl > 0.5 ? LED.textShadow : "none" }}>{ch}</span>;
          })}
        </div>
        <div style={{ position: "relative", display: "inline-block" }}>
          <div style={{ ...WIDE, fontSize: 112, color: "#fff", ...smear(f, b(0.4), "zoom", 12) }}>Racing</div>
          <div style={{ ...WIDE, fontSize: 112, ...GLOW, filter: `brightness(${h})`, ...smear(f, b(0.7), "zoom", 12) }}>Simplified</div>
          {blade > -0.3 && blade < 1.3 && (
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none", ...WIDE, fontSize: 112, color: "transparent",
              backgroundImage: `linear-gradient(105deg, transparent ${blade * 100 - 12}%, #fff8 ${blade * 100}%, transparent ${blade * 100 + 12}%)`,
              WebkitBackgroundClip: "text", backgroundClip: "text" }}>
              <div>Racing</div>
              <div>Simplified</div>
            </div>
          )}
        </div>
        <div style={{ width: 320 * rule, height: 4, background: C.lit, boxShadow: `0 0 18px ${C.lit}`, margin: "44px auto 0" }} />
        <div style={{ ...BODY, fontSize: 42, color: "#ffffffe8", marginTop: 40, ...smear(f, b(4), "up", 10, 40) }}>
          by Ernesto Fabiani Collado
        </div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 1560, textAlign: "center", ...MONO, fontSize: 18, color: "#ffffff60",
        letterSpacing: "0.14em", lineHeight: 1.7, ...smear(f, b(5), "up", 12, 30) }}>
        Built from OpenF1 and FastF1 timing data
        <br />
        Not affiliated with Formula 1
      </div>
      <AbsoluteFill style={{ background: "#fff", opacity: white }} />
    </AbsoluteFill>
  );
};

