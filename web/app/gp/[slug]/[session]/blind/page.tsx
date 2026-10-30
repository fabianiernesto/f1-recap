import Link from "next/link";
import { notFound } from "next/navigation";
import MotionFX from "@/components/MotionFX";
import { hasSession, listGPs, loadBlind, loadMystery, loadWeekend } from "@/lib/data";
import BlindTest from "@/components/BlindTest";
import MysteryDriver from "@/components/MysteryDriver";
import type { Metadata } from "next";
import { gpMeta } from "@/lib/meta";

export async function generateMetadata({ params }: PageProps<"/gp/[slug]/[session]/blind">): Promise<Metadata> {
  const { slug, session } = await params;
  return gpMeta(slug, "blind", session);
}

export function generateStaticParams() {
  return listGPs().flatMap((slug) =>
    loadWeekend(slug).sessions.map((s) => ({ slug, session: s.slug }))
  );
}

/** The third way through a session: not told, not asked, played. */
export default async function BlindPage({
  params,
}: PageProps<"/gp/[slug]/[session]/blind">) {
  const { slug, session } = await params;
  if (!hasSession(slug, session)) notFound();
  const test = loadBlind(slug, session);
  const mystery = loadMystery(slug, session);
  if (!mystery && (!test || test.rounds.length < 3)) notFound();
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
      {mystery ? (
        <MysteryDriver
          mystery={mystery}
          test={test}
          gp={weekend.short.replace(/ Grand Prix$/, " GP")}
          storyHref={`/gp/${slug}/${session}`}
          storageKey={`rs-mystery-${slug}-${session}`}
        />
      ) : (
        <BlindTest test={test!} backTo={`/gp/${slug}/activities`} />
      )}
    </>
  );
}
