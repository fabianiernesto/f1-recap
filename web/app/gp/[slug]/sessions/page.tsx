import Link from "next/link";
import { notFound } from "next/navigation";
import MotionFX from "@/components/MotionFX";
import { listGPs, loadWeekend } from "@/lib/data";
import WeekendHub from "@/components/WeekendHub";
import type { Metadata } from "next";
import { gpMeta } from "@/lib/meta";

export async function generateMetadata({ params }: PageProps<"/gp/[slug]/sessions">): Promise<Metadata> {
  const { slug } = await params;
  return gpMeta(slug, "sessions");
}

export function generateStaticParams() {
  return listGPs().map((slug) => ({ slug }));
}

/** Inside the scroll activity: which session of the weekend to walk through. */
export default async function SessionsPage({
  params,
}: PageProps<"/gp/[slug]/sessions">) {
  const { slug } = await params;
  if (!listGPs().includes(slug)) notFound();
  const weekend = loadWeekend(slug);
  return (
    <>
      {/* the page's title for readers and search; on screen the board says it */}
      <h1 className="sr-only">{weekend.gp}: the sessions</h1>
      <div className="hub-top">
        <Link href={`/gp/${slug}`} prefetch={false} className="hub-back">
          ← {weekend.circuit} · all activities
        </Link>
        <Link href="/" prefetch={false} className="hub-home">Racing Simplified</Link>
      </div>
      <MotionFX />
      <WeekendHub weekend={weekend} />
    </>
  );
}
