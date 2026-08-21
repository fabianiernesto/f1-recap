import Link from "next/link";
import { notFound } from "next/navigation";
import {
  hasSession,
  listGPs,
  loadMate,
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
  return (
    <>
      <div className="hub-top">
        <Link href={`/gp/${slug}/weekend`} className="hub-back">
          ← {story.circuit} · all sessions
        </Link>
        <Link href="/" className="hub-home">Race // Recap</Link>
      </div>
      <RaceScroll story={story} track={track} mate={mate} />
      {session === "race" && <FinalPoster story={story} track={track} />}
    </>
  );
}
