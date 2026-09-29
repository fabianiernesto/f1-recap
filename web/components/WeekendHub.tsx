import Link from "next/link";
import type { Weekend } from "@/lib/types";
import { Blur, MOOD, Speedlines, Streak } from "@/components/Mood";

/**
 * The weekend hub: the five sessions, nothing else. No spoiler gate and no
 * depth selector: everyone gets the same full analysis, so the only decision
 * left here is which session to read.
 *
 * Laid out off the grid (29-sep-2026): the sessions step down the page like
 * the weekend itself builds, each one arriving from the side, and the race,
 * where it all ends, sits on the red band.
 */
export default function WeekendHub({ weekend }: { weekend: Weekend }) {
  const total = weekend.sessions.reduce((n, s) => n + s.moments, 0);
  const name = weekend.short.replace(/ Grand Prix$/, "");

  return (
    <section className="hub fx-page">
      <div className="hub-car" data-par="0.22" aria-hidden>
        <Blur src={MOOD.car} className="mood-car" />
      </div>
      <Speedlines n={5} />
      <header className="hub-head" data-fx="left">
        <span className="hub-eyebrow">The weekend, session by session</span>
        <h2 style={{ ["--len" as string]: Math.max(name.length, weekend.circuit.length) }}>
          <span>{name}</span>
          <span className="glow">{weekend.circuit}</span>
        </h2>
        <p>
          {weekend.date} · {weekend.sessions.length} sessions, {total} moments,
          all of it built from the timing data.
        </p>
      </header>

      <Streak />

      <div className="hub-sessions">
        {weekend.sessions.map((s, i) => (
          <Link
            key={s.slug}
            href={`/gp/${weekend.slug}/${s.slug}`}
            className={`hub-session${s.kind === "race" && s.slug === "race" ? " hub-session-race" : ""}`}
            style={{ ["--step" as string]: i }}
            data-fx={i % 2 ? "right" : "left"}
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
