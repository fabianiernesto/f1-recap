"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CardData, Story, Track } from "@/lib/types";

/* ---------- helpers ---------- */

function variant(c: CardData): string {
  if (c.type === "cover") return "v-cover";
  if (c.type === "share") return "v-share";
  if (c.type === "prediction") return "v-pred";
  const k = (c.kicker || "").toLowerCase();
  if (k.includes("safety")) return "v-sc";
  if (k.includes("fastest")) return "v-fast";
  if (k.includes("chequered")) return "v-final";
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
}: {
  story: Story;
  track: Track;
}) {
  const [lap, setLap] = useState(0);
  const [activeIdx, setActiveIdx] = useState(0);
  const [litLabel, setLitLabel] = useState(-1);
  const [picks, setPicks] = useState<Record<number, string>>({});
  const [openData, setOpenData] = useState<Record<number, boolean>>({});

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
    const a0 = Math.atan2(pts[1][1] - pts[0][1], pts[1][0] - pts[0][0]);
    const sf = {
      x1: pts[0][0] + Math.cos(a0 + Math.PI / 2) * 14,
      y1: pts[0][1] + Math.sin(a0 + Math.PI / 2) * 14,
      x2: pts[0][0] - Math.cos(a0 + Math.PI / 2) * 14,
      y2: pts[0][1] - Math.sin(a0 + Math.PI / 2) * 14,
    };
    return { d, cum, total, labels, sf };
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
        .map((el, i) => ({ el, lap: story.cards[i]?.lap ?? 0 }))
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
  }, [geo, story.cards, track.points]);

  return (
    <>
      <div className="pbar" ref={pbarRef} />

      <div className="hud">
        <div className="badge">
          <div className="flag" />
          <div>
            <div className="t1">{story.gp.replace(/ \d{4}$/, "")}</div>
            <div className="t2">
              {story.circuit} · {story.session}
            </div>
          </div>
        </div>
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
          <path d={geo.d} fill="none" stroke="#464B55" strokeWidth={21} strokeLinejoin="round" />
          <path d={geo.d} fill="none" stroke="var(--carbon-2)" strokeWidth={16} strokeLinejoin="round" />
          <path
            ref={traceRef}
            d={geo.d}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={5}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={geo.total}
            strokeDashoffset={geo.total}
          />
          <g id="tk-labels">
            {geo.labels.map((L, i) => (
              <text
                key={L.label}
                x={L.lx}
                y={L.ly}
                textAnchor="middle"
                fill={i === litLabel ? "#F2F3F5" : "#8B919D"}
                fontSize={19}
                letterSpacing={2}
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {L.label}
              </text>
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
        {story.cards.map((c, i) => {
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

                  {c.type === "prediction" && c.options && (
                    <>
                      <div className="opts">
                        {c.options.map((o) => (
                          <button
                            key={o}
                            className={`chip ${
                              picks[i]
                                ? o === c.answer
                                  ? "right"
                                  : "wrong"
                                : ""
                            }`}
                            disabled={!!picks[i]}
                            onClick={() =>
                              setPicks((s) => ({ ...s, [i]: o }))
                            }
                          >
                            {o}
                          </button>
                        ))}
                      </div>
                      {picks[i] && (
                        <>
                          <div
                            className={`verdict ${
                              picks[i] === c.answer ? "" : "verdict-bad"
                            }`}
                          >
                            {picks[i] === c.answer
                              ? "✔ CALLED IT. HERE'S HOW IT WENT DOWN:"
                              : "✘ NOT QUITE. HERE'S WHAT ACTUALLY HAPPENED:"}
                          </div>
                          {c.reveal && <p className="reveal">{c.reveal}</p>}
                        </>
                      )}
                    </>
                  )}

                  {c.dato && (
                    <>
                      <button
                        className="peek"
                        onClick={() =>
                          setOpenData((s) => ({ ...s, [i]: !s[i] }))
                        }
                      >
                        ＋ The data behind this
                      </button>
                      {openData[i] && (
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
                    </>
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
    </>
  );
}
