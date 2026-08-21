import type { Story, Track } from "@/lib/types";

/**
 * The light finale — signature element #3 (moodboard R1, Ferrari result page):
 * the recap ends by flipping the world to paper-white, with the result as a
 * monumental poster. Dark scroll -> light poster is the biggest stimulus of
 * the whole page.
 */
export default function FinalPoster({
  story,
  track,
}: {
  story: Story;
  track: Track;
}) {
  const r = story.result;
  if (!r) return null;
  const winner = r.podium[0];
  const d = "M " + track.points.map((p) => p[0] + " " + p[1]).join(" L ");

  return (
    <section className="poster">
      <div className="poster-grid">
        <div className="poster-left">
          <div className="poster-eyebrow">
            <i /> RACE RESULT
          </div>
          <div className="poster-p1">P1</div>
          <h2 className="poster-name">
            {winner.first}
            <br />
            {winner.last}
          </h2>
          <div className="poster-team">{winner.team}</div>
          <div className="poster-chip">#{winner.number}</div>
        </div>

        <div className="poster-right">
          <svg className="poster-track" viewBox={`0 0 ${track.view} ${track.view}`} aria-hidden>
            <path d={d} fill="none" stroke="#1B1C22" strokeWidth={7} strokeLinejoin="round" />
          </svg>

          {winner.headshot && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              className="poster-photo"
              src={winner.headshot}
              alt={`${winner.first} ${winner.last}`}
            />
          )}

          <div className="poster-spec">
            <div><span>RACE</span><b>{story.gp.replace(/ \d{4}$/, "")}</b></div>
            <div><span>CIRCUIT</span><b>{story.circuit}</b></div>
            <div><span>DATE</span><b>{r.date}</b></div>
            <div><span>LAPS</span><b>{story.laps}</b></div>
            {r.fastest && (
              <div>
                <span>FASTEST LAP</span>
                <b>{r.fastest.last} · {Math.floor(r.fastest.time / 60)}:{(r.fastest.time % 60).toFixed(3).padStart(6, "0")}</b>
              </div>
            )}
          </div>

          <div className="poster-podium">
            {r.podium.map((p) => (
              <div key={p.number}>
                <em style={{ background: `#${p.colour || "1B1C22"}` }} />
                <span>P{p.pos}</span>
                <b>{p.last}</b>
                <small>{p.team}</small>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="poster-ticker">
        <span>{winner.first} {winner.last} · #{winner.number}</span>
        <span>{winner.team}</span>
        <span>{story.gp} · RACING SIMPLIFIED</span>
      </div>
    </section>
  );
}
