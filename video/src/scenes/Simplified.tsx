/**
 * Beats 75-112. The bass drops out for five beats: lap 51, lap 52, and the
 * board spells PLAY THE RACE. Beat 80 is the drop: 02 Simplified, then the
 * two activities drawn from their real data (Activities.tsx), a second of
 * the site after each, and the season at a sprint into the splice.
 */
import React from "react";
import { AbsoluteFill, Easing, Freeze, Img, interpolate } from "remotion";
import { clipFrame } from "../Clip";
import { BlindInfo, PitInfo, WORLD as WORLD_RED } from "./Activities";
import { at, Blur, BODY, C, clamp, Flash, GLOW, GPS, hum, MONO, out, ring, smear, Track, WIDE } from "../kit";
import { span, useFrame, Seq, SCALE, X } from "../time";

/* ---------- the turn, beats 75-80. The phone that showed the race turns
   round: its back is the red card of 02 Simplified, and on the drop the
   card grows to be the whole frame. Reading the race becomes playing it,
   with one object and no cut. ---------- */

/** the red side, laid out as the full frame it becomes on beat 80 */
const RedFace: React.FC = () => (
  <div style={{ position: "absolute", left: 0, top: 0, width: 1080, height: 1920, background: C.brand }}>
    <div style={{ position: "absolute", left: 72, right: 60, top: 700 }}>
      <div style={{ ...MONO, fontSize: 30, color: "#fff" }}>03 / 03 · Simplified</div>
      <div style={{ ...WIDE, fontSize: 112, color: "#0a0a0a", marginTop: 26 }}>Play it.</div>
    </div>
  </div>
);

export const Breakdown: React.FC = () => {
  const f = useFrame();
  const b = at(75 + X);
  const io = { ...clamp, easing: Easing.inOut(Easing.cubic) };
  // from the pose Scrolled left it in, to square-on and a touch smaller
  const settle = interpolate(f, [0, b(1.6)], [0, 1], io);
  const turn = interpolate(f, [b(1.4), b(4.3)], [0, 180], io);
  const fill = interpolate(f, [b(4.3), b(5)], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  const card = { x: 145, y: 430, w: 790, h: 1404 };
  const s0 = 1.04 - settle * 0.08;
  // the card's rect: the phone's, then the frame's
  const w = interpolate(fill, [0, 1], [card.w * s0, 1080]);
  const h = interpolate(fill, [0, 1], [card.h * s0, 1920]);
  const cx = 540, cy = interpolate(fill, [0, 1], [card.y + card.h / 2, 960]);
  const ry = 2.5 * (1 - settle) + turn;
  const rx = 4 * (1 - settle);
  const glow = interpolate(f, [b(1.4), b(4.3)], [0.2, 1], clamp);
  return (
    <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 60% 45% at 50% 55%, #e1060038, transparent 70%)`, opacity: glow }} />
      <div style={{ position: "absolute", inset: 0, perspective: 2600 }}>
        <div style={{ position: "absolute", left: cx - w / 2, top: cy - h / 2, width: w, height: h,
          transformStyle: "preserve-3d", transform: `rotateY(${ry}deg) rotateX(${rx}deg)` }}>
          {/* front: the race page where Alfred left it */}
          <div style={{ position: "absolute", inset: 0, borderRadius: 34, overflow: "hidden", backfaceVisibility: "hidden",
            boxShadow: "0 0 0 2px #ffffff1a, 0 70px 180px #000, 0 0 160px #e1060048" }}>
            <Img src={clipFrame("sMate", 999)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          {/* back: the red card */}
          <div style={{ position: "absolute", inset: 0, borderRadius: 34 * (1 - fill), overflow: "hidden", backfaceVisibility: "hidden",
            transform: "rotateY(180deg)", boxShadow: `0 0 ${120 * glow}px #e10600aa` }}>
            <div style={{ position: "absolute", left: 0, top: 0, transformOrigin: "0 0", transform: `scale(${w / 1080}, ${h / 1920})` }}>
              <RedFace />
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ---------- the drop, beats 80-84 ---------- */

const K0 = 80 + X;
const k = at(K0);

/** the two drawings the act is about to show, as they end: Antonelli named, the pit call priced */
const BLIND_DONE = <Freeze frame={(span(84, 97) - 14) * SCALE}><BlindInfo /></Freeze>;
const PIT_DONE = <Freeze frame={(span(97, 112) - 4) * SCALE}><PitInfo /></Freeze>;

const Drop: React.FC = () => {
  const f = useFrame();
  const b = at(K0);
  const io = { ...clamp, easing: Easing.inOut(Easing.cubic) };
  // the drop: a ring of light leaves the centre of the red
  const shock = interpolate(f, [0, 16], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  // the title steps up to make room
  const up = interpolate(f, [b(0.2), b(1.2)], [0, 1], io);
  // the two games arrive from deep in the red, one after the other
  const CARD = { w: 420, h: 747, top: 760 };
  const cards = [
    { scene: BLIND_DONE, cx: 300, ry: 14, at: 0.6, label: "Guess the driver" },
    { scene: PIT_DONE, cx: 780, ry: -14, at: 0.9, label: "Call the pit stop" },
  ];
  // and the camera dives into the first one: it fills the frame exactly (420x747 is 9:16)
  const dive = interpolate(f, [b(2.9), b(4)], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  const S = 1 + dive * (1080 / CARD.w - 1);
  const ox = cards[0].cx, oy = CARD.top + CARD.h / 2;
  const tx = (540 - ox) * dive, ty = (960 - oy) * dive;
  const toWorld = interpolate(f, [b(4) - 6, b(4)], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ background: C.brand, overflow: "hidden" }}>
      <AbsoluteFill style={{ transformOrigin: `${ox}px ${oy}px`, transform: `translate(${tx}px, ${ty}px) scale(${S})` }}>
        <AbsoluteFill style={{ background: "radial-gradient(ellipse 80% 60% at 50% 62%, #ff3a1a, transparent 70%)", opacity: 0.6 }} />
        {shock < 1 && (
          <div style={{ position: "absolute", left: 540 - 1400 * shock, top: 960 - 1400 * shock, width: 2800 * shock, height: 2800 * shock,
            borderRadius: "50%", border: `${Math.max(1, 26 * (1 - shock))}px solid #ffd8cc`, opacity: 1 - shock,
            boxShadow: "0 0 60px #fff8" }} />
        )}
        <div style={{ position: "absolute", left: 72, right: 60, top: 700 - up * 470 }}>
          <div style={{ ...MONO, fontSize: 30, color: "#fff" }}>03 / 03 · Simplified</div>
          <div style={{ ...WIDE, fontSize: 112, color: "#0a0a0a", marginTop: 26 }}>Play it.</div>
          <div style={{ ...BODY, fontSize: 46, color: "#0a0a0a", lineHeight: 1.22, marginTop: 34, ...smear(f, b(0.7), "left", 10) }}>
            Guess the driver,
            <br />
            call the pit stop
          </div>
        </div>
        <div style={{ position: "absolute", inset: 0, perspective: 1800 }}>
          {cards.map((c, i) => {
            const p = interpolate(f, [b(c.at), b(c.at + 1.1)], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
            const flat = i === 0 ? dive : 0;
            return (
              <div key={i} style={{ position: "absolute", left: c.cx - CARD.w / 2, top: CARD.top, width: CARD.w, height: CARD.h + 70,
                opacity: Math.min(1, p * 1.6) * (i === 1 ? 1 - dive * 1.5 : 1),
                transform: `translate3d(0, ${(1 - p) * 260}px, ${(1 - p) * -1600}px) rotateY(${c.ry * (1 - flat)}deg)` }}>
                <div style={{ width: CARD.w, height: CARD.h, borderRadius: 26 * (1 - flat), overflow: "hidden",
                  boxShadow: "0 0 0 2px #00000033, 0 50px 120px #5a0000cc" }}>
                  <div style={{ width: 1080, height: 1920, transformOrigin: "0 0", transform: `scale(${CARD.w / 1080})` }}>{c.scene}</div>
                </div>
                <div style={{ ...MONO, fontSize: 24, color: "#0a0a0a", marginTop: 26, textAlign: "center", opacity: 1 - dive * 3 }}>{c.label}</div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: WORLD_RED, opacity: toWorld }} />
    </AbsoluteFill>
  );
};

export const Simplified: React.FC = () => (
  <AbsoluteFill>
    <Seq durationInFrames={k(4)}><Drop /></Seq>
    <Seq from={k(4)} durationInFrames={span(K0 + 4, K0 + 17)}><BlindInfo /></Seq>
    <Seq from={k(17)} durationInFrames={span(K0 + 17, K0 + 32)}><PitInfo /></Seq>
  </AbsoluteFill>
);
