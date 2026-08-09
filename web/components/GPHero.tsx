import type { Story, Track } from "@/lib/types";

/**
 * GP hero — signature element #1 from MOODBOARD_ANALISIS.md:
 * monumental type filling the viewport, with the real circuit
 * (cartographic treatment) overlapping the letters, red slash,
 * ambient background, LED strip. No photos needed: type + map carry it.
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

  // start/finish tick
  const a0 = Math.atan2(pts[1][1] - pts[0][1], pts[1][0] - pts[0][0]);
  const nx = Math.cos(a0 + Math.PI / 2);
  const ny = Math.sin(a0 + Math.PI / 2);

  // corner labels pushed outwards from centroid
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  const corners = track.corners.map((c) => {
    const dx = c.x - cx, dy = c.y - cy, m = Math.hypot(dx, dy) || 1;
    return { ...c, lx: c.x + (dx / m) * 52, ly: c.y + (dy / m) * 52 };
  });

  const hashtag = "#" + (story.gp.split(" ")[0] || story.circuit) + "GP";

  return (
    <section className="hero">
      <div className="hero-bg" aria-hidden />
      <div className="hero-slash" aria-hidden />

      <div className="hero-meta">
        <span>RACE // RECAP</span>
        <span>{date}</span>
        <span>{hashtag}</span>
      </div>

      <h1 className="hero-title">{track.circuit}</h1>

      <div className="hero-map" aria-hidden>
        <svg viewBox={`0 0 ${track.view} ${track.view}`}>
          {/* cartographic dotted line (moodboard R4) */}
          <path
            d={d}
            fill="none"
            stroke="#5F6572"
            strokeWidth={3.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="0.5 14"
          />
          {/* start / finish */}
          <line
            x1={pts[0][0] + nx * 16} y1={pts[0][1] + ny * 16}
            x2={pts[0][0] - nx * 16} y2={pts[0][1] - ny * 16}
            stroke="#E10600" strokeWidth={5}
          />
          <text
            x={pts[0][0] + nx * 30} y={pts[0][1] + ny * 30}
            fill="#6A7080" fontSize={17} letterSpacing={2}
            style={{ fontFamily: "var(--font-mono)" }}
          >
            START // FINISH
          </text>
          {/* numbered-style corner dots + names */}
          {corners.map((c) => (
            <g key={c.label}>
              <circle cx={c.x} cy={c.y} r={7} fill="none" stroke="#5F6572" strokeWidth={1.5} />
              <circle cx={c.x} cy={c.y} r={2.4} fill="#9BA0AE" />
              <text
                x={c.lx} y={c.ly} textAnchor="middle"
                fill="#6A7080" fontSize={16} letterSpacing={2}
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {c.label}
              </text>
            </g>
          ))}
          {/* compass */}
          <g transform={`translate(${track.view - 60} 70)`}>
            <text x={0} y={-14} textAnchor="middle" fill="#5F6572" fontSize={20}
              style={{ fontFamily: "var(--font-mono)" }}>N</text>
            <path d="M0 -8 L5 8 L0 4 L-5 8 Z" fill="#5F6572" />
          </g>
        </svg>
      </div>

      <div className="hero-stats">
        <div>
          <b>{story.laps}</b>
          <span>LAPS</span>
        </div>
        <div>
          <b>{story.gp.replace(/ \d{4}$/, "")}</b>
          <span>{story.session} · {date.split(" ").pop()}</span>
        </div>
      </div>

      <div className="hero-led">SCROLL TO RACE</div>
    </section>
  );
}
