import Link from "next/link";
import type { Weekend } from "@/lib/types";
import { Speedlines } from "@/components/Mood";

/**
 * The end of a session is not the end of the weekend. Every story used to
 * stop dead on its last card (only the race had the poster after it); this
 * hands the reader straight to what comes next: the next session, or after
 * the race, the activities.
 */
export default function SessionNext({ weekend, current }: { weekend: Weekend; current: string }) {
  const i = weekend.sessions.findIndex((s) => s.slug === current);
  const next = i >= 0 ? weekend.sessions[i + 1] : undefined;
  const here = weekend.sessions[i];

  return (
    <section className="snext">
      <Speedlines n={4} />
      <div className="snext-band" data-fx="left">
        <span className="snext-k">
          {here ? `${here.label} done` : "Session done"} · {weekend.circuit}
        </span>
        {next ? (
          <Link href={`/gp/${weekend.slug}/${next.slug}`} className="snext-main">
            <span className="snext-up">Up next</span>
            <span className="snext-name">{next.label}</span>
            <span className="snext-head">{next.headline}</span>
            <i aria-hidden>→</i>
          </Link>
        ) : (
          <Link href={`/gp/${weekend.slug}/activities`} className="snext-main">
            <span className="snext-up">The weekend is told</span>
            <span className="snext-name">Now play it</span>
            <span className="snext-head">The activities, built from the same race</span>
            <i aria-hidden>→</i>
          </Link>
        )}
      </div>
      <div className="snext-row">
        <Link href={`/gp/${weekend.slug}/sessions`}>All sessions</Link>
        <Link href={`/gp/${weekend.slug}`} prefetch={false}>{weekend.circuit}</Link>
        <Link href="/" prefetch={false}>Racing Simplified</Link>
      </div>
    </section>
  );
}
