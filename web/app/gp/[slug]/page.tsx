import { notFound } from "next/navigation";
import { listGPs, loadTrack, loadWeekend } from "@/lib/data";
import GPHeroLED from "@/components/GPHeroLED";

export function generateStaticParams() {
  return listGPs().map((slug) => ({ slug }));
}

/** The circuit's front door: one locked screen, no scroll. You go in by
 *  choosing to, from the button — the weekend lives at /gp/<slug>/weekend. */
export default async function GPPage({ params }: PageProps<"/gp/[slug]">) {
  const { slug } = await params;
  if (!listGPs().includes(slug)) notFound();
  return <GPHeroLED weekend={loadWeekend(slug)} track={loadTrack(slug)} />;
}
