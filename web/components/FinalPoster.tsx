import type { Story, Track } from "@/lib/types";
import { bigPhoto } from "@/lib/photo";


function mmss(t: number): string {
  return `${Math.floor(t / 60)}:${(t % 60).toFixed(3).padStart(6, "0")}`;
}

/**
 * The light finale: signature element #3 (moodboard R1, Ferrari result page):
 * the recap ends by flipping the world to paper white.
 *
 * Everything sits on one centre line. An earlier pass hung the name off the
 * left margin with a cropped number behind it and a circuit wandering across
 * the right, and each of those was a different alignment fighting the others.
 * Symmetry is what a poster has instead of a layout: the mark, the photograph
 * and the name share an axis, and the bands underneath are the only things
 * allowed to run the full width.
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
  const second = r.podium[1];
  const d = "M " + track.points.map((p) => p[0] + " " + p[1]).join(" L ");

  return (
    <section className="poster">
      {/* the circuit is the watermark on the paper, centred like the rest */}
      <svg
        className="poster-ghost"
        viewBox={`0 0 ${track.view} ${track.view}`}
        aria-hidden
      >
        <path d={d} fill="none" stroke="#1b1c22" strokeWidth={8} strokeLinejoin="round" />
      </svg>

      <header className="poster-head">
        <span className="poster-eyebrow">
          <i /> Race result
        </span>
        <span>{story.gp.replace(/ \d{4}$/, "")}</span>
        <span>{r.date}</span>
      </header>

      <div className="poster-stage">
        <span className="poster-pos">P1</span>

        {winner.headshot && (
          /* multiply drops the flat studio grey straight into the paper, which
             is what stops this reading as a photo pasted into a box */
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            className="poster-photo"
            src={bigPhoto(winner.headshot)}
            alt={`${winner.first} ${winner.last}`}
          />
        )}

        <h2 className="poster-name">
          <span>{winner.first}</span>
          <span>{winner.last}</span>
        </h2>

        <div className="poster-sub">
          <b>{winner.team}</b>
          <em>#{winner.number}</em>
        </div>
      </div>

      <dl className="poster-spec">
        <div>
          <dt>Circuit</dt>
          <dd>{story.circuit}</dd>
        </div>
        <div>
          <dt>Laps</dt>
          <dd>{story.laps}</dd>
        </div>
        <div>
          <dt>Fastest lap</dt>
          <dd>{r.fastest ? `${r.fastest.last} · ${mmss(r.fastest.time)}` : "-"}</dd>
        </div>
        <div>
          <dt>Winning margin</dt>
          <dd>{second?.gap ? `${second.gap.toFixed(3)}s` : "-"}</dd>
        </div>
      </dl>

      <ol className="poster-podium">
        {r.podium.map((p) => (
          <li key={p.number}>
            <i style={{ background: `#${p.colour || "1b1c22"}` }} />
            <span className="poster-pp">P{p.pos}</span>
            <b>{p.last}</b>
            <small>{p.team}</small>
            <em>{p.gap ? `+${p.gap.toFixed(3)}s` : "winner"}</em>
          </li>
        ))}
      </ol>

      <div className="poster-ticker">
        <span>
          {winner.first} {winner.last} · #{winner.number}
        </span>
        <span>{winner.team}</span>
        <span>{story.gp} · Racing Simplified</span>
      </div>
    </section>
  );
}
