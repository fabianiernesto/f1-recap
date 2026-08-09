import type { Story, Track } from "@/lib/types";
import { BigBen, LandmarkPhoto, Skyline, landmarkPhoto } from "./Landmark";

/**
 * GP hero — the vertical poster (ref Ogilvy Turkish GP): a night sky crossed by
 * light trails, the real circuit as a dotted map with numbered corners, and the
 * country's landmark anchoring the composition. Type stays monumental (Drellex).
 */

// deterministic star field: no Math.random, so server and client agree
const STARS = Array.from({ length: 60 }, (_, i) => {
  const x = (i * 137.508) % 100;
  const y = ((i * i * 37) % 63) + 2;
  const r = ((i * 7) % 3) * 0.35 + 0.5;
  const o = 0.25 + (((i * 13) % 10) / 10) * 0.55;
  return { x, y, r, o };
});

export default function GPHero({
  story,
  track,
  date,
  slug,
}: {
  story: Story;
  track: Track;
  date: string;
  slug: string;
}) {
  const photo = landmarkPhoto(slug);
  const pts = track.points;
  const d = "M " + pts.map((p) => p[0] + " " + p[1]).join(" L ");

  const a0 = Math.atan2(pts[1][1] - pts[0][1], pts[1][0] - pts[0][0]);
  const nx = Math.cos(a0 + Math.PI / 2);
  const ny = Math.sin(a0 + Math.PI / 2);

  const moments = story.cards.filter((c) => c.type === "moment").length;
  const calls = story.cards.filter((c) => c.type === "prediction").length;
  const short = story.gp.replace(/ \d{4}$/, "");

  return (
    <section className="hero">
      {/* --- night sky --- */}
      <svg className="hero-stars" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        {STARS.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r * 0.08} fill="#fff" opacity={s.o} />
        ))}
      </svg>

      {/* --- light trails sweeping the whole poster --- */}
      <svg className="hero-trails" viewBox="0 0 1200 1400" preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id="trail" x1="0" y1="0" x2="1" y2="0.6">
            <stop offset="0%" stopColor="#ff2d1a" stopOpacity="0" />
            <stop offset="38%" stopColor="#ff5a2a" stopOpacity="0.8" />
            <stop offset="72%" stopColor="#ffb45e" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#ffe6a8" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 13, 26, 39, 52, 65, 78].map((o, i) => (
          <path
            key={o}
            d={`M -140 ${180 + o * 1.5} C 340 ${-40 + o}, 620 ${640 + o}, 1340 ${300 + o}`}
            fill="none"
            stroke="url(#trail)"
            strokeWidth={i === 3 ? 7 : 2}
          />
        ))}
        {[0, 18, 36, 54].map((o, i) => (
          <path
            key={`b${o}`}
            d={`M -140 ${1180 + o} C 420 ${1320 + o}, 760 ${900 + o}, 1340 ${1020 + o}`}
            fill="none"
            stroke="url(#trail)"
            strokeWidth={i === 1 ? 5 : 1.8}
            opacity={0.75}
          />
        ))}
      </svg>

      <div className="hero-meta">
        <span>RACE // RECAP</span>
        <span>{date}</span>
        <span>#{short.replace(/\s/g, "")}</span>
      </div>

      {/* --- headline --- */}
      <div className="hero-head">
        <h1 className="hero-title">{track.circuit}</h1>
        <div className="hero-kicker">
          {short} · {story.laps} laps · Great Britain
        </div>
      </div>

      {/* --- middle band: text / map / text, Ogilvy layout --- */}
      <div className="hero-band">
        <p className="hero-note hero-note-l">
          Fifty-two laps at the fastest, most committed circuit on the calendar.
          A safety car with four to go. A fight that only settled at the flag.
        </p>

        <div className="hero-map">
          <svg viewBox={`0 0 ${track.view} ${track.view}`} aria-hidden>
            <path
              d={d}
              fill="none"
              stroke="#ffffff"
              strokeWidth={3.5}
              strokeLinecap="round"
              strokeDasharray="0.5 13"
              opacity={0.85}
            />
            <line
              x1={pts[0][0] + nx * 17}
              y1={pts[0][1] + ny * 17}
              x2={pts[0][0] - nx * 17}
              y2={pts[0][1] - ny * 17}
              stroke="#ffffff"
              strokeWidth={4}
            />
            {track.corners.map((c, i) => (
              <g key={c.label}>
                <circle cx={c.x} cy={c.y} r={13} fill="#0d0507" stroke="#ffffff"
                  strokeWidth={1.3} opacity={0.9} />
                <text x={c.x} y={c.y + 5} textAnchor="middle" fill="#ffffff" fontSize={14}
                  style={{ fontFamily: "var(--font-mono)" }}>
                  {i + 1}
                </text>
              </g>
            ))}
            <g transform={`translate(${track.view - 60} 76)`}>
              <text x={0} y={-15} textAnchor="middle" fill="#ffffff" fontSize={22} opacity={0.75}
                style={{ fontFamily: "var(--font-display)" }}>N</text>
              <path d="M0 -9 L6 9 L0 4.5 L-6 9 Z" fill="#ffffff" opacity={0.75} />
            </g>
          </svg>
        </div>

        <div className="hero-note hero-note-r">
          <p>
            This is the whole race, told the way a friend would tell it: no
            spoilers up front, no homework, just the moments that decided it.
          </p>
          <div className="hero-stats">
            <div><b>{story.laps}</b><span>Laps</span></div>
            <div><b>{moments}</b><span>Moments</span></div>
            <div><b>{calls}</b><span>Calls to make</span></div>
          </div>
        </div>
      </div>

      {/* --- landmark + skyline anchor the poster --- */}
      <div className="hero-city">
        <Skyline className="hero-skyline" />
        {photo ? (
          <LandmarkPhoto src={photo} alt={`${track.circuit} landmark`} />
        ) : (
          <BigBen className="hero-landmark" />
        )}
        <div className="hero-cta-wrap">
          <a className="hero-cta" href="#race">Enter the race</a>
          <span className="hero-foot">Scroll to race</span>
        </div>
      </div>
    </section>
  );
}
