import Link from "next/link";
import { listGPs, loadWeekend } from "@/lib/data";

export default function Home() {
  const weekends = listGPs()
    .map((slug) => loadWeekend(slug))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const latest = weekends[0];

  return (
    <main className="home">
      <header className="home-head">
        <div className="home-brand">RACE // RECAP</div>
        <h1>
          The race,
          <br />
          told properly
        </h1>
        <p>
          Missed the Grand Prix? Fell asleep on lap 30? Every race weekend told
          like a story you scroll — the real track, the real moments, none of
          the homework.
        </p>
      </header>

      {latest && (
        <Link href={`/gp/${latest.slug}`} className="home-latest">
          <span className="home-eyebrow">Latest Grand Prix</span>
          <span className="home-latest-name">{latest.circuit}</span>
          <span className="home-latest-sub">
            {latest.short} · {latest.country} · {latest.date}
          </span>
          <span className="home-latest-meta">
            {latest.sessions.length} sessions
            {latest.rating && (
              <>
                {" "}
                · rated <b>{latest.rating.score.toFixed(1)}/10</b> — spoiler-free
              </>
            )}
          </span>
          <span className="home-latest-cta">Open the weekend →</span>
        </Link>
      )}

      {weekends.length > 1 && (
        <section className="home-list">
          <span className="home-eyebrow">Earlier weekends</span>
          {weekends.slice(1).map((w) => (
            <Link key={w.slug} href={`/gp/${w.slug}`} className="home-row">
              <span>{w.circuit}</span>
              <span>{w.date}</span>
            </Link>
          ))}
        </section>
      )}

      <section className="home-how">
        <div>
          <b>No spoilers first</b>
          <span>
            Every weekend opens by asking if you already know the result. If you
            don&apos;t, you only get a rating: worth watching, or not.
          </span>
        </div>
        <div>
          <b>Your time, your depth</b>
          <span>
            Thirty seconds, three minutes or the full story. Same race, told at
            the depth you actually have time for.
          </span>
        </div>
        <div>
          <b>Real data, human words</b>
          <span>
            Built from official timing data — every overtake, stop and safety
            car — then told the way a friend would tell it.
          </span>
        </div>
      </section>

      <footer className="home-foot">
        Built from OpenF1 + FastF1 timing data · not affiliated with Formula 1
      </footer>
    </main>
  );
}
