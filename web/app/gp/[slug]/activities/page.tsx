import Link from "next/link";
import { notFound } from "next/navigation";
import { activitiesFor, listGPs, loadWeekend } from "@/lib/data";

export function generateStaticParams() {
  return listGPs().map((slug) => ({ slug }));
}

/**
 * Everything you can play with at this circuit.
 *
 * Only activities live here. Scrolling the weekend is not one of them: it is
 * the other channel on the front door, and listing it again here was the thing
 * that made choosing feel like it happened twice.
 */
export default async function ActivitiesPage({
  params,
}: PageProps<"/gp/[slug]/activities">) {
  const { slug } = await params;
  if (!listGPs().includes(slug)) notFound();
  const weekend = loadWeekend(slug);
  const acts = activitiesFor(slug, weekend);
  const live = acts.blind ? 1 : 0;

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
          <span className="acts-eyebrow">
            {weekend.short} · {weekend.date}
          </span>
          <h1>
            <span>{weekend.circuit}</span>
            <span>Simplified</span>
          </h1>
          <p>
            {live
              ? `${live} way to play with this Grand Prix, and the rest of them `
                + "on the way. Every one is built from the same timing data as "
                + "the weekend itself."
              : "Nothing to play with here yet. The activities arrive with the "
                + "timing data."}
          </p>
        </header>

        <div className="acts-grid">
          {acts.blind ? (
            <Link
              href={`/gp/${slug}/${acts.blind.session}/blind`}
              className="act"
            >
              <span className="act-n">Activity 01</span>
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
              <span className="act-n">Activity 01</span>
              <h2>The blind test</h2>
              <p>
                Needs a race with enough happening in it. Nothing to guess at
                here yet.
              </p>
            </div>
          )}

          <div className="act act-next">
            <span className="act-n">Activity 02</span>
            <h2>The pit wall</h2>
            <p>
              You take the calls this weekend actually faced: when to stop, what
              to do when the safety car lands, whether to cover the car behind.
              At the flag it tells you where your afternoon would have ended.
            </p>
            <span className="act-meta">In the works</span>
          </div>

          <div className="act act-next">
            <span className="act-n">Activity 03</span>
            <h2>The what-if</h2>
            <p>
              Take the safety car out of the race. Give the retirement its car
              back. Then watch the podium rearrange itself on the real pace
              everybody was running.
            </p>
            <span className="act-meta">In the works</span>
          </div>
        </div>
      </main>
    </>
  );
}
