import Link from "next/link";
import { notFound } from "next/navigation";
import { hasSession, listGPs, loadReplay, loadTrack, loadWeekend } from "@/lib/data";
import CallTheRace from "@/components/CallTheRace";
import type { Metadata } from "next";
import { gpMeta } from "@/lib/meta";

export async function generateMetadata({ params }: PageProps<"/gp/[slug]/[session]/call">): Promise<Metadata> {
  const { slug, session } = await params;
  return gpMeta(slug, "call", session);
}

export function generateStaticParams() {
  return listGPs().flatMap((slug) =>
    loadWeekend(slug).sessions.filter((s) => loadReplay(slug, s.slug)).map((s) => ({ slug, session: s.slug }))
  );
}

/** Activity 01: the race replayed on the real track, and you call it. */
export default async function CallPage({ params }: PageProps<"/gp/[slug]/[session]/call">) {
  const { slug, session } = await params;
  if (!hasSession(slug, session)) notFound();
  const r = loadReplay(slug, session);
  if (!r || r.calls.length < 3) notFound();
  const weekend = loadWeekend(slug);

  return (
    <>
      <div className="hub-top">
        <Link href={`/gp/${slug}/activities`} className="hub-back">← {weekend.circuit} · all activities</Link>
        <Link href="/" className="hub-home">Racing Simplified</Link>
      </div>
      <CallTheRace r={r} track={loadTrack(slug)} gp={weekend.short.replace(/ Grand Prix$/, " GP")}
        slug={slug} session={session} exchangeHref={`/gp/${slug}/${session}/exchange`} storyHref={`/gp/${slug}/${session}`} />
    </>
  );
}
