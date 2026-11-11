/**
 * Beats 128-160 in PC format, the song's last phrase: built from scratch by one
 * person, the pipeline along a lit line, the season's numbers, every circuit
 * folded into a point. Then the end card while the song rings out.
 */
import React from "react";
import { AbsoluteFill, Easing, Img, interpolate } from "remotion";
import { clipFrame } from "../Clip";
import CODE from "../code.json";
import { at, Beam, BODY, C, clamp, GLOW, GPS, hum, MONO, out, ring, smear, TOTALS, Track, WIDE } from "../kit";
import { END, F, Seq, span, useFrame, X } from "../time";

const K0 = 112 + X;
const k = at(K0);

/* ---------- built from scratch, by one person ---------- */

const BUILT = [
  { src: () => clipFrame("pNav", 0), at: 3, x: 1210, y: 120, r: -5 },
  { src: () => clipFrame("pRaceCard", 2.4), at: 4, x: 1660, y: 170, r: 3 },
  { src: () => clipFrame("pPlayCall", 6.6), at: 5, x: 1240, y: 590, r: 3 },
  { src: () => clipFrame("pPlayExchange", 7), at: 6, x: 1670, y: 620, r: -4 },
];
const SW = 450, SH = 347;

const ScratchShot: React.FC<{ f: number }> = ({ f }) => {
  const b = at(K0);
  const h = hum(f);
  const io = { ...clamp, easing: Easing.inOut(Easing.cubic) };
  const word = (txt: string, beat: number, glow?: boolean) => (
    <div style={{ ...WIDE, fontWeight: 900, fontSize: 112, lineHeight: 1.02, ...(glow ? { ...GLOW, filter: `brightness(${h})` } : { color: "#fff" }), ...smear(f, b(beat), "left", 8, 160) }}>{txt}</div>
  );
  const glow = interpolate(f, [b(1.4), b(4)], [0, 1], io);
  const code = interpolate(f, [b(2), b(3)], [0, 1], clamp);
  const rise = (f / 30) * 44;
  return (
    <>
      <div style={{ position: "absolute", left: 80, right: 40, top: 60 - rise, opacity: 0.16 * code, ...MONO, textTransform: "none", letterSpacing: 0, fontSize: 22, lineHeight: "34px", color: C.lit, whiteSpace: "pre",
        WebkitMaskImage: "linear-gradient(180deg, transparent, #000 20%, #000 80%, transparent)" }}>
        {CODE.join("\n")}
      </div>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 50% 60% at 22% 42%, #e1060030, transparent 70%)", opacity: glow }} />
      <div style={{ position: "absolute", left: 90, top: 270 }}>
        {word("Built", 0)}
        {word("from", 0.5)}
        {word("scratch", 1, true)}
      </div>
      <div style={{ position: "absolute", left: 94, top: 660, ...WIDE, fontSize: 54, color: "#fff", ...smear(f, b(2), "left", 9) }}>by one person.</div>
      <div style={{ position: "absolute", inset: 0, perspective: 1800 }}>
        {BUILT.map((s, i) => {
          const st = b(s.at);
          const p = interpolate(f, [st - 3, st + 6], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.4)) });
          if (f < st - 3) return null;
          return (
            <div key={i} style={{ position: "absolute", left: s.x - SW / 2, top: s.y, width: SW, height: SH, borderRadius: 14, overflow: "hidden", opacity: Math.min(1, p * 1.5),
              transform: `translateY(${(1 - p) * 220}px) rotate(${s.r * p}deg) scale(${0.8 + p * 0.2})`, boxShadow: "0 0 0 2px #ffffff1a, 0 40px 100px #000, 0 0 80px #e1060044" }}>
              <Img src={s.src()} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
          );
        })}
      </div>
    </>
  );
};

const Scratch: React.FC = () => {
  const f = useFrame();
  const b = at(K0);
  const hold = interpolate(f, [b(2), b(8)], [1, 1.03], clamp);
  return (
    <AbsoluteFill style={{ background: C.night, overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `scale(${hold})`, transformOrigin: "30% 50%" }}>
        <ScratchShot f={f} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ---------- the pipeline, along a lit line ---------- */

const NODES = [
  { v: "OpenF1 + FastF1", l: "The official timing data", big: false },
  { v: TOTALS.cacheJson.toLocaleString("en-US"), l: "Timing files", big: true },
  { v: TOTALS.pythonLines.toLocaleString("en-US"), l: "Lines of Python", big: true },
  { v: String(TOTALS.animations), l: "Animations inside the site", big: true },
];
const NODE_X = [110, 580, 1040, 1500];
const LINE_Y = 390;

const LitLine: React.FC<{ y: number; x0: number; tip: number }> = ({ y, x0, tip }) => (
  <>
    <div style={{ position: "absolute", left: x0, top: y - 6, width: Math.max(0, tip - x0), height: 12, borderRadius: 12,
      background: "linear-gradient(90deg, #ff1a0e, #ff3a12 35%, #ff6a1a 70%, #ff9a2e)", boxShadow: "0 0 14px 4px #ff2415, 0 0 60px 18px #ff2415aa, 0 0 200px 60px #e1060044" }} />
    <div style={{ position: "absolute", left: tip - 12, top: y - 12, width: 24, height: 24, borderRadius: "50%", background: "#fff3e6", boxShadow: "0 0 20px 6px #ff9a6a, 0 0 60px 20px #ff2415" }} />
  </>
);

const Pipeline: React.FC = () => {
  const f = useFrame();
  const b = at(K0 + 8);
  // the line travels to each figure and lands on it on the beat, then waits
  const arrive = [b(1), b(2), b(3), b(4)];
  const keys: number[] = [0], vals: number[] = [0];
  NODES.forEach((_, i) => {
    keys.push(Math.max(keys[keys.length - 1] + 1, arrive[i] - (i === 0 ? arrive[0] : b(1))), arrive[i]);
    vals.push(i === 0 ? 0 : NODE_X[i - 1], NODE_X[i]);
  });
  keys.push(b(4.5), b(5.5));
  vals.push(NODE_X[3], 1920);
  const tip = interpolate(f, keys, vals, { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const go = interpolate(f, [0, 14], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  return (
    <AbsoluteFill style={{ background: C.night, overflow: "hidden" }}>
      {go < 1 && (
        <div style={{ position: "absolute", left: 0, right: 0, top: -go * 1080, height: 1080, background: C.night, zIndex: 5 }}>
          <div style={{ position: "absolute", inset: 0, transform: "scale(1.03)", transformOrigin: "30% 50%" }}><ScratchShot f={at(K0)(8)} /></div>
        </div>
      )}
      <div style={{ position: "absolute", left: 110, top: 190, ...MONO, fontSize: 30, color: C.lit, ...smear(f, 6, "left") }}>How it's built</div>
      <LitLine y={LINE_Y} x0={0} tip={tip} />
      {NODES.map((n, i) => {
        const st = arrive[i];
        const lit = f >= st;
        const hit = ring(f, [st], 8);
        return (
          <div key={i} style={{ position: "absolute", left: NODE_X[i], top: LINE_Y, width: 410 }}>
            <div style={{ position: "absolute", left: -16, top: -16, width: 32, height: 32, background: "#fff", opacity: lit ? 1 : 0, transform: `scale(${lit ? 1 + hit * 0.4 : 0})`,
              boxShadow: lit ? `0 0 ${20 + hit * 40}px #ff2415, 0 0 ${60 + hit * 80}px #e10600` : "none" }} />
            <div style={{ position: "absolute", left: 0, right: 0, top: 70, ...smear(f, st, "up", 10, 60) }}>
              <div style={{ ...WIDE, fontWeight: 900, fontSize: n.big ? 82 : 52, lineHeight: n.big ? 1 : 1.12, height: 118, ...(n.big ? GLOW : { color: "#fff" }) }}>{n.v}</div>
              <div style={{ ...BODY, fontSize: 36, color: "#ffffffd8", marginTop: 26, lineHeight: 1.26, textWrap: "balance" } as React.CSSProperties}>{n.l}</div>
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/* ---------- the season ---------- */

// from the data, not typed in: a written number would lie as soon as the cards are rebuilt
const SEASON = [
  { n: TOTALS.gps, l: "Grands Prix" },
  { n: TOTALS.cards, l: "Moments told" },
  { n: TOTALS.laps, l: "Race laps" },
  { n: TOTALS.passes, l: "Passes on track" },
  { n: TOTALS.stops, l: "Pit stops" },
  { n: TOTALS.interactive, l: "Calls to make" },
];
const CELL_X = [110, 720, 1330];
const ROW_Y = [290, 660];

const Tower: React.FC = () => {
  const f = useFrame();
  const b = at(K0 + 14);
  // two runs of the same lit line, each figure switched on as it passes
  const run = (r: number) => {
    const first = r * 3;
    const keys = [b(first + 0.6), b(first + 1), b(first + 2), b(first + 3)];
    return interpolate(f, keys, [0, CELL_X[0], CELL_X[1], CELL_X[2]], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  };
  return (
    <AbsoluteFill style={{ background: C.night, overflow: "hidden" }}>
      <Beam draw={1} x={1760} angle={28} opacity={0.3} pulse={(f % b(4)) / b(4)} />
      <div style={{ position: "absolute", left: 110, top: 170, ...MONO, fontSize: 30, color: C.lit, ...smear(f, 0, "left", 10) }}>Season 2026 so far</div>
      {ROW_Y.map((y, r) => f >= b(r * 3 + 0.6) && <LitLine key={r} y={y} x0={0} tip={run(r)} />)}
      {SEASON.map((s, i) => {
        const st = b(1 + i);
        const count = interpolate(f, [st + 2, st + 2 + b(1)], [0, s.n], { ...clamp, easing: out });
        const col = i % 3, row = Math.floor(i / 3);
        return (
          <div key={s.l} style={{ position: "absolute", left: CELL_X[col], top: ROW_Y[row] + 44, width: 580, ...smear(f, st + 2, "up", 10, 60) }}>
            <div style={{ ...WIDE, fontWeight: 900, fontSize: 118, lineHeight: 1, ...GLOW }}>{Math.round(count).toLocaleString("en-US")}</div>
            <div style={{ ...WIDE, fontSize: 34, lineHeight: 1.2, color: "#fff", marginTop: 26 }}>{s.l}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/* ---------- the season folds into one line ---------- */

const Converge: React.FC = () => {
  const f = useFrame();
  const b = at(K0 + 24);
  const spin = interpolate(f, [0, b(8)], [-8, 8], clamp);
  const crush = interpolate(f, [b(7), b(8)], [1, 0.04], { ...clamp, easing: Easing.in(Easing.cubic) });
  const white = interpolate(f, [b(8) - 6, b(8)], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
  const h = hum(f);
  return (
    <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `rotate(${spin}deg) scale(${crush})`, filter: `brightness(${h})` }}>
        {GPS.map((g, i) => {
          const st = b(i * 0.4);
          const draw = interpolate(f, [st, st + 10], [0, 1], { ...clamp, easing: out });
          return (
            <Track key={g.slug} g={g} draw={draw} width={4} color={i % 3 === 0 ? "#fff" : C.lit}
              style={{ position: "absolute", left: 510, top: 140, width: 900, height: 800, opacity: f >= st ? 0.75 : 0, transform: `rotate(${(i - 7) * 4}deg)` }} />
          );
        })}
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "#fff", opacity: white }} />
    </AbsoluteFill>
  );
};

export const BuiltPC: React.FC = () => (
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
  () => clipFrame("pNav", 0), () => clipFrame("pRaceCard", 2.4), () => clipFrame("pRaceCard", 999), () => clipFrame("pWall", 3),
  () => clipFrame("pGuess", 999), () => clipFrame("pPlayCall", 6.6), () => clipFrame("pPlayExchange", 7), () => clipFrame("pPlayExchange", 999),
];

export const EndCardPC: React.FC = () => {
  const f = useFrame();
  const b = at(144 + X);
  const h = hum(f + 20);
  const len = END - F(144 + X);
  const io = { ...clamp, easing: Easing.inOut(Easing.cubic) };
  const white = interpolate(f, [0, 10], [1, 0], clamp);
  const open = interpolate(f, [0, b(2.4)], [0.05, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const turn = interpolate(f, [0, len], [-30, 40], clamp);
  const rule = interpolate(f, [b(3), b(4)], [0, 1], io);
  const blade = interpolate(f, [b(4.5), b(7)], [-0.3, 1.3], io);
  const RADIUS = 860, CW = 620, CH = 478;
  return (
    <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 70% 60% at 50% 50%, #3a0503 0%, #120101 55%, #000 85%)" }} />
      <div style={{ position: "absolute", inset: 0, perspective: 1900, perspectiveOrigin: "50% 46%" }}>
        <div style={{ position: "absolute", left: 960, top: 540, transformStyle: "preserve-3d", transform: `translateZ(${-RADIUS * 0.9}px) scale(${open}) rotateX(-6deg) rotateY(${turn}deg)` }}>
          {ORBIT.map((src, i) => {
            const a = (i / ORBIT.length) * 360;
            // screens on the far side sink into the dark, the near ones stay dim behind the name
            const facing = Math.cos(((a + turn) * Math.PI) / 180);
            return (
              <div key={i} style={{ position: "absolute", left: -CW / 2, top: -CH / 2, width: CW, height: CH, borderRadius: 16, overflow: "hidden", backfaceVisibility: "hidden",
                transform: `rotateY(${a}deg) translateZ(${RADIUS}px)`, opacity: facing > 0 ? 0.08 + 0.85 * Math.pow(1 - facing, 0.6) : 0.3 + 0.5 * (1 + facing), boxShadow: "0 0 0 2px #ffffff14, 0 0 80px #e1060044" }}>
                <Img src={src()} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            );
          })}
        </div>
      </div>
      {/* a pool of dark under the name, so it reads over the ring */}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 42% 34% at 50% 47%, #000000f4 0%, #000000c0 55%, transparent 100%)" }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 300, textAlign: "center" }}>
        <div style={{ position: "relative", display: "inline-block" }}>
          <div style={{ ...WIDE, fontSize: 112, color: "#fff", ...smear(f, b(0.4), "zoom", 12) }}>Racing</div>
          <div style={{ ...WIDE, fontSize: 112, ...GLOW, filter: `brightness(${h})`, ...smear(f, b(0.7), "zoom", 12) }}>Simplified</div>
          {blade > -0.3 && blade < 1.3 && (
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none", ...WIDE, fontSize: 112, color: "transparent",
              backgroundImage: `linear-gradient(105deg, transparent ${blade * 100 - 12}%, #fff8 ${blade * 100}%, transparent ${blade * 100 + 12}%)`, WebkitBackgroundClip: "text", backgroundClip: "text" }}>
              <div>Racing</div>
              <div>Simplified</div>
            </div>
          )}
        </div>
        <div style={{ width: 320 * rule, height: 4, background: C.lit, boxShadow: `0 0 18px ${C.lit}`, margin: "48px auto 0" }} />
        <div style={{ ...BODY, fontSize: 40, color: "#ffffffe8", marginTop: 44, ...smear(f, b(4), "up", 10, 40) }}>by Ernesto Fabiani Collado</div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 940, textAlign: "center", ...MONO, fontSize: 18, color: "#ffffff60", letterSpacing: "0.14em", lineHeight: 1.7, ...smear(f, b(5), "up", 12, 30) }}>
        Built from OpenF1 and FastF1 timing data
        <br />
        Not affiliated with Formula 1
      </div>
      <AbsoluteFill style={{ background: "#fff", opacity: white }} />
    </AbsoluteFill>
  );
};
