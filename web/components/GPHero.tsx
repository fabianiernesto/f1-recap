import type { Story, Track } from "@/lib/types";

/**
 * GP hero — red world with monumental type (ref Drellex) plus light trails and
 * a dotted, numbered circuit map (ref Ogilvy Turkish GP). No LED type.
 */
export default function GPHero({
  story,
  track,
  date,
}: {
  story: Story;
  track: Track;
  date: string;
}) {
  const pts = track.points;
  const d = "M " + pts.map((p) => p[0] + " " + p[1]).join(" L ");

  // start/finish tick, perpendicular to the racing line
  const a0 = Math.atan2(pts[1][1] - pts[0][1], pts[1][0] - pts[0][0]);
  const nx = Math.cos(a0 + Math.PI / 2);
  const ny = Math.sin(a0 + Math.PI / 2);

  const moments = story.cards.filter((c) => c.type === "moment").length;
  const calls = story.cards.filter((c) => c.type === "prediction").length;
  const short = story.gp.replace(/ \d{4}$/, "");

  return (
    <section className="hero">
      <div className="hero-bg" aria-hidden />
      <div className="hero-frame" aria-hidden />
      <div className="hero-ghost" aria-hidden>
        {track.circuit.slice(0, 2).toUpperCase()}
      </div>

      {/* light trails (Ogilvy) */}
      <svg className="hero-trails" viewBox="0 0 1200 900" preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id="trail" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ff2d1a" stopOpacity="0" />
            <stop offset="42%" stopColor="#ff5a2a" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#ffcf6e" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 14, 28, 42, 56, 70].map((o, i) => (
          <path
            key={o}
            d={`M -120 ${300 + o} C 320 ${90 + o}, 780 ${560 + o}, 1320 ${210 + o}`}
            fill="none"
            stroke="url(#trail)"
            strokeWidth={i === 3 ? 6 : 2}
          />
        ))}
      </svg>

      <div className="hero-meta">
        <span>RACE // RECAP</span>
        <span>{date}</span>
        <span>#{short.replace(/\s/g, "")}</span>
      </div>

      {/* dotted circuit with numbered corners (Ogilvy) */}
      <div className="hero-map">
        <svg viewBox={`0 0 ${track.view} ${track.view}`} aria-hidden>
          <path
            d={d}
            fill="none"
            stroke="#ffffff"
            strokeWidth={3.5}
            strokeLinecap="round"
            strokeDasharray="0.5 13"
            opacity={0.75}
          />
          <line
            x1={pts[0][0] + nx * 16}
            y1={pts[0][1] + ny * 16}
            x2={pts[0][0] - nx * 16}
            y2={pts[0][1] - ny * 16}
            stroke="#ffffff"
            strokeWidth={4}
          />
          {track.corners.map((c, i) => (
            <g key={c.label}>
              <circle cx={c.x} cy={c.y} r={13} fill="none" stroke="#ffffff" strokeWidth={1.3}
                opacity={0.8} />
              <text
                x={c.x}
                y={c.y + 5}
                textAnchor="middle"
                fill="#ffffff"
                fontSize={14}
                opacity={0.85}
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {i + 1}
              </text>
            </g>
          ))}
          <g transform={`translate(${track.view - 66} 84)`}>
            <text x={0} y={-15} textAnchor="middle" fill="#ffffff" fontSize={21} opacity={0.7}
              style={{ fontFamily: "var(--font-display)" }}>N</text>
            <path d="M0 -9 L6 9 L0 4.5 L-6 9 Z" fill="#ffffff" opacity={0.7} />
          </g>
        </svg>
      </div>

      <div className="hero-inner">
        <h1 className="hero-title">
          {track.circuit}
          <em>
            {short} · {story.laps} laps · {date}
          </em>
        </h1>

        <div className="hero-stats">
          <div>
            <b>{story.laps}</b>
            <span>Laps</span>
          </div>
          <div>
            <b>{moments}</b>
            <span>Moments</span>
          </div>
          <div>
            <b>{calls}</b>
            <span>Calls to make</span>
          </div>
        </div>

        <a className="hero-cta" href="#race">
          Enter the race
        </a>
      </div>

      <div className="hero-foot">Scroll to race</div>
    </section>
  );
}
