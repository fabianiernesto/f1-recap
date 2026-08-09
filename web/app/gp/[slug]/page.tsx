import { notFound } from "next/navigation";
import { listGPs, loadStory, loadTrack } from "@/lib/data";
import FinalPoster from "@/components/FinalPoster";
import GPHero from "@/components/GPHero";
import RaceScroll from "@/components/RaceScroll";

export function generateStaticParams() {
  return listGPs().map((slug) => ({ slug }));
}

export default async function GPPage({ params }: PageProps<"/gp/[slug]">) {
  const { slug } = await params;
  if (!listGPs().includes(slug)) notFound();
  const story = loadStory(slug);
  const track = loadTrack(slug);
  return (
    <>
      <GPHero story={story} track={track} date={story.result?.date ?? ""} />
      <RaceScroll story={story} track={track} />
      <FinalPoster story={story} track={track} />
    </>
  );
}
