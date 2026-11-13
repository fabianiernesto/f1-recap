import Link from "next/link";
import { notFound } from "next/navigation";
import { activitiesFor, listGPs, loadReplay, loadTrack, loadWeekend } from "@/lib/data";
import { ExchangeArt, TrackArt } from "@/components/ActArt";
import MotionFX from "@/components/MotionFX";
import { Beam, Blur, MOOD, Speedlines } from "@/components/Mood";
import type { Metadata } from "next";
import { gpMeta } from "@/lib/meta";

export async function generateMetadata({ params }: PageProps<"/gp/[slug]/activities">): Promise<Metadata> {
  const { slug } = await params;
  return gpMeta(slug, "activities");
}

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
  const live = (acts.call ? 1 : 0) + (acts.exchange ? 1 : 0);
  // the cards wear the race itself, not stock photographs
  const replay = loadReplay(slug, "race");
  const track = loadTrack(slug);
  const artLap = replay ? Math.max(1, Math.round(replay.laps * 0.4)) : 1;

  return (
    <>
      <div className="hub-top">
        <Link href={`/gp/${slug}`} prefetch={false} className="hub-back">
          ← {weekend.circuit}
        </Link>
        <Link href="/" prefetch={false} className="hub-home">Racing Simplified</Link>
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
            {live === 2
              ? "Two ways to play this Grand Prix, both built from the same timing data as the weekend itself."
              : live === 1
                ? "One way to play this Grand Prix. The other needs more of the race than this one has."
              : "Nothing to play with here yet. The activities arrive with the "
                + "timing data."}
          </p>
        </header>

        <div className="acts-grid acts-two">
          {acts.call ? (
            <Link href={`/gp/${slug}/${acts.call.session}/call`} className="act act-photo" data-fx="left">
              <div className="act-bg act-art">{replay && <TrackArt r={replay} track={track} lap={artLap} />}</div>
              <span className="act-n">Activity 01</span>
              <h2>Call the race</h2>
              <p>
                The whole race plays back in three minutes on the real track. When it
                turns, it stops and asks what happens next. Say how sure you are,
                then watch the race answer you.
              </p>
              <span className="act-meta">
                {acts.call.calls} calls · {acts.call.laps} laps in 3 minutes · same calls for your friends
              </span>
              <span className="act-go">Lights out →</span>
            </Link>
          ) : (
            <div className="act act-off act-photo" data-fx="left">
              <div className="act-bg act-art">{replay && <TrackArt r={replay} track={track} lap={artLap} />}</div>
              <span className="act-n">Activity 01</span>
              <h2>Call the race</h2>
              <p>Needs a race with enough happening in it to ask about.</p>
            </div>
          )}

          {acts.exchange ? (
            <Link href={`/gp/${slug}/${acts.exchange.session}/exchange`} className="act act-photo" data-fx="right">
              <div className="act-bg act-art">{replay && <ExchangeArt r={replay} />}</div>
              <span className="act-n">Activity 02</span>
              <h2>Paddock exchange</h2>
              <p>
                Every driver is a share and his price is his place. The race plays
                back lap by lap as it really went: buy the cheap ones, sell when
                they climb, and lose it all if one retires.
              </p>
              <span className="act-meta">
                {acts.exchange.drivers} drivers · {acts.exchange.laps} laps in 2 minutes · start with 1,000
              </span>
              <span className="act-go">Open the market →</span>
            </Link>
          ) : (
            <div className="act act-off act-photo" data-fx="right">
              <div className="act-bg act-art act-art-off" />
              <span className="act-n">Activity 02</span>
              <h2>Paddock exchange</h2>
              <p>Needs the race replayed lap by lap, and this one is not yet.</p>
              <span className="act-meta">Not this race</span>
            </div>
          )}
        </div>
        {acts.call?.sprint && (
          <Link href={`/gp/${slug}/sprint/call`} className="acts-sprint" data-fx="left">
            <span>Sprint weekend</span>
            <b>Call the sprint too</b>
            <i aria-hidden>→</i>
          </Link>
        )}
        {acts.exchange?.sprint && (
          <Link href={`/gp/${slug}/sprint/exchange`} className="acts-sprint" data-fx="left">
            <span>Sprint weekend</span>
            <b>Trade the sprint too</b>
            <i aria-hidden>→</i>
          </Link>
        )}
      </main>
    </>
  );
}
