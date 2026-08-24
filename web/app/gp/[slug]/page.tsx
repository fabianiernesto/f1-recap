import { notFound } from "next/navigation";
import { listGPs, loadTrack, loadWeekend } from "@/lib/data";
import GPHeroLED from "@/components/GPHeroLED";

export function generateStaticParams() {
  return listGPs().map((slug) => ({ slug }));
}

/**
 * The circuit's front door: one locked screen, no scroll.
 *
 * The board carries two channels, because there are two things this circuit
 * is. SCROLLED is the weekend itself, told session by session. SIMPLIFIED is
 * the brand, and everything you can play with lives behind it.
 */
export default async function GPPage({ params }: PageProps<"/gp/[slug]">) {
  const { slug } = await params;
  if (!listGPs().includes(slug)) notFound();
  return <GPHeroLED weekend={loadWeekend(slug)} track={loadTrack(slug)} />;
}
