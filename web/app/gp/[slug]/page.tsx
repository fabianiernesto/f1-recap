import { notFound } from "next/navigation";
import { listGPs, loadStory, loadTrack } from "@/lib/data";
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
      <GPHero story={story} track={track} date="05 JUL 2026" />
      <RaceScroll story={story} track={track} />
    </>
  );
}
