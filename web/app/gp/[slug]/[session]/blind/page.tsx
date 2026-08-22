import Link from "next/link";
import { notFound } from "next/navigation";
import { hasSession, listGPs, loadBlind, loadWeekend } from "@/lib/data";
import BlindTest from "@/components/BlindTest";

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
  if (!test || test.rounds.length < 3) notFound();
  const weekend = loadWeekend(slug);

  return (
    <>
      <div className="hub-top">
        <Link href={`/gp/${slug}/${session}`} className="hub-back">
          ← {weekend.circuit} · {test.session}
        </Link>
        <Link href="/" className="hub-home">Racing Simplified</Link>
      </div>
      <BlindTest test={test} backTo={`/gp/${slug}/${session}`} />
    </>
  );
}
