/**
 * The two activities, drawn from their real data instead of shown as
 * screenshots: a blind-test sheet with the name struck out, and the pit
 * wall's call priced lap by lap. Each is followed by one second of the site
 * itself. Then the season at a sprint, two circuits a beat, into the splice.
 */
import React from "react";
import { AbsoluteFill, Easing, interpolate } from "remotion";
import { useFrame, X } from "../time";
import ACT from "../activities.json";
import { Clip } from "../Clip";
import { at, BODY, C, clamp, Flash, GLOW, GPS, hum, LED, MONO, out, ring, shake, smear, Speedlines, TOTALS, Track, WIDE } from "../kit";

const K0 = 80 + X;

/** Simplified lives in a red world: the door's red, darkened to a stage */
export const WORLD = "radial-gradient(ellipse 130% 70% at 50% 0%, #5a0a07 0%, #220404 50%, #0e0101 100%)";
const CARD = "#1c0707", EDGE = "#3c1414";

/** one figure from the season, counted up, with what it means */
const SeasonFigure: React.FC<{ f: number; at: number; n: number; label: string; top: number }> = ({ f, at, n, label, top }) => {
  if (f < at) return null;
  const count = interpolate(f, [at, at + 16], [0, n], { ...clamp, easing: out });
  return (
    <div style={{ position: "absolute", left: 72, right: 60, top, display: "flex", alignItems: "baseline", gap: 28 }}>
      <span style={{ ...WIDE, fontWeight: 900, fontSize: 120, lineHeight: 1, ...GLOW, ...smear(f, at, "left", 9) }}>{Math.round(count)}</span>
      <span style={{ ...BODY, fontSize: 44, lineHeight: 1.2, color: "#fff", ...smear(f, at + 4, "left", 9) }}>{label}</span>
    </div>
  );
};

/* ---------- the blind test: a real sheet, the name struck out ---------- */

const BLIND = ACT.blind;
const SHEET = BLIND.rows.filter(([key]) => ["Started", "Stops", "Finished"].includes(key));

/** the drawings run 1.5x slower than their beat numbers say: 12 beats each */
const slow = (k0: number, by = 1.5) => (x: number) => at(k0)(x * by);

export const BlindInfo: React.FC = () => {
  const f = useFrame();
  const b = slow(K0 + 4, 1.25);
  const team = `#${BLIND.colour}`;
  const ease3 = { ...clamp, easing: Easing.inOut(Easing.cubic) };
  const push = interpolate(f, [0, b(8)], [1, 1.035], clamp);
  const card = interpolate(f, [b(0.8), b(0.8) + 14], [0, 1], { ...clamp, easing: out });
  const ansIdx = BLIND.options.indexOf(BLIND.answer);
  // a cursor reads down the options, hesitates, and settles on the answer
  const scanKeys = [b(5.2), b(5.5), b(5.8), b(6.1), b(6.5)];
  const cx = interpolate(f, scanKeys, [0, 1, 0, 1, ansIdx % 2], ease3);
  const cy = interpolate(f, scanKeys, [0, 0, 1, 1, Math.floor(ansIdx / 2)], ease3);
  const pick = f >= b(6.6);
  const wipe = interpolate(f, [b(6.6), b(6.6) + 18], [0, 1], ease3);
  const glow = interpolate(f, [b(6.6), b(7.4)], [0, 1], clamp);
  const optIn = (i: number) => interpolate(f, [b(4.4) + i * 3, b(4.4) + i * 3 + 12], [0, 1], { ...clamp, easing: out });
  const col = (i: number) => i % 2, row = (i: number) => Math.floor(i / 2);
  const OW = 470, OH = 104, OG = 18, OX = 60, OY = 1010;
  // the whip into the pit wall: this file leaves to the left
  const len = at(K0 + 4)(13);
  const exit = interpolate(f, [len - 10, len], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  return (
    <AbsoluteFill style={{ background: WORLD, overflow: "hidden" }}>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 80% 40% at 50% 40%, ${team}40, transparent 70%)`, opacity: glow * (1 - exit) }} />
      <AbsoluteFill style={{ transform: `translateX(${-exit * 1080}px) translateY(110px) scale(${push * 1.04})`, transformOrigin: "50% 45%", filter: `blur(${exit * 8}px)` }}>
        <div style={{ position: "absolute", left: 72, right: 60, top: 220 }}>
          <div style={{ ...MONO, fontSize: 32, color: C.lit, ...smear(f, 0, "left", 10) }}>03 / 03 · The blind test</div>
          <div style={{ ...WIDE, fontSize: 84, color: "#fff", marginTop: 18, ...smear(f, 4, "left", 10) }}>Who is this?</div>
          <div style={{ ...BODY, fontSize: 38, color: "#ffffffc0", marginTop: 22, ...smear(f, 9, "left", 10) }}>Only his timing sheet to go on</div>
        </div>

        {/* the file */}
        <div style={{ position: "absolute", left: 60, right: 60, top: 470, padding: "36px 44px 20px", background: CARD,
          border: `2px solid ${EDGE}`, opacity: card, transform: `translateY(${(1 - card) * 80}px)` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 26, height: 96, marginBottom: 14 }}>
            <div style={{ width: 18, alignSelf: "stretch", background: pick ? team : "#2a2a2a" }} />
            <div style={{ position: "relative", flex: 1, height: 84 }}>
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", ...WIDE, fontSize: 64, color: "#fff" }}>
                {BLIND.answer}
              </div>
              <div style={{ position: "absolute", top: 0, bottom: 0, left: `${wipe * 100}%`, right: 0,
                background: "repeating-linear-gradient(135deg, #0a0a0a 0 14px, #1e1e1e 14px 28px)",
                borderLeft: wipe > 0 && wipe < 1 ? `4px solid ${team}` : "none" }} />
            </div>
            <div style={{ ...LED, fontSize: 84, color: pick ? team : "#333", textShadow: pick ? `0 0 ${30 * glow}px ${team}` : "none" }}>
              {pick ? BLIND.number : "?"}
            </div>
          </div>
          {SHEET.map(([key, v], i) => {
            const st = b(1.4 + i * 0.9);
            const chars = Math.floor(interpolate(f, [st + 4, st + 4 + v.length * 1.6], [0, v.length], clamp));
            return (
              <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", height: 112,
                borderTop: "2px solid #ffffff12", opacity: interpolate(f, [st, st + 8], [0, 1], clamp) }}>
                <span style={{ ...MONO, fontSize: 28, color: C.muted, letterSpacing: "0.16em" }}>{key}</span>
                <span style={{ fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 40, color: "#fff" }}>{v.slice(0, chars)}</span>
              </div>
            );
          })}
        </div>

        {/* who is it: the options, and a cursor making up its mind */}
        {BLIND.options.map((o, i) => {
          const right = pick && o === BLIND.answer;
          const dim = pick && !right ? 0.3 : 1;
          const p = optIn(i);
          return (
            <div key={o} style={{ position: "absolute", left: OX + col(i) * (OW + OG), top: OY + row(i) * (OH + OG), width: OW, height: OH,
              display: "flex", alignItems: "center", gap: 22, padding: "0 26px", boxSizing: "border-box",
              border: `3px solid ${right ? team : EDGE}`, background: right ? `${team}26` : CARD,
              opacity: p * dim, transform: `translateY(${(1 - p) * 40}px)` }}>
              <span style={{ ...MONO, fontSize: 22, color: right ? team : C.muted }}>{"ABCD"[i]}</span>
              <span style={{ ...WIDE, fontSize: 30, color: right ? team : "#fff", textDecoration: pick && !right ? "line-through" : "none" }}>{o}</span>
            </div>
          );
        })}
        <SeasonFigure f={f} at={b(7.6)} n={TOTALS.blindRounds} label="rounds to play, one sheet each" top={1360} />
        {f >= b(5.1) && !pick && (
          <div style={{ position: "absolute", width: OW, height: OH, boxSizing: "border-box", border: `3px solid ${C.lit}`,
            boxShadow: `0 0 30px ${C.lit}88`,
            left: OX + cx * (OW + OG),
            top: OY + cy * (OH + OG) }} />
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ---------- the pit wall: the race frozen, every call priced ---------- */

const PIT = ACT.pit;
const CALL = PIT.call;

export const PitInfo: React.FC = () => {
  // (the red world, as the blind test)
  const f = useFrame();
  const b = slow(K0 + 17, 1.35);
  const X0 = 120, X1 = 960;
  const lx = (lap: number) => X0 + ((lap - 1) / (PIT.laps - 1)) * (X1 - X0);
  // the priced options get the full width: laps 3 to 35 under the bars
  const ox = (lap: number) => X0 + ((lap - 3) / 32) * (X1 - X0);
  const cur = interpolate(f, [b(0.6), b(2.6)], [1, CALL.lap], { ...clamp, easing: Easing.inOut(Easing.quad) });
  const frozen = f >= b(2.6);
  const base = 1200, maxH = 330;
  const maxLost = Math.max(...CALL.options.map((o) => o.lost));
  const s = shake(f, [b(2.6), b(6)], 10, 6);
  // ...and the pit wall arrives from the right in the same pan
  const enter = interpolate(f, [0, 10], [1, 0], { ...clamp, easing: Easing.out(Easing.cubic) });
  // the call his team made lights up: its bar lifts and a light runs the chart
  const rise = interpolate(f, [b(6), b(6) + 10], [0, 1], { ...clamp, easing: out });
  const shine = interpolate(f, [b(6), b(6) + 22], [-0.2, 1.2], clamp);
  return (
    <AbsoluteFill style={{ background: WORLD, overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `translate(${s.x + enter * 1080}px, ${s.y + 120}px) scale(1.04)`, transformOrigin: "50% 40%", filter: `blur(${enter * 8}px)` }}>
        <div style={{ position: "absolute", left: 72, right: 60, top: 220 }}>
          <div style={{ ...MONO, fontSize: 32, color: C.lit }}>03 / 03 · The pit wall</div>
          <div style={{ ...WIDE, fontSize: 70, color: "#fff", marginTop: 18 }}>When do you</div>
          <div style={{ ...WIDE, fontSize: 70, ...GLOW, marginTop: 4, ...smear(f, b(0.4), "left", 8) }}>box him?</div>
        </div>

        {/* the race, lap 1 to 52, running until it freezes */}
        <div style={{ position: "absolute", left: X0, width: X1 - X0, top: 560, height: 10, background: EDGE, ...smear(f, b(0.5), "left", 8) }} />
        <div style={{ position: "absolute", left: X0, width: lx(cur) - X0, top: 560, height: 10, background: C.yellow,
          boxShadow: `0 0 20px ${C.yellow}88`, opacity: f >= b(0.6) ? 1 : 0 }} />
        <div style={{ position: "absolute", left: lx(cur) - 16, top: 549, width: 32, height: 32, borderRadius: "50%", background: "#fff",
          boxShadow: `0 0 20px #fff, 0 0 50px ${C.lit}`, opacity: f >= b(0.6) ? 1 : 0 }} />
        <div style={{ position: "absolute", left: 0, right: 0, top: 640, textAlign: "center", ...LED, fontSize: 60,
          opacity: frozen ? 1 : 0, filter: `brightness(${1 + ring(f, [b(2.6)], 6)})` }}>
          Frozen on lap {CALL.lap}
        </div>

        {/* every option, priced in seconds against the quickest */}
        <div style={{ position: "absolute", left: X0, right: 1080 - X1, top: 776, ...MONO, fontSize: 30, color: "#ffffffc8", letterSpacing: "0.14em",
          ...smear(f, b(3), "left", 10) }}>
          Seconds lost if he stops on lap...
        </div>
        <div style={{ position: "absolute", left: X0, width: X1 - X0, top: base, height: 3, background: "#ffffff30",
          opacity: f >= b(3.2) ? 1 : 0 }} />
        {CALL.options.map((o, i) => {
          const st = b(3.2 + i * 0.32);
          const grow = interpolate(f, [st, st + 9], [0, 1], { ...clamp, easing: out });
          const theirs = o.real;
          const lit = theirs && f >= b(6);
          const h = Math.max(8, (o.lost / maxLost) * maxH) * grow + (theirs ? rise * 46 : 0);
          return (
            <div key={o.lap} style={{ position: "absolute", left: ox(o.lap) - 50, width: 100, top: base - h, height: h, opacity: f >= st ? 1 : 0 }}>
              <div style={{ position: "absolute", left: 10, right: 10, top: 0, bottom: 0,
                background: theirs ? (lit ? C.ok : "#666") : "linear-gradient(180deg, #ff4a2e, #a9170b)",
                boxShadow: theirs ? (lit ? `0 0 40px ${C.ok}` : "none") : "0 0 30px #e1060066" }} />
              <div style={{ position: "absolute", left: -30, right: -30, top: -48, textAlign: "center", fontFamily: "JetBrains Mono", fontWeight: 700,
                fontSize: 28, color: lit ? C.ok : "#fff", opacity: grow }}>
                {o.lost ? `+${o.lost}s` : "0.0s"}
              </div>
              <div style={{ position: "absolute", left: -20, right: -20, top: h + 18, textAlign: "center", ...MONO, fontSize: 25,
                color: lit ? C.ok : C.muted, letterSpacing: "0.08em" }}>
                L{o.lap}
              </div>
            </div>
          );
        })}
        {shine > -0.2 && shine < 1.2 && (
          <div style={{ position: "absolute", top: base - maxH - 80, height: maxH + 90, width: 90,
            left: X0 + shine * (X1 - X0) - 80, background: "linear-gradient(90deg, transparent, #ffe9e0 50%, transparent)",
            mixBlendMode: "overlay", opacity: 0.55, filter: "blur(14px)",
            WebkitMaskImage: "linear-gradient(180deg, transparent, #000 30%, #000 85%, transparent)" }} />
        )}
        <div style={{ position: "absolute", left: ox(CALL.lap) - 200, width: 400, top: base + 70, textAlign: "center", ...MONO, fontSize: 28,
          color: C.ok, ...smear(f, b(6), "up", 8, 40) }}>
          What his team did
        </div>
        <SeasonFigure f={f} at={b(7.4)} n={TOTALS.pitwalls} label="races where you call the stops" top={1400} />
      </AbsoluteFill>
      <Flash hits={[b(2.6)]} decay={5} max={0.35} />
    </AbsoluteFill>
  );
};

/* ---------- one second of the real thing after each drawing ---------- */

export const Proof: React.FC<{ name: "blind" | "pitwall"; t0: number; speed: number }> = ({ name, t0, speed }) => {
  const f = useFrame();
  const enter = interpolate(f, [0, 9], [0, 1], { ...clamp, easing: out });
  return (
    <AbsoluteFill style={{ background: C.night, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, perspective: 2400 }}>
        <div style={{ position: "absolute", left: 160, top: 250, width: 760, height: 1351, borderRadius: 34, overflow: "hidden",
          transform: `translateY(${(1 - enter) * 900}px) rotateX(${(1 - enter) * 30 + 4}deg) rotateY(-6deg)`,
          boxShadow: "0 0 0 2px #ffffff1a, 0 70px 180px #000, 0 0 160px #e1060048" }}>
          <Clip name={name} t0={t0} speed={speed} />
        </div>
      </div>
      <div style={{ position: "absolute", left: 72, top: 140, ...MONO, fontSize: 26, color: C.lit, ...smear(f, 2, "left", 8) }}>
        On the site
      </div>
    </AbsoluteFill>
  );
};

