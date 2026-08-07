import Link from "next/link";
import { listGPs, loadStory } from "@/lib/data";

export default function Home() {
  const gps = listGPs().map((slug) => ({ slug, story: loadStory(slug) }));

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-10 px-6 py-24">
      <header>
        <div className="mb-3 h-1 w-14 bg-accent" />
        <h1
          className="text-6xl font-bold uppercase leading-[.95] text-ink"
          style={{ fontFamily: "var(--font-display)" }}
        >
          The race,
          <br />
          told properly
        </h1>
        <p className="mt-5 max-w-md text-[15px] text-muted">
          Missed the Grand Prix? Fell asleep on lap 30? Scroll the race like a
          story: the real track, the real moments, none of the homework.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        {gps.map(({ slug, story }) => (
          <Link
            key={slug}
            href={`/gp/${slug}`}
            className="group border border-line bg-carbon-1 p-5 transition-colors hover:border-muted"
          >
            <div
              className="text-[10px] uppercase tracking-[.16em] text-muted"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {story.circuit} · {story.laps} laps · Race
            </div>
            <div
              className="mt-1 text-3xl font-bold uppercase text-ink group-hover:text-accent"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {story.gp}
            </div>
          </Link>
        ))}
      </section>

      <footer
        className="text-[10px] uppercase tracking-[.14em] text-muted"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        Built from OpenF1 + FastF1 timing data · not affiliated with Formula 1
      </footer>
    </main>
  );
}
