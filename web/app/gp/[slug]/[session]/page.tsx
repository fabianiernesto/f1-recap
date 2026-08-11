import Link from "next/link";
import { notFound } from "next/navigation";
import { hasSession, listGPs, loadStory, loadTrack, loadWeekend } from "@/lib/data";
import FinalPoster from "@/components/FinalPoster";
import RaceScroll from "@/components/RaceScroll";

export function generateStaticParams() {
  return listGPs().flatMap((slug) =>
    loadWeekend(slug).sessions.map((s) => ({ slug, session: s.slug }))
  );
}

export default async function SessionPage({
  params,
  searchParams,
}: PageProps<"/gp/[slug]/[session]">) {
  const { slug, session } = await params;
  if (!hasSession(slug, session)) notFound();
  // depth is resolved server-side: the HTML arrives already filtered
  const { d } = await searchParams;
  const depth = typeof d === "string" ? d : "medium";
  const story = loadStory(slug, session);
  const track = loadTrack(slug);
  return (
    <>
      <Link href={`/gp/${slug}`} className="back-link">
        ← Weekend
      </Link>
      <RaceScroll story={story} track={track} depth={depth} />
      {session === "race" && <FinalPoster story={story} track={track} />}
    </>
  );
}
