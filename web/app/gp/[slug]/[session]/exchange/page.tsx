import Link from "next/link";
import { notFound } from "next/navigation";
import { hasSession, listGPs, loadReplay, loadTrack, loadWeekend } from "@/lib/data";
import PaddockExchange from "@/components/PaddockExchange";
import type { Metadata } from "next";
import { gpMeta } from "@/lib/meta";

export async function generateMetadata({ params }: PageProps<"/gp/[slug]/[session]/exchange">): Promise<Metadata> {
  const { slug, session } = await params;
  return gpMeta(slug, "exchange", session);
}

export function generateStaticParams() {
  return listGPs().flatMap((slug) =>
    loadWeekend(slug).sessions.filter((s) => s.kind === "race" && loadReplay(slug, s.slug)).map((s) => ({ slug, session: s.slug }))
  );
}

/** Activity 02: every driver a share, priced by his place, lap by lap. */
export default async function ExchangePage({ params }: PageProps<"/gp/[slug]/[session]/exchange">) {
  const { slug, session } = await params;
  if (!hasSession(slug, session)) notFound();
  const r = loadReplay(slug, session);
  if (!r || r.field.length < 2) notFound();
  const weekend = loadWeekend(slug);
  // the calls are Call the race's; the market needs only the cars and the clock
  const replay = { ...r, calls: [] };
  return (
    <>
      <div className="hub-top">
        <Link href={`/gp/${slug}/activities`} className="hub-back">← {weekend.circuit} · all activities</Link>
        <Link href="/" className="hub-home">Racing Simplified</Link>
      </div>
      <PaddockExchange r={replay} track={loadTrack(slug)} gp={weekend.short.replace(/ Grand Prix$/, " GP")}
        slug={slug} session={session}
        callHref={r.calls.length >= 3 ? `/gp/${slug}/${session}/call` : null} storyHref={`/gp/${slug}/${session}`} />
    </>
  );
}
