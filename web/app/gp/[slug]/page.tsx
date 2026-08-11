import { notFound } from "next/navigation";
import { listGPs, loadStory, loadTrack, loadWeekend } from "@/lib/data";
import GPHero from "@/components/GPHero";
import WeekendHub from "@/components/WeekendHub";

export function generateStaticParams() {
  return listGPs().map((slug) => ({ slug }));
}

export default async function GPPage({ params }: PageProps<"/gp/[slug]">) {
  const { slug } = await params;
  if (!listGPs().includes(slug)) notFound();
  const weekend = loadWeekend(slug);
  const story = loadStory(slug, "race");
  const track = loadTrack(slug);
  return (
    <>
      <GPHero
        story={story}
        track={track}
        date={weekend.date}
        slug={slug}
        sessions={weekend.sessions.length}
      />
      <WeekendHub weekend={weekend} />
    </>
  );
}
