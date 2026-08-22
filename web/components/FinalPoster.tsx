import type { Story, Track } from "@/lib/types";

/**
 * The headshot URL the feed hands over ends in /1col/, which is F1's 93 pixel
 * thumbnail. Blown up to poster height that is the whole reason this section
 * looked cheap. The same path serves /9col/ at 997 pixels.
 */
function bigPhoto(url: string): string {
  return url.replace("/1col/", "/9col/");
}

/**
 * The light finale — signature element #3 (moodboard R1, Ferrari result page):
 * the recap ends by flipping the world to paper white, with the result as a
 * monumental poster. Dark scroll to light poster is the biggest stimulus of
 * the whole page, so it has to earn the flip.
 *
 * The winner's name is the largest thing on the site and the photograph runs
 * under it, because type over image is the one move the whole moodboard keeps
 * making. Nothing here sits in a rounded card: a poster is rules and edges.
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
  const fastest = r.fastest
    ? `${r.fastest.last} · ${Math.floor(r.fastest.time / 60)}:${(r.fastest.time % 60)
        .toFixed(3)
        .padStart(6, "0")}`
    : null;

  return (
    <section className="poster">
      {/* the circuit is the paper this is printed on */}
      <svg
        className="poster-ghost"
        viewBox={`0 0 ${track.view} ${track.view}`}
        aria-hidden
      >
        <path d={d} fill="none" stroke="#1b1c22" strokeWidth={9} strokeLinejoin="round" />
      </svg>

      <div className="poster-head">
        <span className="poster-eyebrow">
          <i /> Race result · {story.gp.replace(/ \d{4}$/, "")}
        </span>
        <span className="poster-round">{r.date}</span>
      </div>

      <div className="poster-stage">
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
        <div className="poster-pos" aria-hidden>P1</div>
        <h2 className="poster-name">
          <span>{winner.first}</span>
          <span>{winner.last}</span>
        </h2>
        <div className="poster-sub">
          <b>{winner.team}</b>
          <span>#{winner.number}</span>
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
        {fastest && (
          <div>
            <dt>Fastest lap</dt>
            <dd>{fastest}</dd>
          </div>
        )}
        <div>
          <dt>Margin</dt>
          <dd>{r.podium[1] ? `${r.podium[1].last} behind` : "lights to flag"}</dd>
        </div>
      </dl>

      <ol className="poster-podium">
        {r.podium.map((p) => (
          <li key={p.number}>
            <span className="poster-pp">P{p.pos}</span>
            <b>{p.last}</b>
            <small>{p.team}</small>
            <i style={{ background: `#${p.colour || "1b1c22"}` }} />
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
