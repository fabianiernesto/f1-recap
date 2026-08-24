"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Brain, CardData, MateThread, Story, Track } from "@/lib/types";
import { DecisionBody, GuessBody, PredictionBody } from "./CallIt";
import RaceMate from "./RaceMate";

/* ---------- helpers ---------- */

/** Slides a run of points sideways, so a strip can hug the edge of the road. */
function offsetRun(run: [number, number][], off: number): string {
  const out: string[] = [];
  for (let i = 0; i < run.length; i++) {
    const p = run[i];
    const a = run[Math.max(0, i - 1)];
    const b = run[Math.min(run.length - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const m = Math.hypot(dx, dy) || 1;
    out.push(`${p[0] + (-dy / m) * off} ${p[1] + (dx / m) * off}`);
  }
  return "M " + out.join(" L ");
}

function variant(c: CardData): string {
  if (c.type === "cover") return "v-cover";
  if (c.type === "share") return "v-share";
  if (c.type === "prediction") return "v-pred";
  if (c.type === "decision" || c.type === "guess") return "v-call";
  const k = (c.kicker || "").toLowerCase();
  // chequered before red: "chequered flag" contains the substring "red flag",
  // and the finish was being dressed as a stoppage
  if (k.includes("chequered")) return "v-final";
  if (k.includes("safety")) return "v-sc";
  if (k.includes("red flag")) return "v-red";
  if (k.includes("yellow")) return "v-yellow";
  if (k.includes("fastest")) return "v-fast";
  if (k.includes("busiest")) return "v-num";
  return "";
}

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  return m ? `${m}:${(s - m * 60).toFixed(3).padStart(6, "0")}` : s.toFixed(3);
}

/* ---------- component ---------- */

export default function RaceScroll({
  story,
  track,
  mate,
  brain,
}: {
  story: Story;
  track: Track;
  mate?: MateThread | null;
  brain?: Brain | null;
}) {
  const cards = story.cards;
  const [lap, setLap] = useState(0);
  const [activeIdx, setActiveIdx] = useState(0);
  const [litLabel, setLitLabel] = useState(-1);

  const carRef = useRef<SVGGElement>(null);
  const traceRef = useRef<SVGPathElement>(null);
  const pbarRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  /* track geometry, computed once */
  const geo = useMemo(() => {
    const pts = track.points;
    const d = "M " + pts.map((p) => p[0] + " " + p[1]).join(" L ");
    const cum = [0];
    for (let i = 1; i < pts.length; i++)
      cum.push(
        cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
      );
    const total = cum[cum.length - 1];
    const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    const labels = track.corners.map((c) => {
      const dx = c.x - cx, dy = c.y - cy, m = Math.hypot(dx, dy) || 1;
      return { ...c, lx: c.x + (dx / m) * 46, ly: c.y + (dy / m) * 46 };
    });
    /* a tick per corner instead of a name per corner: eleven labels pinned
       over the drawing fought the track itself, so the corner you are at
       says its name and the rest are just marks on the edge */
    const marks = track.corners.map((c) => {
      let bi = 0, bd = Infinity;
      pts.forEach((p, i) => {
        const dd = Math.hypot(p[0] - c.x, p[1] - c.y);
        if (dd < bd) { bd = dd; bi = i; }
      });
      const p = pts[bi];
      const a = pts[Math.max(0, bi - 2)], b = pts[Math.min(pts.length - 1, bi + 2)];
      const dx = b[0] - a[0], dy = b[1] - a[1], m = Math.hypot(dx, dy) || 1;
      let nx = -dy / m, ny = dx / m;
      if (nx * (cx - p[0]) + ny * (cy - p[1]) > 0) { nx = -nx; ny = -ny; }
      return {
        label: c.label,
        x1: p[0] + nx * 13, y1: p[1] + ny * 13,
        x2: p[0] + nx * 24, y2: p[1] + ny * 24,
        tx: p[0] + nx * 32, ty: p[1] + ny * 32 + 5,
        anchor: nx > 0.3 ? "start" : nx < -0.3 ? "end" : "middle",
      };
    });

    /* kerbs, on the outside of each corner only: the sign of the turn says
       which side of the road that is, and a straight never gets one */
    const kerbs = track.corners
      .map((c) => {
        let bi = 0, bd = Infinity;
        pts.forEach((p, i) => {
          const dd = Math.hypot(p[0] - c.x, p[1] - c.y);
          if (dd < bd) { bd = dd; bi = i; }
        });
        const span = 6;
        const lo = Math.max(0, bi - span), hi = Math.min(pts.length - 1, bi + span);
        const run = pts.slice(lo, hi + 1) as [number, number][];
        if (run.length < 4) return null;
        const v1x = pts[bi][0] - run[0][0], v1y = pts[bi][1] - run[0][1];
        const v2x = run[run.length - 1][0] - pts[bi][0];
        const v2y = run[run.length - 1][1] - pts[bi][1];
        const cross = v1x * v2y - v1y * v2x;
        return offsetRun(run, 11 * (cross > 0 ? -1 : 1));
      })
      .filter((d): d is string => !!d);

    /* hoardings, dropped on the straightest ground we can find and turned to
       face the road, on the infield so the corner names keep the outside */
    const a0 = Math.atan2(pts[1][1] - pts[0][1], pts[1][0] - pts[0][0]);
    const sf = {
      x1: pts[0][0] + Math.cos(a0 + Math.PI / 2) * 14,
      y1: pts[0][1] + Math.sin(a0 + Math.PI / 2) * 14,
      x2: pts[0][0] - Math.cos(a0 + Math.PI / 2) * 14,
      y2: pts[0][1] - Math.sin(a0 + Math.PI / 2) * 14,
    };
    return { d, cum, total, labels, marks, sf, kerbs };
  }, [track]);

  /* scroll + car animation */
  useEffect(() => {
    const pts = track.points;
    const { cum, total, labels } = geo;

    const trackPoint = (dist: number) => {
      let lo = 0, hi = cum.length - 1;
      while (lo < hi) {
        const m = (lo + hi) >> 1;
        if (cum[m] < dist) lo = m + 1;
        else hi = m;
      }
      const i = Math.max(1, lo);
      const t = (dist - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
      return {
        x: ax + (bx - ax) * t,
        y: ay + (by - ay) * t,
        angle: (Math.atan2(by - ay, bx - ax) * 180) / Math.PI + 90,
      };
    };

    let target = trackPoint(0);
    const cur = { ...target };
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let lastTick = 0;
    let raf = 0;

    const setCar = () => {
      carRef.current?.setAttribute(
        "transform",
        `translate(${cur.x} ${cur.y}) rotate(${cur.angle}) scale(0.62) translate(-15 -39)`
      );
    };

    const onScroll = () => {
      const maxY = document.documentElement.scrollHeight - innerHeight;
      const prog = maxY ? Math.min(1, Math.max(0, scrollY / maxY)) : 0;
      if (pbarRef.current) pbarRef.current.style.width = prog * 100 + "%";

      target = trackPoint(prog * (total - 0.01));
      traceRef.current?.setAttribute("stroke-dashoffset", String(total * (1 - prog)));
      if (performance.now() - lastTick > 200) {
        cur.x = target.x; cur.y = target.y; cur.angle = target.angle;
        setCar();
      }

      let nearest = -1, nd = 1e9;
      labels.forEach((L, i) => {
        const dd = Math.hypot(L.x - target.x, L.y - target.y);
        if (dd < nd) { nd = dd; nearest = i; }
      });
      setLitLabel(nd < 130 ? nearest : -1);

      const mid = scrollY + innerHeight / 2;
      let best = 0, bd = 1e9;
      cardRefs.current.forEach((el, i) => {
        if (!el) return;
        const cyy = el.offsetTop + el.offsetHeight / 2;
        const dd = Math.abs(cyy - mid);
        if (dd < bd) { bd = dd; best = i; }
      });
      setActiveIdx(best);

      const carDocY = scrollY + innerHeight * 0.42;
      const anchors = cardRefs.current
        .map((el, i) => ({ el, lap: cards[i]?.lap ?? 0 }))
        .filter((a): a is { el: HTMLDivElement; lap: number } => !!a.el);
      let lapNow = 0;
      for (let i = 0; i < anchors.length; i++) {
        const y = anchors[i].el.offsetTop;
        const next = anchors[i + 1];
        if (!next || carDocY < next.el.offsetTop) {
          if (next) {
            const t = Math.max(0, Math.min(1, (carDocY - y) / (next.el.offsetTop - y)));
            lapNow = anchors[i].lap + t * (next.lap - anchors[i].lap);
          } else lapNow = anchors[i].lap;
          if (carDocY >= y) break;
        }
      }
      setLap(Math.max(0, Math.round(lapNow)));
    };

    const tick = () => {
      lastTick = performance.now();
      const k = reduce ? 1 : 0.16;
      cur.x += (target.x - cur.x) * k;
      cur.y += (target.y - cur.y) * k;
      let da = target.angle - cur.angle;
      da = ((da + 540) % 360) - 180;
      cur.angle += da * k;
      setCar();
      raf = requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver(
      (es) => es.forEach((en) => en.isIntersecting && en.target.classList.add("seen")),
      { threshold: 0.25 }
    );
    cardRefs.current.forEach((el) => el && io.observe(el));

    onScroll();
    raf = requestAnimationFrame(tick);
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", onScroll);
      io.disconnect();
    };
  }, [geo, cards, track.points]);

  return (
    <>
      <div className="pbar" ref={pbarRef} />

      {/* the badge only repeated what the bar above already says, and both
          it and the lap counter were hidden behind that bar anyway */}
      <div className="hud">
        <div className="lapbox">
          <span className="lbl">LAP</span>
          <span className="n">
            {lap}
            <small> / {story.laps}</small>
          </span>
        </div>
      </div>

      <div className="trackwrap">
        <svg viewBox={`0 0 ${track.view} ${track.view}`}>
          {/* a real road: kerb-gray edges around dark asphalt, with the red
              racing line lighting up as the reader drives through the story */}
          <path d={geo.d} fill="none" stroke="#464B55" strokeWidth={21} strokeLinejoin="round" />
          <path d={geo.d} fill="none" stroke="#1a1d24" strokeWidth={16} strokeLinejoin="round" />
          <path
            ref={traceRef}
            d={geo.d}
            fill="none"
            stroke="var(--led)"
            strokeWidth={5}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={geo.total}
            strokeDashoffset={geo.total}
          />
          {/* kerbs last of the road furniture, so they sit on the tarmac edge */}
          <g className="tk-kerbs">
            {geo.kerbs.map((d, i) => (
              <g key={i}>
                <path d={d} fill="none" stroke="#dfe1e6" strokeWidth={6} />
                <path d={d} fill="none" stroke="#c0261e" strokeWidth={6}
                      strokeDasharray="8 8" />
              </g>
            ))}
          </g>

          <g id="tk-labels" className="tk-marks">
            {geo.marks.map((M, i) => (
              <g key={M.label} className={i === litLabel ? "on" : ""}>
                <line x1={M.x1} y1={M.y1} x2={M.x2} y2={M.y2} />
                {i === litLabel && (
                  <text x={M.tx} y={M.ty} textAnchor={M.anchor}>{M.label}</text>
                )}
              </g>
            ))}
          </g>
          <line
            x1={geo.sf.x1} y1={geo.sf.y1} x2={geo.sf.x2} y2={geo.sf.y2}
            stroke="#F2F3F5" strokeWidth={4} strokeDasharray="4 3"
          />
          <g ref={carRef}>
            <rect x="1" y="1" width="28" height="4.5" rx="1" fill="#23262E" />
            <rect x="0.5" y="0.5" width="2.6" height="6.5" rx="1" fill="#2E323C" />
            <rect x="26.9" y="0.5" width="2.6" height="6.5" rx="1" fill="#2E323C" />
            <path d="M13 5 L17 5 L16.2 22 L13.8 22 Z" fill="#15171D" />
            <rect x="13.9" y="6.5" width="2.2" height="12" rx="1" fill="#E10600" />
            <rect x="2.5" y="10.5" width="6.2" height="12.5" rx="2.4" fill="#0D0E11" stroke="#33363E" />
            <rect x="21.3" y="10.5" width="6.2" height="12.5" rx="2.4" fill="#0D0E11" stroke="#33363E" />
            <path d="M11 22 L19 22 L21.5 34 L21.5 52 L19 56 L11 56 L8.5 52 L8.5 34 Z" fill="#B9BEC7" />
            <ellipse cx="15" cy="30.5" rx="4.6" ry="3.6" fill="none" stroke="#3C404A" strokeWidth="1.6" />
            <ellipse cx="15" cy="33.5" rx="3" ry="4.2" fill="#0D0E11" />
            <rect x="14.3" y="38" width="1.4" height="16" rx="0.7" fill="#23262E" />
            <rect x="1.8" y="53" width="7.4" height="13.5" rx="2.6" fill="#0D0E11" stroke="#33363E" />
            <rect x="20.8" y="53" width="7.4" height="13.5" rx="2.6" fill="#0D0E11" stroke="#33363E" />
            <rect x="4.5" y="69" width="21" height="5" rx="1" fill="#23262E" />
            <rect x="4.5" y="74.6" width="21" height="1.8" rx="0.9" fill="#15171D" />
            <rect x="3.6" y="68" width="2.2" height="9.5" rx="1" fill="#2E323C" />
            <rect x="24.2" y="68" width="2.2" height="9.5" rx="1" fill="#2E323C" />
          </g>
        </svg>
      </div>
      <div className="trackcap">Real track shape · fastest-lap telemetry</div>

      <div className="flow" id="race">
        {cards.map((c, i) => {
          const v = variant(c);
          const time = v === "v-fast" ? /([\d.]+)s/.exec(c.title || "") : null;
          const num = v === "v-num" ? /\d+/.exec(c.title || "") : null;
          return (
            <div key={i} style={{ display: "contents" }}>
              {i > 0 && <div className="spacer" />}
              <div className={`stop ${i % 2 ? "s-right" : "s-left"}`}>
                {c.type === "moment" && (c.lap ?? 0) > 1 && (
                  <div className="biglap">{c.lap}</div>
                )}
                <div
                  ref={(el) => { cardRefs.current[i] = el; }}
                  className={`card ${v} ${i === activeIdx ? "" : "dim"}`}
                  data-lap={c.lap ?? 0}
                >
                  <span className="kicker">{c.kicker}</span>

                  {v === "v-fast" && time ? (
                    <>
                      <div className="bigtime">
                        {fmtTime(+time[1])}
                        <small> · {(c.title || "").split(":")[0].toUpperCase()}</small>
                      </div>
                      <h2>Fastest lap of the race</h2>
                    </>
                  ) : (
                    <h2>{c.title}</h2>
                  )}

                  {num && <div className="bignum">{num[0]}</div>}
                  {c.text && <p>{c.text}</p>}
                  {c.bullets && c.bullets.length > 0 && (
                    <ul className="pts">
                      {c.bullets.map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                  )}
                  {c.note && <p className="note">{c.note}</p>}

                  {c.type === "decision" && <DecisionBody card={c} />}
                  {c.type === "guess" && <GuessBody card={c} />}

                  {c.type === "prediction" && (
                    <PredictionBody card={c} />
                  )}

                  {/* the table is the card's evidence, so it stays open: it
                      used to hide behind a button nobody was pressing */}
                  {c.dato && c.dato.rows.length > 0 && (
                    <div className="dato">
                      <b>{c.dato.label}</b>
                      <table>
                        <tbody>
                          {c.dato.rows.map((r) => (
                            <tr key={r[0]}>
                              <td>{r[0]}</td>
                              <td>{r[1]}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {c.type === "share" && (
                    <div className="opts">
                      <button className="chip">Send it to the group chat</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div className="credits">
          Built from OpenF1 + FastF1 data · {story.generated}
        </div>
      </div>
      {mate && <RaceMate thread={mate} lap={lap} brain={brain ?? null} />}
    </>
  );
}
