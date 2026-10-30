import Link from "next/link";
import { notFound } from "next/navigation";
import { listGPs, loadGhost, loadReplay, loadTrack, loadWeekend } from "@/lib/data";
import TheGhost from "@/components/TheGhost";
import type { Metadata } from "next";
import { gpMeta } from "@/lib/meta";

export async function generateMetadata({ params }: PageProps<"/gp/[slug]/[session]/ghost">): Promise<Metadata> {
  const { slug, session } = await params;
  return gpMeta(slug, "ghost", session);
}

export function generateStaticParams() {
  return listGPs().filter((slug) => loadGhost(slug) && loadReplay(slug, "race")).map((slug) => ({ slug, session: "race" }));
}

/** Activity 02: run a driver's strategy your way, and race your ghost. */
export default async function GhostPage({ params }: PageProps<"/gp/[slug]/[session]/ghost">) {
  const { slug, session } = await params;
  if (session !== "race") notFound();
  const race = loadGhost(slug);
  const r = loadReplay(slug, "race");
  if (!race || !race.seats.some((s) => (s.windows ?? []).length > 0) || !r) notFound();
  const weekend = loadWeekend(slug);
  // only what the live ghost uses goes to the browser: the playable seats,
  // their windows and stints, the finishing ladder and the stop cost. The old
  // per-call options (most of the file) stay on the server.
  const lean = {
    ...race,
    economics: { pitLoss: race.economics.pitLoss, tyres: {} },
    seats: race.seats.filter((x) => (x.windows ?? []).length > 0).map((x) => ({ ...x, calls: [] })),
  };
  const replay = { ...r, calls: [] };
  return (
    <>
      <div className="hub-top">
        <Link href={`/gp/${slug}/activities`} className="hub-back">← {weekend.circuit} · all activities</Link>
        <Link href="/" className="hub-home">Racing Simplified</Link>
      </div>
      <TheGhost r={replay} race={lean} track={loadTrack(slug)} gp={weekend.short.replace(/ Grand Prix$/, " GP")} slug={slug}
        callHref={r.calls.length >= 3 ? `/gp/${slug}/race/call` : null} storyHref={`/gp/${slug}/race`} />
    </>
  );
}
