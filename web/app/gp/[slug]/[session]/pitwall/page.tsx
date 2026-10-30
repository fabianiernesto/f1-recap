import Link from "next/link";
import { notFound } from "next/navigation";
import MotionFX from "@/components/MotionFX";
import { hasSession, listGPs, loadPitWall, loadWeekend } from "@/lib/data";
import PitWall from "@/components/PitWall";
import type { Metadata } from "next";
import { gpMeta } from "@/lib/meta";

export async function generateMetadata({ params }: PageProps<"/gp/[slug]/[session]/pitwall">): Promise<Metadata> {
  const { slug, session } = await params;
  return gpMeta(slug, "pitwall", session);
}

export function generateStaticParams() {
  return listGPs().flatMap((slug) =>
    loadWeekend(slug).sessions.map((s) => ({ slug, session: s.slug }))
  );
}

/** The fourth way through a session: you make the calls it was decided by. */
export default async function PitWallPage({
  params,
}: PageProps<"/gp/[slug]/[session]/pitwall">) {
  const { slug, session } = await params;
  if (!hasSession(slug, session)) notFound();
  const wall = loadPitWall(slug, session);
  // the pipeline only writes one where the tyre model held up against what
  // the strategist actually did, so a missing file is the honest answer
  if (!wall || wall.calls.length < 2) notFound();
  const weekend = loadWeekend(slug);

  return (
    <>
      <div className="hub-top">
        <Link href={`/gp/${slug}/activities`} className="hub-back">
          ← {weekend.circuit} · all activities
        </Link>
        <Link href="/" className="hub-home">Racing Simplified</Link>
      </div>
      <MotionFX />
      <PitWall wall={wall} backTo={`/gp/${slug}/activities`} />
    </>
  );
}
