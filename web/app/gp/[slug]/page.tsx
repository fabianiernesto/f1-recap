import { notFound } from "next/navigation";
import { listGPs, loadTrack, loadWeekend } from "@/lib/data";
import GPHeroLED from "@/components/GPHeroLED";
import WeekendHub from "@/components/WeekendHub";

export function generateStaticParams() {
  return listGPs().map((slug) => ({ slug }));
}

export default async function GPPage({ params }: PageProps<"/gp/[slug]">) {
  const { slug } = await params;
  if (!listGPs().includes(slug)) notFound();
  const weekend = loadWeekend(slug);
  const track = loadTrack(slug);
  return (
    <>
      <GPHeroLED weekend={weekend} track={track} />
      <WeekendHub weekend={weekend} />
    </>
  );
}
