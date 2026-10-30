/**
 * The two activities, drawn from their real data instead of shown as
 * screenshots (since 30/10/2026: Call the race and Paddock exchange, in place
 * of the blind test and the pit wall). Both are Silverstone, the film's race:
 * the race frozen six laps from the end with a real question, and the market
 * of that race, three drivers' prices lap by lap exactly as the site prices
 * them. Data: scripts/activities.mjs -> src/activities.json.
 */
import React from "react";
import { AbsoluteFill, Easing, interpolate } from "remotion";
import { useFrame, X } from "../time";
import ACT from "../activities.json";
import { Clip } from "../Clip";
import { at, BODY, C, clamp, Flash, GLOW, LED, MONO, out, ring, shake, smear, WIDE } from "../kit";

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

/** the drawings run slower than their beat numbers say */
const slow = (k0: number, by = 1.5) => (x: number) => at(k0)(x * by);
const hex = (c: string) => `#${c}`;

/* ---------- Call the race: the race runs, freezes on a real question, and answers ---------- */

const CALL = ACT.call;
const ANSWER = CALL.options.findIndex((o) => o.id === CALL.answer);
const OUT_OPT = CALL.options.findIndex((o) => o.out);

export const CallInfo: React.FC = () => {
  const f = useFrame();
  const b = slow(K0 + 4, 1.25);
  const ease3 = { ...clamp, easing: Easing.inOut(Easing.cubic) };
  const X0 = 120, X1 = 960, BAR = 548;
  const lx = (lap: number) => X0 + ((lap - 1) / (CALL.laps - 1)) * (X1 - X0);
  // the race runs to the question, freezes, then runs on to the flag once you have called it
  const toCall = interpolate(f, [b(0.6), b(2.4)], [1, CALL.lap], { ...clamp, easing: Easing.inOut(Easing.quad) });
  const toFlag = interpolate(f, [b(6.8), b(7.8)], [CALL.lap, CALL.laps], { ...clamp, easing: Easing.inOut(Easing.quad) });
  const cur = f < b(6.8) ? toCall : toFlag;
  const frozen = f >= b(2.4) && f < b(6.8);
  const outLap = OUT_OPT >= 0 ? CALL.options[OUT_OPT].out ?? 0 : 0;
  const outAt = b(6.8) + ((outLap - CALL.lap) / (CALL.laps - CALL.lap)) * (b(7.8) - b(6.8));
  const flag = f >= b(7.8);
  const s = shake(f, [b(2.4), outAt], 10, 6);
  // a cursor reads the three, hesitates, settles on the answer
  const OY = 1000, OH = 104, OG = 16;
  const scan = [b(4.4), b(4.8), b(5.1), b(5.5)];
  const cy = interpolate(f, scan, [0, 1, 2, ANSWER], ease3);
  const picked = f >= b(5.6);
  const staked = f >= b(6.2);
  // the whip into the exchange: this file leaves to the left
  const len = at(K0 + 4)(13);
  const exit = interpolate(f, [len - 10, len], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  const [q1, q2] = CALL.q.includes(". ") ? [CALL.q.split(". ")[0] + ".", CALL.q.split(". ").slice(1).join(". ")] : [CALL.q, ""];
  return (
    <AbsoluteFill style={{ background: WORLD, overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `translate(${s.x - exit * 1080}px, ${s.y + 40}px)`, filter: `blur(${exit * 8}px)` }}>
        <div style={{ position: "absolute", left: 72, right: 60, top: 220 }}>
          <div style={{ ...MONO, fontSize: 32, color: C.lit, ...smear(f, 0, "left", 10) }}>03 / 03 · Call the race</div>
          <div style={{ ...WIDE, fontSize: 72, color: "#fff", marginTop: 18, whiteSpace: "nowrap", ...smear(f, 4, "left", 10) }}>What happens</div>
          <div style={{ ...WIDE, fontSize: 72, ...GLOW, marginTop: 4, ...smear(f, 7, "left", 10) }}>next?</div>
        </div>

        {/* the race, lap 1 to the flag, with its neutralised laps in yellow */}
        <div style={{ position: "absolute", left: X0, width: X1 - X0, top: BAR, height: 10, background: EDGE, ...smear(f, b(0.5), "left", 8) }} />
        {f >= b(0.6) && CALL.neutral.filter((n) => n.from <= cur).map((n, i) => (
          <div key={i} style={{ position: "absolute", left: lx(n.from) - 4, width: Math.max(8, lx(Math.min(n.to, cur)) - lx(n.from) + 8), top: BAR - 3, height: 16,
            background: C.yellow, boxShadow: `0 0 18px ${C.yellow}aa` }} />
        ))}
        <div style={{ position: "absolute", left: X0, width: Math.max(0, lx(cur) - X0), top: BAR, height: 10, background: "#fff",
          opacity: f >= b(0.6) ? 0.85 : 0, mixBlendMode: "screen" }} />
        <div style={{ position: "absolute", left: lx(cur) - 16, top: BAR - 11, width: 32, height: 32, borderRadius: "50%", background: "#fff",
          boxShadow: `0 0 20px #fff, 0 0 50px ${C.lit}`, opacity: f >= b(0.6) ? 1 : 0 }} />
        <div style={{ position: "absolute", left: X0, right: 1080 - X1, top: BAR + 34, display: "flex", justifyContent: "space-between",
          ...MONO, fontSize: 24, color: C.muted, whiteSpace: "nowrap", opacity: f >= b(0.6) ? 1 : 0 }}>
          <span>Lap {Math.round(cur)}</span>
          <span style={{ ...LED, fontSize: 40, opacity: frozen ? 1 : 0, filter: `brightness(${1 + ring(f, [b(2.4)], 6)})` }}>Frozen on lap {CALL.lap}</span>
          <span style={{ color: flag ? "#fff" : C.muted }}>{flag ? "Chequered flag" : `${CALL.laps}`}</span>
        </div>

        {/* the question, exactly as the game asks it */}
        <div style={{ position: "absolute", left: 72, right: 60, top: 700, ...smear(f, b(2.8), "up", 10, 60) }}>
          <div style={{ ...WIDE, fontSize: 60, color: "#fff" }}>{q1}</div>
          {q2 && <div style={{ ...WIDE, fontSize: 60, color: "#fff", marginTop: 6 }}>{q2}</div>}
          <div style={{ ...BODY, fontSize: 34, color: "#ffffffb0", marginTop: 22 }}>{CALL.ctx}</div>
        </div>

        {CALL.options.map((o, i) => {
          const p = interpolate(f, [b(3.4) + i * 4, b(3.4) + i * 4 + 12], [0, 1], { ...clamp, easing: out });
          const mine = picked && i === ANSWER;
          const gone = OUT_OPT === i && f >= outAt;
          const won = flag && i === ANSWER;
          const team = hex(o.colour);
          return (
            <div key={o.id} style={{ position: "absolute", left: 60, right: 60, top: OY + i * (OH + OG), height: OH, boxSizing: "border-box",
              display: "flex", alignItems: "center", gap: 26, padding: "0 30px",
              background: won ? "#0f2a18" : CARD, border: `3px solid ${won ? C.ok : mine ? "#fff" : EDGE}`,
              boxShadow: won ? `0 0 ${50 * (0.5 + ring(f, [b(7.8)], 12))}px ${C.ok}88` : "none",
              opacity: p * (gone ? 0.45 : picked && !mine && !gone ? 0.6 : 1), transform: `translateY(${(1 - p) * 40}px)` }}>
              <span style={{ width: 12, alignSelf: "stretch", margin: "20px 0", background: team }} />
              <span style={{ ...WIDE, fontSize: 42, color: won ? C.ok : "#fff", textDecoration: gone ? "line-through" : "none" }}>{o.label}</span>
              <span style={{ marginLeft: "auto", ...MONO, fontSize: 22, color: gone ? C.lit : won ? C.ok : C.muted, letterSpacing: "0.12em" }}>
                {gone ? `Out on lap ${o.out}` : won ? `Called it · +50` : o.sub}
              </span>
            </div>
          );
        })}
        {f >= b(4.3) && !picked && (
          <div style={{ position: "absolute", left: 60, right: 60, top: OY + cy * (OH + OG), height: OH, boxSizing: "border-box",
            border: `3px solid ${C.lit}`, boxShadow: `0 0 30px ${C.lit}88` }} />
        )}

        {/* how sure: the stake, all in */}
        <div style={{ position: "absolute", left: 60, right: 60, top: OY + 3 * (OH + OG) + 24, display: "flex", gap: 16 }}>
          {[["10", "A hunch"], ["25", "Pretty sure"], ["50", "All in"]].map(([v, k], i) => {
            const p = interpolate(f, [b(5.7) + i * 3, b(5.7) + i * 3 + 10], [0, 1], { ...clamp, easing: out });
            const lit = staked && v === "50";
            return (
              <div key={v} style={{ flex: 1, height: 96, boxSizing: "border-box", border: `3px solid ${lit ? C.lit : EDGE}`, background: lit ? "#3a0603" : CARD,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 16, opacity: p, transform: `translateY(${(1 - p) * 30}px)`,
                boxShadow: lit ? `0 0 ${40 * (0.4 + ring(f, [b(6.2)], 10))}px ${C.lit}88` : "none" }}>
                <span style={{ ...WIDE, fontSize: 44, color: lit ? "#fff" : "#ffffffb0" }}>{v}</span>
                <span style={{ ...MONO, fontSize: 18, color: lit ? "#fff" : C.muted, letterSpacing: "0.12em" }}>{k}</span>
              </div>
            );
          })}
        </div>
        <SeasonFigure f={f} at={b(8.5)} n={ACT.season.calls} label={`calls across ${ACT.season.markets} races and sprints`} top={1590} />
      </AbsoluteFill>
      <Flash hits={[b(2.4), outAt]} decay={5} max={0.35} />
    </AbsoluteFill>
  );
};

/* ---------- Paddock exchange: the market of the race, three drivers' prices lap by lap ---------- */

const EX = ACT.exchange;

export const ExchangeInfo: React.FC = () => {
  const f = useFrame();
  const b = slow(K0 + 17, 1.35);
  // ...and the exchange arrives from the right in the same pan
  const enter = interpolate(f, [0, 10], [1, 0], { ...clamp, easing: Easing.out(Easing.cubic) });
  const X0 = 170, X1 = 860, Y0 = 640, Y1 = 1150, TOP = 115;
  const px = (lap: number) => X0 + (lap / EX.laps) * (X1 - X0);
  const py = (v: number) => Y1 - (v / TOP) * (Y1 - Y0);
  // the race plays through the chart, the grid to the flag
  const lap = interpolate(f, [b(0.9), b(5.2)], [0, EX.laps], { ...clamp, easing: Easing.inOut(Easing.sin) });
  const crashAt = b(0.9) + (Math.acos(1 - 2 * ((EX.verOut ?? EX.laps) / EX.laps)) / Math.PI) * (b(5.2) - b(0.9));
  const done = f >= b(5.2);
  const sold = f >= b(5.5);
  const s = shake(f, [crashAt], 12, 6);
  const buy = EX.buy, sell = EX.sell;
  const stake = 100, after = Math.round(1000 - stake + (stake / buy.price) * sell.price);
  const wallet = interpolate(f, [b(5.6), b(6.6)], [1000, after], { ...clamp, easing: out });
  const path = (prices: number[]) => {
    const n = Math.floor(lap);
    let d = `M ${px(0)} ${py(prices[0])}`;
    for (let l = 1; l <= n; l++) d += ` H ${px(l)} V ${py(prices[l])}`;
    if (lap > n && n < EX.laps) d += ` H ${px(lap)}`;
    return d;
  };
  return (
    <AbsoluteFill style={{ background: WORLD, overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `translate(${s.x + enter * 1080}px, ${s.y + 40}px)`, filter: `blur(${enter * 8}px)` }}>
        <div style={{ position: "absolute", left: 72, right: 60, top: 220 }}>
          <div style={{ ...MONO, fontSize: 32, color: C.lit }}>03 / 03 · Paddock exchange</div>
          <div style={{ ...WIDE, fontSize: 84, color: "#fff", marginTop: 18 }}>Buy low.</div>
          <div style={{ ...WIDE, fontSize: 84, ...GLOW, marginTop: 4, ...smear(f, b(0.3), "left", 8) }}>Sell high.</div>
          <div style={{ ...BODY, fontSize: 36, color: "#ffffffb0", marginTop: 22, ...smear(f, b(0.6), "left", 8) }}>Every driver is worth his place, lap by lap</div>
        </div>

        {/* the ladder: what a place is worth */}
        {[[TOP - 5, "P1 · 110"], [55, "P12 · 55"], [0, ""]].map(([v, l]) => (
          <React.Fragment key={String(l)}>
            <div style={{ position: "absolute", left: X0, width: X1 - X0, top: py(Number(v)), height: 2, background: "#ffffff1c", ...smear(f, b(0.7), "left", 8) }} />
            <div style={{ position: "absolute", left: 30, width: X0 - 46, top: py(Number(v)) - 14, textAlign: "right", ...MONO, fontSize: 20,
              color: C.muted, letterSpacing: "0.1em", ...smear(f, b(0.7), "left", 8) }}>{l}</div>
          </React.Fragment>
        ))}

        <svg width={1080} height={1920} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
          {EX.drivers.map((d) => (
            // the retirement is dashed: its team colour can sit close to the climber's
            <path key={d.code} d={path(d.prices)} fill="none" stroke={hex(d.colour)} strokeWidth={8} strokeLinejoin="round"
              strokeDasharray={d.role === "crash" ? "16 10" : undefined}
              style={{ filter: `drop-shadow(0 0 10px ${hex(d.colour)}aa)` }} />
          ))}
          {/* the buy, on the grid */}
          {f >= b(1) && (
            <g style={{ opacity: interpolate(f, [b(1), b(1) + 8], [0, 1], clamp) }}>
              <circle cx={px(buy.lap)} cy={py(buy.price)} r={14} fill="#fff" />
              <line x1={px(buy.lap)} y1={py(buy.price) + 20} x2={px(buy.lap)} y2={py(buy.price) + 70} stroke="#fff" strokeWidth={3} />
            </g>
          )}
          {/* the cash out, at the flag */}
          {sold && (
            <circle cx={px(sell.lap)} cy={py(sell.price)} r={16} fill={C.ok}
              style={{ filter: `drop-shadow(0 0 ${14 + 30 * ring(f, [b(5.5)], 10)}px ${C.ok})` }} />
          )}
        </svg>
        {f >= b(1) && (
          <div style={{ position: "absolute", left: px(buy.lap) - 10, top: py(buy.price) + 80, ...MONO, fontSize: 24, color: "#fff", ...smear(f, b(1), "up", 8, 30) }}>
            Buy {EX.drivers[0].name} · {buy.price}
          </div>
        )}
        {/* the line ends, named, once the race is run */}
        {done && EX.drivers.map((d) => {
          const v = d.prices[EX.laps];
          const y = py(v) - 14 + (d.role === "crash" ? -10 : d.role === "climb" ? 6 : -6);
          return (
            <div key={d.code} style={{ position: "absolute", left: X1 + 22, top: y, ...MONO, fontSize: 24, color: d.role === "climb" && sold ? C.ok : "#fff",
              letterSpacing: "0.08em", ...smear(f, b(5.2), "left", 8, 40) }}>{d.code} {v}</div>
          );
        })}
        {f >= crashAt && (
          <div style={{ position: "absolute", left: px(EX.verOut ?? EX.laps) - 420, top: py(0) + 26, width: 400, textAlign: "right", ...MONO, fontSize: 22,
            color: C.lit, letterSpacing: "0.1em", ...smear(f, crashAt, "up", 8, 30) }}>
            {EX.drivers[2].name} out · worth 0
          </div>
        )}

        {/* the wallet */}
        <div style={{ position: "absolute", left: 72, right: 60, top: 1270, ...smear(f, b(5.5), "up", 10, 50) }}>
          <div style={{ ...MONO, fontSize: 26, color: C.muted }}>Your 1,000</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 26, marginTop: 10 }}>
            <span style={{ ...WIDE, fontWeight: 900, fontSize: 120, lineHeight: 1, ...GLOW }}>{Math.round(wallet).toLocaleString("en-GB")}</span>
            <span style={{ ...MONO, fontSize: 30, color: C.ok }}>+{(after - 1000).toLocaleString("en-GB")}</span>
          </div>
          <div style={{ ...BODY, fontSize: 36, color: "#ffffffc8", marginTop: 16 }}>
            {stake} on {EX.drivers[0].name} at {buy.price}, cashed out at {sell.price}
          </div>
        </div>
        <SeasonFigure f={f} at={b(7.4)} n={ACT.season.markets} label="races and sprints to trade" top={1600} />
      </AbsoluteFill>
      <Flash hits={[crashAt]} decay={5} max={0.4} />
    </AbsoluteFill>
  );
};

/* ---------- one second of the real thing after each drawing ---------- */

export const Proof: React.FC<{ name: "call" | "exchange"; t0: number; speed: number }> = ({ name, t0, speed }) => {
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
