import Link from "next/link";
import { notFound } from "next/navigation";
import { activitiesFor, listGPs, loadTrack, loadWeekend } from "@/lib/data";
import GPHeroLED from "@/components/GPHeroLED";

export function generateStaticParams() {
  return listGPs().map((slug) => ({ slug }));
}

/**
 * The circuit's front door, and the only place you choose.
 *
 * It used to be a locked screen whose button led to a separate page that asked
 * the same question again, so choosing on the board bought you nothing. The
 * board now sets the destination and the ways in live underneath it at full
 * size, which is what the room below the fold is for.
 */
export default async function GPPage({ params }: PageProps<"/gp/[slug]">) {
  const { slug } = await params;
  if (!listGPs().includes(slug)) notFound();
  const weekend = loadWeekend(slug);
  const acts = activitiesFor(slug, weekend);

  return (
    <>
      <GPHeroLED weekend={weekend} track={loadTrack(slug)} />

      <section className="acts" id="ways-in">
        <header className="acts-head">
          <span className="acts-eyebrow">Ways in</span>
          <h1>
            <span>Pick your</span>
            <span>Way in</span>
          </h1>
          <p>
            {acts.scroll
              ? `${acts.sessions} sessions and ${acts.moments} moments of it, `
                + "and more than one way to get through them."
              : "This one has not been built yet. The circuit is measured and "
                + "the front door is up; the sessions come once the timing "
                + "data is in."}
          </p>
        </header>

        <div className="acts-grid">
          {acts.scroll ? (
            <Link href={`/gp/${slug}/sessions`} className="act">
              <span className="act-n">Activity 01</span>
              <h2>Scroll the weekend</h2>
              <p>
                Every session told moment by moment, with the circuit drawing
                itself under you as you go and Alfred in the corner to answer
                whatever you want to ask about it.
              </p>
              <span className="act-meta">
                {acts.sessions} sessions · {acts.moments} moments
                {acts.alfred > 0 && ` · Alfred on ${acts.alfred}`}
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

          {acts.blind ? (
            <Link
              href={`/gp/${slug}/${acts.blind.session}/blind`}
              className="act"
            >
              <span className="act-n">Activity 02</span>
              <h2>The blind test</h2>
              <p>
                Five drivers with their names taken off, and nothing to go on
                but where they started, how often they stopped and what the
                stewards made of them. Work out who you are looking at.
              </p>
              <span className="act-meta">
                {acts.blind.rounds} sheets · 5 drawn a run · about 2 minutes
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
      </section>
    </>
  );
}
