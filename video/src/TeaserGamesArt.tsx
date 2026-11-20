/**
 * The two games told as animations for the Friday teaser (19/11/2026, Ernesto: "en vez de mostrar la actividad
 * per se… representado, no directamente la actividad"). Both from real data:
 * Call the race: the Silverstone track (src/teaser.json), the cars of the front running, the race freezing,
 * the real first call (Lights out. Who leads after lap 1? Antonelli / Leclerc / Hamilton; it was Leclerc,
 * from P2), Leclerc picked at 50, CALLED IT +50.
 * Paddock Exchange: the real prices, lap by lap, of five drivers as the live game showed them
 * (src/teaser_exchange.json, recorded by playing the site): 100 on Bearman on lap 1 at 15, sold on lap 23
 * at 55, so 1,000 becomes 1,267; Verstappen out on lap 47 drops to 0.
 */
import React from "react";
import { AbsoluteFill, Easing, interpolate } from "remotion";
import { BODY, C, GLOW, MONO, WIDE, clamp, out } from "./kit";
import { CX, GPS, KICK, enter, fb } from "./Teaser";
import ex from "./teaser_exchange.json";

const OK = C.ok;

/** the caption band used by both games: red kicker, wide title, one line that changes on the beats */
export const GameHead: React.FC<{ f: number; at: number; kick: string; title: React.ReactNode; lines: [number, string][] }> = ({ f, at, kick, title, lines }) => {
  const a = fb(at);
  let cur: [number, string] | undefined;
  for (const l of lines) if (f >= fb(l[0])) cur = l;
  return (
    <>
      <div style={{ ...CX, top: 150, ...KICK, color: C.brand, ...enter(f, a, 0) }}>{kick}</div>
      <div style={{ ...CX, top: 186, ...WIDE, fontSize: 52, lineHeight: 1.02, whiteSpace: "nowrap", color: "#fff", ...enter(f, a + 3, 30) }}>{title}</div>
      {cur && <div key={cur[0]} style={{ ...CX, top: 266, ...BODY, fontSize: 30, lineHeight: 1.2, whiteSpace: "nowrap", color: "#e6e6e6", ...enter(f, fb(cur[0]), 18) }}>{cur[1]}</div>}
    </>
  );
};

/* ---------- Call the race ---------- */
const SIL = GPS.find((g) => g.circuit === "Silverstone")!;
// the track fitted into a box under the caption band
const TB = { x: 170, y: 350, w: 740, h: 440 };
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
  let d = ((s % 1) + 1) % 1 * LEN;
  for (let i = 0; i < fit.length; i++) {
    if (d <= seg[i]) { const a = fit[i], b = fit[(i + 1) % fit.length], t = d / seg[i]; return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
    d -= seg[i];
  }
  return fit[0];
};
const PATH = fit.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ") + " Z";
// the front of the field at the start: Antonelli on pole, Leclerc beside him, Hamilton third
const CARS = [{ code: "ANT", color: "#00D7B6" }, { code: "LEC", color: "#ED1131" }, { code: "HAM", color: "#ff8a8a" }, { code: "RUS", color: "#7ff0dd" }, { code: "NOR", color: "#F47600" }];
const OPTS = [{ name: "Antonelli", sub: "Starts P1" }, { name: "Leclerc", sub: "Starts P2" }, { name: "Hamilton", sub: "Starts P3" }];

export const CallArt: React.FC<{ f: number; s: number }> = ({ f, s }) => {
  // beats from the section start s: track draws, cars run, freeze, question, pick, lock, resume, answer
  const B = (b: number) => fb(s + b);
  const draw = interpolate(f, [B(0.5), B(2.5)], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const freeze = B(5), resume = B(11), answer = B(12.5);
  // race time: runs, stops dead at the freeze, runs again after the lock
  const run = (fr: number) => Math.max(0, Math.min(fr, freeze) - B(2)) + Math.max(0, fr - resume);
  const r = run(f) / 60;
  const stopped = f >= freeze && f < resume;
  const pick = B(8), lock = B(9.5);
  const picked = f >= pick, locked = f >= lock, right = f >= answer;
  const card = interpolate(f, [B(5.5), B(5.5) + 16], [0, 1], { ...clamp, easing: out });
  const score = Math.round(interpolate(f, [answer + 6, answer + 30], [0, 50], { ...clamp, easing: Easing.out(Easing.cubic) }));
  const stopFlash = interpolate(f, [freeze, freeze + 14], [1, 0], clamp);
  return (
    <AbsoluteFill>
      <svg width={1080} height={1350} style={{ position: "absolute", inset: 0 }}>
        <path d={PATH} fill="none" stroke="#2a2a2a" strokeWidth={22} strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
        <path d={PATH} fill="none" stroke={stopped ? C.lit : "#ffffff55"} strokeWidth={stopped ? 4 : 2} strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw}
          style={stopped ? { filter: `drop-shadow(0 0 10px ${C.lit})` } : undefined} />
        {draw > 0.98 && CARS.map((c, i) => {
          // Leclerc gets by Antonelli once the race runs again: that is the answer
          const swap = i < 2 ? interpolate(r, [3.4, 4.6], [0, 1], clamp) : 0;
          const gap = i === 0 ? 0.012 * (1 - swap) : i === 1 ? 0.012 * swap : -0.028 * (i - 1);
          const [x, y] = at(0.04 + r * 0.07 + gap);
          return (
            <g key={c.code}>
              <circle cx={x} cy={y} r={13} fill={c.color} style={{ filter: `drop-shadow(0 0 10px ${c.color})` }} />
              {i < 2 && <text x={x + 20} y={y - 14} fill="#fff" style={{ ...MONO, fontSize: 16 }}>{c.code}</text>}
            </g>
          );
        })}
      </svg>
      {f >= freeze && f < resume && (
        <div style={{ ...CX, top: 560, ...WIDE, fontSize: 54, color: "#fff", textShadow: `0 0 40px ${C.lit}`, opacity: 0.25 + 0.75 * stopFlash }}>Stop</div>
      )}
      {/* the call, as a card under the track */}
      <div style={{ position: "absolute", left: 120, right: 120, top: 820, padding: "28px 30px 24px", background: "#111", border: `1px solid ${right ? OK + "88" : "#ffffff22"}`, borderRadius: 16,
        opacity: card, transform: `translateY(${(1 - card) * 50}px)` }}>
        <div style={{ ...MONO, fontSize: 16, color: C.brand }}>Call 1 of 16 · The start</div>
        <div style={{ ...WIDE, fontSize: 32, lineHeight: 1.1, color: "#fff", marginTop: 12 }}>Who leads after lap 1?</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 20 }}>
          {OPTS.map((o, i) => {
            const me = i === 1, on = me && picked, won = me && right;
            return (
              <div key={o.name} style={{ padding: "16px 12px", borderRadius: 10, textAlign: "center",
                border: `1px solid ${won ? OK : on ? C.brand : "#ffffff26"}`, background: won ? "#06210f" : on ? C.brand : "#0d0d0d", opacity: picked && !me ? 0.4 : 1 }}>
                <div style={{ ...WIDE, fontSize: 22, color: "#fff" }}>{o.name}</div>
                <div style={{ ...MONO, fontSize: 13, marginTop: 6, color: won ? OK : on ? "#fff" : C.muted }}>{won ? "It was him" : o.sub}</div>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 18, ...MONO, fontSize: 16 }}>
          <span style={{ color: picked ? "#fff" : C.muted }}>{picked ? "Certain · 50" : "How sure are you?"}</span>
          <span style={{ color: locked ? C.brand : "transparent" }}>Locked</span>
        </div>
      </div>
      <div style={{ ...CX, top: 1180, whiteSpace: "nowrap", ...enter(f, answer, 30) }}>
        <span style={{ ...WIDE, fontSize: 60, color: OK, textShadow: `0 0 40px ${OK}66` }}>Called it</span>
        <span style={{ ...WIDE, fontSize: 60, color: "#fff", marginLeft: 26 }}>+{score}</span>
      </div>
    </AbsoluteFill>
  );
};

/* ---------- Paddock Exchange ---------- */
type Dr = { code: string; color: string; out: number | null; p: (number | null)[] };
const DR = ex.drivers as Dr[];
const LAPS = ex.laps;
const CH = { x: 110, y: 470, w: 790, h: 600 };
const cx = (lap: number) => CH.x + ((lap - 1) / (LAPS - 1)) * CH.w;
const cy = (v: number) => CH.y + CH.h - (v / 110) * CH.h;
const BUY = 1, SELL = 23;
// real trades from the recorded prices: buy lap, sell lap (100 each): Bearman 15 to 55, Norris 80 to 100,
// Antonelli 100 to 110, Verstappen 80 to 100; together 1,000 becomes 1,327
const TRADES: { code: string; buy: number; sell: number }[] = [
  { code: "BEA", buy: 1, sell: 23 }, { code: "NOR", buy: 1, sell: 24 }, { code: "ANT", buy: 1, sell: 26 }, { code: "VER", buy: 18, sell: 29 },
];

export const ExchangeArt: React.FC<{ f: number; s: number }> = ({ f, s }) => {
  const B = (b: number) => fb(s + b);
  // the race runs from lap 1 to the flag between beats 1.5 and 16.5 of the section
  const lap = interpolate(f, [B(1.5), B(16.5)], [1, LAPS], clamp);
  const lapAt = (l: number) => interpolate(l, [1, LAPS], [B(1.5), B(16.5)], clamp);
  const gainOf = (t: { code: string; buy: number; sell: number }) => { const d = DR.find((x) => x.code === t.code)!; return Math.round((100 * d.p[t.sell - 1]!) / d.p[t.buy - 1]!) - 100; };
  const total = Math.round(1000 + TRADES.reduce((acc, t) => acc + gainOf(t) * interpolate(f, [lapAt(t.sell), lapAt(t.sell) + 20], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) }), 0));
  const appear = interpolate(f, [B(0.5), B(0.5) + 16], [0, 1], { ...clamp, easing: out });
  const L = Math.floor(lap);
  return (
    <AbsoluteFill style={{ opacity: appear }}>
      <div style={{ position: "absolute", left: CH.x, right: 1080 - CH.x - CH.w - 60, top: 350, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div style={{ ...MONO, fontSize: 16, color: C.muted }}>Lap</div>
          <div style={{ ...WIDE, fontSize: 48, color: "#fff", lineHeight: 1 }}>{L}<span style={{ fontSize: 24, color: C.muted }}> / {LAPS}</span></div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ ...MONO, fontSize: 16, color: C.muted }}>Your total</div>
          <div style={{ ...WIDE, fontSize: 48, lineHeight: 1, color: total > 1000 ? OK : "#fff", textShadow: total > 1000 ? `0 0 30px ${OK}66` : undefined }}>{total.toLocaleString("en-US")}</div>
        </div>
      </div>
      <svg width={1080} height={1350} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        {[0, 55, 110].map((v) => <line key={v} x1={CH.x} x2={CH.x + CH.w} y1={cy(v)} y2={cy(v)} stroke="#ffffff12" />)}
        {DR.map((d) => {
          const pts: string[] = [];
          for (let l = 1; l <= Math.min(LAPS, L); l++) { const v = d.p[l - 1]; if (v != null) pts.push(`${cx(l)},${cy(v)}`); }
          const v = d.p[Math.max(0, L - 1)] ?? 0;
          pts.push(`${cx(lap)},${cy(v)}`);
          const me = d.code === "BEA";
          const outNow = d.out != null && L >= d.out;
          return (
            <g key={d.code}>
              <polyline points={pts.join(" ")} fill="none" stroke={me ? "#fff" : d.color} strokeWidth={me ? 6 : 3} strokeLinejoin="round" opacity={me ? 1 : 0.75}
                style={me ? { filter: "drop-shadow(0 0 12px #ffffffaa)" } : undefined} />
              <circle cx={cx(lap)} cy={cy(v)} r={me ? 9 : 6} fill={me ? "#fff" : d.color} />
              <text x={cx(lap) + 16} y={cy(v) + 6} fill={outNow ? C.lit : me ? "#fff" : d.color} style={{ ...MONO, fontSize: 17 }}>{d.code} {outNow ? "Out · 0" : v}</text>
            </g>
          );
        })}
        {TRADES.map((t) => {
          const d = DR.find((x) => x.code === t.code)!;
          const me = t.code === "BEA", c = me ? "#fff" : d.color;
          const bv = d.p[t.buy - 1]!, sv = d.p[t.sell - 1]!;
          return (
            <g key={t.code}>
              {f >= lapAt(t.buy) && <g opacity={interpolate(f, [lapAt(t.buy), lapAt(t.buy) + 10], [0, 1], clamp)}>
                <circle cx={cx(t.buy)} cy={cy(bv)} r={me ? 14 : 10} fill="none" stroke={c} strokeWidth={3} />
                <text x={cx(t.buy) + 16} y={cy(bv) + (me ? 40 : 26)} fill={c} style={{ ...MONO, fontSize: me ? 17 : 14 }}>Buy {bv}</text>
              </g>}
              {lap >= t.sell && <g opacity={interpolate(f, [lapAt(t.sell), lapAt(t.sell) + 10], [0, 1], clamp)}>
                <circle cx={cx(t.sell)} cy={cy(sv)} r={me ? 14 : 10} fill="none" stroke={OK} strokeWidth={3} />
                <text x={cx(t.sell) - 26} y={cy(sv) - (me ? 26 : 18)} fill={OK} style={{ ...MONO, fontSize: me ? 17 : 14 }}>Sell {sv}</text>
              </g>}
            </g>
          );
        })}
      </svg>
      <div style={{ ...CX, bottom: 96, ...MONO, fontSize: 17, color: C.muted }}>Real prices from the British Grand Prix</div>
    </AbsoluteFill>
  );
};
void GLOW;
