import Link from "next/link";
import { notFound } from "next/navigation";
import { listGPs, loadBlind, loadWeekend } from "@/lib/data";

export function generateStaticParams() {
  return listGPs().map((slug) => ({ slug }));
}

/**
 * What you can do with this Grand Prix.
 *
 * Picking a circuit used to drop you straight into a list of sessions, which
 * assumed everybody wanted the same thing from it. The weekend is the material;
 * these are the ways through it, and the empty slot is there because the list
 * is meant to grow.
 */
export default async function WeekendPage({
  params,
}: PageProps<"/gp/[slug]/weekend">) {
  const { slug } = await params;
  if (!listGPs().includes(slug)) notFound();
  const weekend = loadWeekend(slug);
  const moments = weekend.sessions.reduce((n, s) => n + s.moments, 0);
  const blind = loadBlind(slug, "race") ?? loadBlind(slug, "sprint");
  const blindSession = loadBlind(slug, "race") ? "race" : "sprint";
  const ready = weekend.sessions.length > 0;

  return (
    <>
      <div className="hub-top">
        <Link href={`/gp/${slug}`} className="hub-back">
          ← {weekend.circuit}
        </Link>
        <Link href="/" className="hub-home">Racing Simplified</Link>
      </div>

      <main className="acts">
        <header className="acts-head">
          <span className="acts-eyebrow">{weekend.short} · {weekend.date}</span>
          <h1>
            <span>Pick your</span>
            <span>Way in</span>
          </h1>
          <p>
            {ready
              ? `${weekend.sessions.length} sessions and ${moments} moments of it, `
                + "and more than one way to get through them."
              : "This one has not been built yet. The circuit is measured and the "
                + "front door is up; the sessions come once the timing data is in."}
          </p>
        </header>

        <div className="acts-grid">
          {ready ? (
          <Link href={`/gp/${slug}/sessions`} className="act">
            <span className="act-n">Activity 01</span>
            <h2>Scroll the weekend</h2>
            <p>
              Every session told moment by moment, with the circuit drawing
              itself under you as you go and Alfred in the corner to answer
              whatever you want to ask about it.
            </p>
            <span className="act-meta">
              {weekend.sessions.length} sessions · {moments} moments · with Alfred
            </span>
            <span className="act-go">Start →</span>
          </Link>
          ) : (
            <div className="act act-off">
              <span className="act-n">Activity 01</span>
              <h2>Scroll the weekend</h2>
              <p>Waiting on the timing data for this Grand Prix.</p>
            </div>
          )}

          {blind && blind.rounds.length >= 3 ? (
            <Link href={`/gp/${slug}/${blindSession}/blind`} className="act">
              <span className="act-n">Activity 02</span>
              <h2>The blind test</h2>
              <p>
                Five drivers with their names taken off, and nothing to go on
                but where they started, how often they stopped and what the
                stewards made of them. Work out who you are looking at.
              </p>
              <span className="act-meta">
                5 rounds · about 2 minutes
              </span>
              <span className="act-go">Play →</span>
            </Link>
          ) : (
            <div className="act act-off">
              <span className="act-n">Activity 02</span>
              <h2>The blind test</h2>
              <p>
                Needs a race with enough happening in it. Nothing to guess at
                here yet.
              </p>
            </div>
          )}

          <div className="act act-next">
            <span className="act-n">Activity 03</span>
            <h2>More on the way</h2>
            <p>
              The pit wall run, where you call the strategy and find out where
              it would have put you. The what-if, where you take the safety car
              out of the race and watch the podium change.
            </p>
            <span className="act-meta">In the works</span>
          </div>
        </div>
      </main>
    </>
  );
}
