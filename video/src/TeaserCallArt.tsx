/**
 * Call the race for the Friday teaser, second pass (19/11/2026, Ernesto: "call the race puedes mejorar la
 * animación"). The real start of the British GP: Antonelli on pole, Leclerc beside him, Hamilton third; the real
 * first call (Who leads after lap 1?) and its real answer, Leclerc. The track is Silverstone from src/teaser.json.
 * The order of the front sits on the left and reorders live when Leclerc gets by.
 */
import React from "react";
import { AbsoluteFill, Easing, interpolate } from "remotion";
import { C, MONO, WIDE, clamp, out } from "./kit";
import { CX, GPS, enter, fb } from "./Teaser";

const OK = C.ok;
const SIL = GPS.find((g) => g.circuit === "Silverstone")!;
const TB = { x: 380, y: 340, w: 600, h: 460 };
const fit = (() => {
  const xs = SIL.pts.map((p) => p[0]), ys = SIL.pts.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const k = Math.min(TB.w / (x1 - x0), TB.h / (y1 - y0));
  const ox = TB.x + (TB.w - (x1 - x0) * k) / 2, oy = TB.y + (TB.h - (y1 - y0) * k) / 2;
  return SIL.pts.map(([x, y]) => [ox + (x - x0) * k, oy + (y - y0) * k] as [number, number]);
})();
const seg = fit.map((p, i) => Math.hypot(fit[(i + 1) % fit.length][0] - p[0], fit[(i + 1) % fit.length][1] - p[1]));
const LEN = seg.reduce((a, b) => a + b, 0);
const at = (s: number): [number, number] => {
  let d = (((s % 1) + 1) % 1) * LEN;
  for (let i = 0; i < fit.length; i++) {
    if (d <= seg[i]) { const a = fit[i], b = fit[(i + 1) % fit.length], t = d / seg[i]; return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
    d -= seg[i];
  }
  return fit[0];
};
const PATH = fit.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ") + " Z";
const CARS = [{ code: "ANT", color: "#00D7B6" }, { code: "LEC", color: "#ED1131" }, { code: "HAM", color: "#ff7b7b" }];
// the rest of the grid, in grid order, team colours from the replay (web/data/silverstone-2026/replay_race.json)
const FIELD = ["#00D7B6", "#4781D7", "#F47600", "#4781D7", "#F47600", "#6C98FF", "#6C98FF", "#F50537", "#F50537", "#9C9FA2", "#1868DB", "#00A1E8", "#1868DB", "#9C9FA2", "#909090", "#00A1E8", "#909090", "#229971", "#229971"];
const OPTS = [{ name: "Antonelli", sub: "Starts P1" }, { name: "Leclerc", sub: "Starts P2" }, { name: "Hamilton", sub: "Starts P3" }];
const SURE: [string, string][] = [["10", "A hunch"], ["25", "Pretty sure"], ["50", "Certain"]];

export const CallArt: React.FC<{ f: number; s: number }> = ({ f, s }) => {
  const B = (b: number) => fb(s + b);
  const draw = interpolate(f, [B(0.3), B(2.3)], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const freeze = B(5), resume = B(11), answer = B(12.5);
  // race time: runs from the green light, stops dead at the freeze, runs again after the lock
  const run = (fr: number) => Math.max(0, Math.min(fr, freeze) - B(2.3)) + Math.max(0, fr - resume);
  const r = run(f) / 60;
  const stopped = f >= freeze && f < resume;
  const flash = interpolate(f, [freeze, freeze + 12], [1, 0], clamp);
  // Leclerc gets by Antonelli once the race runs again: that is the answer
  const swap = interpolate(r, [1.5, 2.2], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const gaps = [0.014 * (1 - swap), 0.014 * swap, -0.03];
  const pos = (i: number, rr: number) => at(0.03 + rr * 0.075 + gaps[i]);
  const cardIn = interpolate(f, [B(5.4), B(5.4) + 16], [0, 1], { ...clamp, easing: out });
  const optIn = (i: number) => interpolate(f, [B(6) + i * 7, B(6) + i * 7 + 12], [0, 1], { ...clamp, easing: out });
  const pickFill = interpolate(f, [B(8), B(8) + 14], [0, 1], { ...clamp, easing: out });
  const sure = f >= B(9);
  const lockFill = interpolate(f, [B(9.6), B(10.8)], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) });
  const right = f >= answer;
  const slam = interpolate(f, [answer + 4, answer + 16], [0, 1], { ...clamp, easing: out });
  const score = Math.round(interpolate(f, [answer + 8, answer + 32], [0, 50], { ...clamp, easing: Easing.out(Easing.cubic) }));
  const ROW = 64;
  const order = [{ c: CARS[0], p: swap }, { c: CARS[1], p: 1 - swap }, { c: CARS[2], p: 2 }];
  return (
    <AbsoluteFill>
      <svg width={1080} height={1350} style={{ position: "absolute", inset: 0 }}>
        <path d={PATH} fill="none" stroke="#262626" strokeWidth={26} strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
        <path d={PATH} fill="none" stroke={stopped ? C.lit : "#ffffff40"} strokeWidth={stopped ? 5 : 2} strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw}
          style={stopped ? { filter: `drop-shadow(0 0 ${8 + 16 * flash}px ${C.lit})` } : undefined} />
        {draw > 0.98 && FIELD.map((col, j) => {
          const [x, y] = at(0.03 + r * 0.075 - 0.03 - 0.022 * (j + 1));
          return <circle key={j} cx={x} cy={y} r={10} fill={col} opacity={0.9} style={{ filter: `drop-shadow(0 0 6px ${col})` }} />;
        })}
        {draw > 0.98 && CARS.map((c, i) => {
          const [x, y] = pos(i, r);
          const trail = Array.from({ length: 6 }, (_, k) => pos(i, Math.max(0, r - (k + 1) * 0.05)));
          return (
            <g key={c.code}>
              {!stopped && trail.map(([tx, ty], k) => <circle key={k} cx={tx} cy={ty} r={11 - k * 1.5} fill={c.color} opacity={0.35 - k * 0.05} />)}
              <circle cx={x} cy={y} r={14} fill={c.color} style={{ filter: `drop-shadow(0 0 12px ${c.color})` }} />
            </g>
          );
        })}
      </svg>
      {/* the order of the front, reordering live */}
      <div style={{ position: "absolute", left: 100, top: 420, width: 230, ...enter(f, B(1), 20) }}>
        <div style={{ ...MONO, fontSize: 15, color: C.muted, marginBottom: 14 }}>Lap 1</div>
        <div style={{ position: "relative", height: ROW * 3 }}>
          {order.map(({ c, p }) => (
            <div key={c.code} style={{ position: "absolute", left: 0, right: 0, top: p * ROW, height: ROW - 10, display: "flex", alignItems: "center", gap: 14, padding: "0 14px",
              background: p < 0.5 ? "#e106001f" : "#111", border: `1px solid ${p < 0.5 ? C.brand + "88" : "#ffffff1a"}`, borderRadius: 8 }}>
              <span style={{ ...MONO, fontSize: 16, color: C.muted, width: 14 }}>{Math.round(p) + 1}</span>
              <span style={{ width: 5, height: 26, borderRadius: 2, background: c.color }} />
              <span style={{ ...WIDE, fontSize: 22, color: "#fff" }}>{c.code}</span>
            </div>
          ))}
        </div>
        <div style={{ ...MONO, fontSize: 16, marginTop: 18, color: C.lit, opacity: stopped ? 0.35 + 0.65 * Math.abs(Math.sin((f - freeze) / 9)) : 0 }}>Paused</div>
      </div>
      {/* the call, step by step */}
      <div style={{ position: "absolute", left: 100, right: 100, top: 840, padding: "26px 28px 22px", background: "#111", borderRadius: 16,
        border: `1px solid ${right ? OK + "aa" : "#ffffff22"}`, boxShadow: right ? `0 0 40px ${OK}33` : "0 30px 60px #000a",
        opacity: cardIn, transform: `translateY(${(1 - cardIn) * 50}px)` }}>
        <div style={{ ...MONO, fontSize: 16, color: C.brand }}>Call 1 of 16 · The start</div>
        <div style={{ ...WIDE, fontSize: 32, lineHeight: 1.1, color: "#fff", marginTop: 12 }}>Who leads after lap 1?</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 20 }}>
          {OPTS.map((o, i) => {
            const me = i === 1, won = me && right, k = optIn(i);
            return (
              <div key={o.name} style={{ position: "relative", overflow: "hidden", padding: "16px 10px", borderRadius: 10, textAlign: "center",
                border: `1px solid ${won ? OK : me && pickFill > 0 ? C.brand : "#ffffff26"}`, background: "#0d0d0d",
                opacity: k * (pickFill > 0 && !me ? 0.4 : 1), transform: `translateY(${(1 - k) * 24}px)` }}>
                {me && <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${pickFill * 100}%`, background: won ? "#0b3a1c" : C.brand }} />}
                <div style={{ position: "relative", ...WIDE, fontSize: 21, color: "#fff" }}>{o.name}</div>
                <div style={{ position: "relative", ...MONO, fontSize: 13, marginTop: 6, color: won ? OK : me && pickFill > 0.5 ? "#fff" : C.muted }}>{won ? "It was him" : o.sub}</div>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 16, opacity: optIn(2) }}>
          {SURE.map(([v, t], i) => (
            <div key={v} style={{ flex: 1, padding: "10px 0", borderRadius: 8, textAlign: "center", ...MONO, fontSize: 14,
              background: sure && i === 2 ? "#fff" : "#0d0d0d", color: sure && i === 2 ? "#0a0a0a" : C.muted, border: "1px solid #ffffff1f" }}>{v} · {t}</div>
          ))}
        </div>
        <div style={{ position: "relative", marginTop: 14, height: 46, borderRadius: 8, overflow: "hidden", background: "#3a0503", opacity: optIn(2) }}>
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${lockFill * 100}%`, background: right ? OK : C.brand }} />
          <div style={{ position: "relative", lineHeight: "46px", textAlign: "center", ...MONO, fontSize: 15, color: right ? "#0a0a0a" : "#fff" }}>{right ? "Right" : lockFill >= 1 ? "Locked" : "Lock the call"}</div>
        </div>
      </div>
      <div style={{ ...CX, top: 1218, whiteSpace: "nowrap", opacity: Math.min(1, slam * 2), transform: `scale(${1.25 - 0.25 * slam})`, filter: slam < 1 ? `blur(${(1 - slam) * 10}px)` : undefined }}>
        <span style={{ ...WIDE, fontSize: 56, color: OK, textShadow: `0 0 40px ${OK}66` }}>Called it</span>
        <span style={{ ...WIDE, fontSize: 56, color: "#fff", marginLeft: 26 }}>+{score}</span>
      </div>
    </AbsoluteFill>
  );
};
