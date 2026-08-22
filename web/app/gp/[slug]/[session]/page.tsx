import Link from "next/link";
import { notFound } from "next/navigation";
import {
  hasSession,
  listGPs,
  loadMate,
  loadBrain,
  loadBlind,
  loadStory,
  loadTrack,
  loadWeekend,
} from "@/lib/data";
import FinalPoster from "@/components/FinalPoster";
import RaceScroll from "@/components/RaceScroll";

export function generateStaticParams() {
  return listGPs().flatMap((slug) =>
    loadWeekend(slug).sessions.map((s) => ({ slug, session: s.slug }))
  );
}

/** One session, told in full. There is no depth switch any more: everybody
 *  gets every moment the data supports. */
export default async function SessionPage({
  params,
}: PageProps<"/gp/[slug]/[session]">) {
  const { slug, session } = await params;
  if (!hasSession(slug, session)) notFound();
  const story = loadStory(slug, session);
  const track = loadTrack(slug);
  const mate = loadMate(slug, session);
  const brain = loadBrain(slug, session);
  const blind = loadBlind(slug, session);
  return (
    <>
      <div className="hub-top">
        <Link href={`/gp/${slug}/weekend`} className="hub-back">
          ← {story.circuit} · all sessions
        </Link>
        <Link href="/" className="hub-home">Racing Simplified</Link>
      </div>
      <RaceScroll story={story} track={track} mate={mate} brain={brain} />

      {/* the third way through the session, once the story has been told */}
      {blind && blind.rounds.length >= 3 && (
        <section className="playit">
          <span className="playit-eyebrow">One more thing</span>
          <h2>Can you spot a driver from his numbers alone?</h2>
          <p>
            Five sheets from this session with the names taken off. Where he
            started, how often he stopped, what the stewards made of him.
          </p>
          <Link href={`/gp/${slug}/${session}/blind`} className="blind-go">
            Take the blind test <i aria-hidden>→</i>
          </Link>
        </section>
      )}

      {session === "race" && <FinalPoster story={story} track={track} />}
    </>
  );
}
