/**
 * Beats 24-32: step 01 of the spine the whole film follows (01 pick a race,
 * 02 Scrolled, 03 play it). The title and the definition lift away as the
 * phone rises, in one gesture; in the phone the real home scrolls down to
 * the circuits and along them to Silverstone, a tap opens it, and the race
 * page pushes in on beat 32, where the Scrolled act carries on in the same
 * phone without a cut.
 */
import React from "react";
import { AbsoluteFill, Easing, interpolate } from "remotion";
import { ClipFrame, markers } from "../Clip";
import { at, BODY, C, clamp, GLOW, MONO, smear, WIDE } from "../kit";
import { useFrame } from "../time";

const K0 = 24;
/** the screen, the same rect the Scrolled act uses: the site, full width, under the caption */
export const PHONE = { x: 0, y: 490, w: 1080, h: 1450 };
const S = PHONE.w / 432; // CSS px of the capture -> px of the phone

/** the step header every act uses: counter, one big line, one line under it */
export const StepHead: React.FC<{ f: number; at: number; n: string; tag?: string; word: string; glow?: boolean; children?: React.ReactNode }> = ({
  f, at: st, n, tag, word, glow, children,
}) => (
  <div style={{ position: "absolute", left: 72, right: 60, top: 208 }}>
    <div style={{ display: "flex", gap: 22, alignItems: "baseline", ...smear(f, st, "up", 9, 60) }}>
      <span style={{ ...MONO, fontSize: 30, color: C.lit }}>{n} / 03</span>
      {tag && <span style={{ ...MONO, fontSize: 30, color: "#ffffff80" }}>{tag}</span>}
    </div>
    <div style={{ ...WIDE, fontSize: 78, lineHeight: 1, marginTop: 28, ...(glow ? GLOW : { color: "#fff" }), ...smear(f, st + 2, "up", 10, 80) }}>
      {word}
    </div>
    {children}
  </div>
);

/** a tap: a dot and a ring that opens where the finger lands */
export const Tap: React.FC<{ f: number; at: number; x: number; y: number }> = ({ f, at: t, x, y }) => {
  const p = interpolate(f, [t, t + 22], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  if (f < t || p >= 1) return null;
  return (
    <>
      <div style={{ position: "absolute", left: x - 14, top: y - 14, width: 28, height: 28, borderRadius: "50%", background: "#ffffff99",
        opacity: interpolate(p, [0, 0.3, 1], [1, 0.9, 0]), boxShadow: `0 0 30px ${C.lit}` }} />
      <div style={{ position: "absolute", left: x - 90, top: y - 90, width: 180, height: 180, borderRadius: "50%",
        border: `4px solid ${C.lit}`, background: `${C.lit}14`, transform: `scale(${0.4 + p * 0.9})`, opacity: 1 - p,
        boxShadow: `0 0 30px ${C.lit}` }} />
    </>
  );
};

/** a finger on a run of taps: it travels from one to the next, presses, and a thin ring opens */
export const Fingers: React.FC<{ f: number; taps: { at: number; x: number; y: number }[] }> = ({ f, taps }) => {
  const LEAD = 11, TAIL = 9, JOIN = 60;
  const io = { ...clamp, easing: Easing.inOut(Easing.cubic) };
  const i = taps.findIndex((t) => f <= t.at + TAIL);
  let dot: React.ReactNode = null;
  if (i >= 0 && f >= taps[i].at - LEAD - 6) {
    const t = taps[i], prev = taps[i - 1], next = taps[i + 1];
    const joined = !!prev && t.at - prev.at < JOIN;
    const from = joined ? prev : { x: t.x + 60, y: t.y + 130 };
    const p = interpolate(f, [t.at - LEAD - 2, t.at], [0, 1], io);
    const op = Math.min(joined ? 1 : interpolate(f, [t.at - LEAD - 6, t.at - LEAD + 2], [0, 1], clamp),
      next && next.at - t.at < JOIN ? 1 : interpolate(f, [t.at + 1, t.at + TAIL], [1, 0], clamp));
    const press = 1 - 0.2 * interpolate(Math.abs(f - t.at), [0, 3], [1, 0], clamp);
    dot = <div style={{ position: "absolute", left: from.x + (t.x - from.x) * p - 22, top: from.y + (t.y - from.y) * p - 22, width: 44, height: 44, borderRadius: "50%",
      background: "#ffffffd8", boxShadow: `0 0 0 6px ${C.lit}55, 0 0 26px ${C.lit}`, opacity: op, transform: `scale(${press})` }} />;
  }
  return (
    <>
      {taps.map((t) => {
        const p = interpolate(f, [t.at, t.at + 16], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
        if (f < t.at || p >= 1) return null;
        return <div key={t.at} style={{ position: "absolute", left: t.x - 90, top: t.y - 90, width: 180, height: 180, borderRadius: "50%",
          border: "3px solid #fff", transform: `scale(${0.25 + p * 0.85})`, opacity: (1 - p) * 0.8 }} />;
      })}
      {dot}
    </>
  );
};

/** a finger scrolling: it goes up the screen as the page does */
export const Swipe: React.FC<{ f: number; at: number[]; len: number }> = ({ f, at: list, len }) => (
  <>
    {list.map((st) => {
      const p = interpolate(f, [st, st + len], [0, 1], clamp);
      if (p <= 0 || p >= 1) return null;
      const e = Easing.inOut(Easing.cubic)(p);
      return <div key={st} style={{ position: "absolute", left: PHONE.w * 0.82 - 22, top: PHONE.y + PHONE.h * (0.8 - e * 0.5) - 22, width: 44, height: 44, borderRadius: "50%",
        background: "#ffffffd8", boxShadow: `0 0 0 6px ${C.lit}55, 0 0 26px ${C.lit}`, opacity: Math.min(1, Math.sin(Math.PI * p) * 2.2) }} />;
    })}
  </>
);

export const HowItWorks: React.FC = () => {
  const f = useFrame();
  const b = at(K0);
  const m = markers("navhome");
  const io = { ...clamp, easing: Easing.inOut(Easing.cubic) };
  // one gesture: the title goes up and out as the phone comes up and in
  const lift = interpolate(f, [0, b(1.4)], [0, 1], io);
  const rise = interpolate(f, [b(0.2), b(1.8)], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const push = interpolate(f, [b(8) - 12, b(8)], [0, 1], io);
  const out = interpolate(f, [b(7.6), b(8)], [0, 1], clamp);
  const tapX = PHONE.x + (m.cardX + m.cardW / 2) * S;
  const tapY = PHONE.y + (m.cardY + m.cardH * 0.45) * S;
  return (
    <AbsoluteFill style={{ background: C.night, overflow: "hidden" }}>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 70% 45% at 50% 62%, #e106001c, transparent 70%)", opacity: rise }} />

      {/* the title block as the beat before left it, lifting away */}
      {lift < 1 && (
        <div style={{ position: "absolute", left: 66, right: 30, top: 700, opacity: 1 - lift,
          transform: `translateY(${-lift * 520}px)`, filter: `blur(${lift * 6}px)` }}>
          <div style={{ ...MONO, fontSize: 30, marginBottom: 34, opacity: 0 }}>Formula 1 · Season 2026</div>
          <div style={{ ...WIDE, fontSize: 102, color: "#fff" }}>
            Racing
            <div style={GLOW}>Simplified</div>
          </div>
          <div style={{ ...WIDE, fontSize: 40, lineHeight: 1.1, color: "#fff", marginTop: 50, whiteSpace: "nowrap" }}>
            The website that explains
            <br />
            every F1 race.
          </div>
          <div style={{ ...BODY, fontSize: 40, lineHeight: 1.3, color: "#ffffffd0", marginTop: 30, maxWidth: 860 }}>
            Every 2026 Grand Prix, rebuilt from the official data.
          </div>
        </div>
      )}

      <div style={{ opacity: 1 - out, transform: `translateY(${-out * 50}px)` }}>
        <StepHead f={f} at={b(1)} n="01" word="Pick a race.">
          <div style={{ ...BODY, fontSize: 38, color: "#ffffffd8", marginTop: 30, ...smear(f, b(1) + 6, "up", 10, 60) }}>Every Grand Prix of 2026</div>
        </StepHead>
      </div>

      {/* the phone */}
      <div style={{ position: "absolute", inset: 0, perspective: 2600 }}>
        <div style={{ position: "absolute", left: PHONE.x, top: PHONE.y, width: PHONE.w, height: PHONE.h, overflow: "hidden",
          transform: `translateY(${(1 - rise) * 1500}px) rotateX(${(1 - rise) * 22}deg)`,
          boxShadow: "0 -2px 0 #ffffff14" }}>
          <AbsoluteFill style={{ background: C.night, transform: `translateX(${-push * PHONE.w * 0.3}px)`, filter: `brightness(${1 - push * 0.5})` }}>
            <ClipFrame name="navhome" t={f / 30} />
          </AbsoluteFill>
          {push > 0 && (
            <AbsoluteFill style={{ background: C.night, transform: `translateX(${(1 - push) * PHONE.w}px)` }}>
              <ClipFrame name="sWeek" t={0} />
            </AbsoluteFill>
          )}
        </div>
      </div>
      <Tap f={f} at={b(7)} x={tapX} y={tapY} />
    </AbsoluteFill>
  );
};
