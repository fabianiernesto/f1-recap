import type { Story, Track } from "@/lib/types";

/**
 * GP hero — option B (red world) with option C's LED pit-board type,
 * the combination Ernesto picked from /options.
 * Immersive red gradient world, chequered red-on-red texture, a giant blurred
 * letterform deep in the background, dot-matrix headline, the real circuit in
 * white line-art, solid stat blocks and a pill CTA into the race.
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

  // corner labels pushed outwards from the centroid
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  const corners = track.corners.slice(0, 6).map((c) => {
    const dx = c.x - cx, dy = c.y - cy, m = Math.hypot(dx, dy) || 1;
    return { ...c, lx: c.x + (dx / m) * 50, ly: c.y + (dy / m) * 50 };
  });

  const moments = story.cards.filter((c) => c.type === "moment").length;
  const calls = story.cards.filter((c) => c.type === "prediction").length;
  const short = story.gp.replace(/ \d{4}$/, "");
  const ghost = track.circuit.slice(0, 2).toUpperCase();

  return (
    <section className="hero">
      <div className="hero-bg" aria-hidden />
      <div className="hero-ghost" aria-hidden>{ghost}</div>

      <div className="hero-meta">
        <span>RACE // RECAP</span>
        <span>{date}</span>
        <span>#{short.replace(/\s/g, "")}</span>
      </div>

      <div className="hero-inner">
        <h1 className="hero-title">
          {track.circuit}
          <em>
            {story.laps} laps. <i>one story.</i>
          </em>
        </h1>

        <div className="hero-map">
          <svg viewBox={`0 0 ${track.view} ${track.view}`} aria-hidden>
            <path
              d={d}
              fill="none"
              stroke="#ffffff"
              strokeWidth={9}
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity={0.92}
            />
            {corners.map((c) => (
              <g key={c.label}>
                <circle cx={c.x} cy={c.y} r={9} fill="#1a0507" stroke="#fff" strokeWidth={3} />
                <text
                  x={c.lx}
                  y={c.ly}
                  textAnchor="middle"
                  fill="#ffc9c9"
                  fontSize={19}
                  letterSpacing={1.5}
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {c.label}
                </text>
              </g>
            ))}
          </svg>
        </div>

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

      <div className="hero-led">Scroll to race</div>
    </section>
  );
}
