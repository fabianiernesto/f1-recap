import Link from "next/link";
import type { Weekend } from "@/lib/types";

/**
 * The weekend hub: the five sessions, nothing else. No spoiler gate and no
 * depth selector: everyone gets the same full analysis, so the only decision
 * left here is which session to read.
 */
export default function WeekendHub({ weekend }: { weekend: Weekend }) {
  const total = weekend.sessions.reduce((n, s) => n + s.moments, 0);

  return (
    <section className="hub">
      <header className="hub-head">
        <span className="hub-eyebrow">The weekend, session by session</span>
        <h2>{weekend.short}</h2>
        <p>
          {weekend.circuit} · {weekend.country} · {weekend.date} ·{" "}
          {weekend.sessions.length} sessions, {total} moments, all of it built
          from the timing data.
        </p>
      </header>

      <div className="hub-sessions">
        {weekend.sessions.map((s, i) => (
          <Link
            key={s.slug}
            href={`/gp/${weekend.slug}/${s.slug}`}
            className="hub-session"
          >
            <span className="hub-session-n">{String(i + 1).padStart(2, "0")}</span>
            <span className="hub-session-main">
              <span className="hub-session-label">{s.label}</span>
              <span className="hub-session-head">{s.headline}</span>
            </span>
            <span className="hub-session-meta">
              {s.moments} moments{s.laps ? ` · ${s.laps} laps` : ""}
            </span>
            <span className="hub-session-go">→</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
