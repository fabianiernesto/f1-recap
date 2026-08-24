import Link from "next/link";
import { notFound } from "next/navigation";
import { listGPs, loadWeekend } from "@/lib/data";
import WeekendHub from "@/components/WeekendHub";

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
      <div className="hub-top">
        <Link href={`/gp/${slug}/weekend`} className="hub-back">
          ← {weekend.circuit} · all activities
        </Link>
        <Link href="/" className="hub-home">Racing Simplified</Link>
      </div>
      <WeekendHub weekend={weekend} />
    </>
  );
}
