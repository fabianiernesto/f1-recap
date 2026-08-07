import { notFound } from "next/navigation";
import { listGPs, loadStory, loadTrack } from "@/lib/data";
import RaceScroll from "@/components/RaceScroll";

export function generateStaticParams() {
  return listGPs().map((slug) => ({ slug }));
}

export default async function GPPage({ params }: PageProps<"/gp/[slug]">) {
  const { slug } = await params;
  if (!listGPs().includes(slug)) notFound();
  return <RaceScroll story={loadStory(slug)} track={loadTrack(slug)} />;
}
