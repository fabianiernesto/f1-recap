import Link from "next/link";
import { notFound } from "next/navigation";
import { activitiesFor, listGPs, loadWeekend } from "@/lib/data";
import MotionFX from "@/components/MotionFX";
import { Beam, Blur, MOOD, Speedlines } from "@/components/Mood";

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
  const live = (acts.blind ? 1 : 0) + (acts.pitwall ? 1 : 0);

  return (
    <>
      <div className="hub-top">
        <Link href={`/gp/${slug}`} className="hub-back">
          ← {weekend.circuit}
        </Link>
        <Link href="/" className="hub-home">Racing Simplified</Link>
      </div>

      <main className="acts fx-page">
        <MotionFX />
        <Speedlines n={5} />
        <Beam className="acts-beam" />
        <header className="acts-head" data-fx="left">
          <span className="acts-eyebrow">
            {weekend.short} · {weekend.date}
          </span>
          <h1>
            <span>{weekend.circuit}</span>
            <span className="glow">Simplified</span>
          </h1>
          <p>
            {live
              ? `${live} way${live > 1 ? "s" : ""} to play with this Grand Prix, `
                + "and the rest of them on the way. Every one is built from the "
                + "same timing data as the weekend itself."
              : "Nothing to play with here yet. The activities arrive with the "
                + "timing data."}
          </p>
        </header>

        <div className="acts-grid">
          {acts.blind ? (
            <Link
              href={`/gp/${slug}/${acts.blind.session}/blind`}
              className="act act-photo"
              data-fx="left"
            >
              <Blur src={MOOD.helmet} className="act-bg" />
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
            <div className="act act-off act-photo" data-fx="left">
              <Blur src={MOOD.helmet} className="act-bg" />
              <span className="act-n">Activity 01</span>
              <h2>The blind test</h2>
              <p>
                Needs a race with enough happening in it. Nothing to guess at
                here yet.
              </p>
            </div>
          )}

          {acts.pitwall ? (
            <Link
              href={`/gp/${slug}/${acts.pitwall.session}/pitwall`}
              className="act act-photo"
              data-fx="right"
            >
              <Blur src={MOOD.tyre} className="act-bg" />
              <span className="act-n">Activity 02</span>
              <h2>The pit wall</h2>
              <p>
                You take {acts.pitwall.driver}&rsquo;s seat at{" "}
                {acts.pitwall.team} and make the calls his garage made, with the
                race frozen where they made them. At the flag it tells you where
                your afternoon would have ended.
              </p>
              <span className="act-meta">
                {acts.pitwall.calls} calls · {acts.pitwall.margin}s decided his
                race · about 3 minutes
              </span>
              <span className="act-go">Play →</span>
            </Link>
          ) : (
            <div className="act act-off act-photo" data-fx="right">
              <Blur src={MOOD.tyre} className="act-bg" />
              <span className="act-n">Activity 02</span>
              <h2>The pit wall</h2>
              <p>
                Needs a race whose tyre wear can be measured against what the
                strategists actually did. This one&rsquo;s cannot, so there is
                nothing honest to ask you here.
              </p>
              <span className="act-meta">Not this weekend</span>
            </div>
          )}

          <div className="act act-next act-photo" data-fx="left">
            <Blur src={MOOD.horse} className="act-bg" />
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
