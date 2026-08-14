import Link from "next/link";
import { notFound } from "next/navigation";
import { listGPs, loadWeekend } from "@/lib/data";
import WeekendHub from "@/components/WeekendHub";

export function generateStaticParams() {
  return listGPs().map((slug) => ({ slug }));
}

export default async function WeekendPage({
  params,
}: PageProps<"/gp/[slug]/weekend">) {
  const { slug } = await params;
  if (!listGPs().includes(slug)) notFound();
  const weekend = loadWeekend(slug);
  return (
    <>
      <div className="hub-top">
        <Link href={`/gp/${slug}`} className="hub-back">
          ← {weekend.circuit}
        </Link>
      </div>
      <WeekendHub weekend={weekend} />
    </>
  );
}
