import { listGPs, loadStory, loadTrack } from "@/lib/data";
import type { Track } from "@/lib/types";
import "./options.css";

/** Four alternative home pages for the GP, one per moodboard reference.
 *  Preview-only route: /options. Ernesto picks one, the winner replaces GPHero. */

function trackPath(track: Track) {
  return "M " + track.points.map((p) => p[0] + " " + p[1]).join(" L ");
}

function corners(track: Track, push = 50) {
  const cx = track.points.reduce((s, p) => s + p[0], 0) / track.points.length;
  const cy = track.points.reduce((s, p) => s + p[1], 0) / track.points.length;
  return track.corners.map((c) => {
    const dx = c.x - cx, dy = c.y - cy, m = Math.hypot(dx, dy) || 1;
    return { ...c, lx: c.x + (dx / m) * push, ly: c.y + (dy / m) * push };
  });
}

export default function OptionsPage() {
  const slug = listGPs()[0];
  const story = loadStory(slug);
  const track = loadTrack(slug);
  const d = trackPath(track);
  const cs = corners(track);
  const winner = story.result?.podium[0];
  const vb = `0 0 ${track.view} ${track.view}`;

  return (
    <>
      {/* ================= A ================= */}
      <div className="opt-label">
        <b>OPTION A</b> <span>PAPER POSTER · ref Ferrari result page</span>
      </div>
      <section className="oa">
        <div className="oa-rail">
          <div className="oa-eyebrow"><i /> RACE RECAP</div>
          <div className="oa-round">
            R12<small>ROUND · SEASON 2026</small>
          </div>
          <div className="oa-card">
            <h4>Session</h4>
            <div className="oa-row"><span>Circuit</span><b>{track.circuit}</b></div>
            <div className="oa-row"><span>Date</span><b>{story.result?.date}</b></div>
            <div className="oa-row"><span>Laps</span><b>{story.laps}</b></div>
            <div className="oa-row"><span>Length</span><b>5.891 km</b></div>
          </div>
          <div className="oa-card">
            <h4>How to read this</h4>
            <div style={{ fontSize: 13, lineHeight: 1.6, color: "#4a4740" }}>
              Scroll and the car drives the real lap. Every card is a moment,
              anchored to the lap it happened on.
            </div>
          </div>
        </div>

        <div className="oa-main">
          <h1 className="oa-title">British<br />Grand Prix</h1>
          <div className="oa-sub">Silverstone · Race · 52 laps</div>
          <div className="oa-canvas">
            <svg viewBox={vb} aria-hidden>
              <path d={d} fill="none" stroke="#3a3d47" strokeWidth={16} strokeLinejoin="round" />
              <path d={d} fill="none" stroke="#E10600" strokeWidth={4} strokeDasharray="60 1200" />
            </svg>
            <div className="oa-big">52<em>laps to tell</em></div>
          </div>
        </div>

        <div className="oa-strip">
          <span>{winner ? `${winner.first} ${winner.last} · #${winner.number}` : ""}</span>
          <span>Scroll to race</span>
          <span>#BritishGP · Round 12</span>
        </div>
      </section>

      {/* ================= B ================= */}
      <div className="opt-label">
        <b>OPTION B</b> <span>RED WORLD · ref vohels immersive</span>
      </div>
      <section className="ob">
        <div className="ob-ghost">SV</div>
        <div className="ob-inner">
          <div className="ob-kicker">Round 12 · {story.result?.date}</div>
          <h1 className="ob-title">British Grand Prix</h1>
          <svg className="ob-map" viewBox={vb} aria-hidden>
            <path d={d} fill="none" stroke="#ffffff" strokeWidth={9} strokeLinejoin="round" opacity={.9} />
            {cs.slice(0, 6).map((c) => (
              <g key={c.label}>
                <circle cx={c.x} cy={c.y} r={9} fill="#0b0407" stroke="#fff" strokeWidth={3} />
                <text x={c.lx} y={c.ly} textAnchor="middle" fill="#ffc9c9" fontSize={19}
                  style={{ fontFamily: "var(--font-mono)" }}>{c.label}</text>
              </g>
            ))}
          </svg>
          <div className="ob-glass">
            <div><b>{story.laps}</b><span>Laps</span></div>
            <div><b>{story.cards.filter((c) => c.type === "moment").length}</b><span>Moments</span></div>
            <div><b>3</b><span>Calls to make</span></div>
          </div>
          <button className="ob-pill">Enter the race</button>
        </div>
      </section>

      {/* ================= C ================= */}
      <div className="opt-label">
        <b>OPTION C</b> <span>LED PIT BOARD · ref BORN TO RACE</span>
      </div>
      <section className="oc">
        <div className="oc-left">
          <div className="oc-tag">LAP 01 // RECAP</div>
          <div className="oc-led">Silverstone<br /><span>52 laps.</span> one story.</div>
          <div className="oc-stats">
            <div><b>{story.laps}</b><span>Laps</span></div>
            <div><b>18</b><span>Corners</span></div>
            <div><b>5.891</b><span>KM per lap</span></div>
          </div>
        </div>
        <dl className="oc-right">
          <dt>Start / Finish</dt>
          <dd>Where every lap begins. <em>Full throttle, 320 km/h.</em></dd>
          <dt>Copse</dt>
          <dd>Barely a corner at racing speed. The commitment test of the lap.</dd>
          <dt>Maggotts · Becketts</dt>
          <dd>Four direction changes in six seconds. <em>The best sequence in F1.</em></dd>
          <dt>Hangar Straight</dt>
          <dd>Lowest drag, highest speed. Where the passes get set up.</dd>
          <dt>Stowe</dt>
          <dd>Heavy braking from top speed. Where brave laps are won or thrown away.</dd>
          <svg className="oc-map" viewBox={vb} aria-hidden>
            <path d={d} fill="none" stroke="#E10600" strokeWidth={7} strokeLinejoin="round" />
          </svg>
        </dl>
      </section>

      {/* ================= D ================= */}
      <div className="opt-label">
        <b>OPTION D</b> <span>NIGHT POSTER · ref Ogilvy Turkish GP</span>
      </div>
      <section className="od">
        <svg className="od-trails" viewBox="0 0 1200 900" preserveAspectRatio="none" aria-hidden>
          <defs>
            <linearGradient id="tr" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ff2d1a" stopOpacity="0" />
              <stop offset="45%" stopColor="#ff6a2a" stopOpacity=".85" />
              <stop offset="100%" stopColor="#ffd36e" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 16, 32, 48, 64].map((o, i) => (
            <path key={o} d={`M -100 ${250 + o} C 300 ${60 + o}, 800 ${520 + o}, 1300 ${180 + o}`}
              fill="none" stroke="url(#tr)" strokeWidth={i === 2 ? 7 : 2.5} />
          ))}
        </svg>

        <div className="od-copy">
          <div className="od-badge">Formula 1 · Round 12 · {story.result?.date}</div>
          <h1 className="od-title">Silverstone,<br />in one scroll</h1>
          <p>
            Fifty-two laps, a safety car with four to go and a fight that only
            settled at the flag. This is the whole race, told the way a friend
            would tell it.
          </p>
          <p>
            No spoilers up front. No homework. Just the moments that decided it,
            in the order they happened.
          </p>
          <div className="od-sign">Let&apos;s go racing.</div>
        </div>

        <div className="od-map">
          <svg viewBox={vb} aria-hidden>
            <path d={d} fill="none" stroke="#ffffff" strokeWidth={3.5} strokeLinecap="round"
              strokeDasharray="0.5 13" />
            {cs.map((c, i) => (
              <g key={c.label}>
                <circle cx={c.x} cy={c.y} r={13} fill="none" stroke="#ffffff" strokeWidth={1.4} />
                <text x={c.x} y={c.y + 5} textAnchor="middle" fill="#fff" fontSize={14}
                  style={{ fontFamily: "var(--font-mono)" }}>{i + 1}</text>
              </g>
            ))}
            <g transform={`translate(${track.view - 70} 90)`}>
              <text x={0} y={-16} textAnchor="middle" fill="#fff" fontSize={22}
                style={{ fontFamily: "var(--font-display)" }}>N</text>
              <path d="M0 -10 L6 10 L0 5 L-6 10 Z" fill="#fff" />
            </g>
          </svg>
        </div>
      </section>
    </>
  );
}
