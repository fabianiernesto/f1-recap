import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";
import { activitiesFor, listGPs, loadReplay, loadTrack, loadWeekend } from "@/lib/data";
import { ExchangeArt, TrackArt } from "@/components/ActArt";
import MotionFX from "@/components/MotionFX";
import { Beam, Speedlines } from "@/components/Mood";
import type { Metadata } from "next";
import { gpMeta } from "@/lib/meta";

export async function generateMetadata({ params }: PageProps<"/gp/[slug]/activities">): Promise<Metadata> {
  const { slug } = await params;
  return gpMeta(slug, "activities");
}

export function generateStaticParams() {
  return listGPs().map((slug) => ({ slug }));
}

/** One game on the shelf: everything its cover says, in the cover's own words. */
type Game = {
  n: string;
  top: string;
  lit: string;
  href: string;
  art: ReactNode;
  copy: string;
  stats: [string, string | number][];
  go: string;
  sprint: { href: string; label: string } | null;
};

/**
 * Columns for a shelf of n games (20/11/2026): every row full, none left alone.
 * Two sit side by side, three in a row, four as two pairs, then rows of three.
 */
const columns = (n: number) => (n <= 3 ? n : n === 4 ? 2 : 3);

/**
 * Everything you can play with at this circuit.
 *
 * Only activities live here. Scrolling the weekend is not one of them: it is
 * the other channel on the front door, and listing it again here was the thing
 * that made choosing feel like it happened twice.
 *
 * Since 20/11/2026 each game is a small copy of its own cover (the same title,
 * the same three figures, the same red button), drawn from this race, with its
 * sprint inside it. The shelf is built to take a third and a fourth game
 * without a new layout.
 */
export default async function ActivitiesPage({
  params,
}: PageProps<"/gp/[slug]/activities">) {
  const { slug } = await params;
  if (!listGPs().includes(slug)) notFound();
  const weekend = loadWeekend(slug);
  const acts = activitiesFor(slug, weekend);
  // the cards wear the race itself, not stock photographs
  const replay = loadReplay(slug, "race");
  const track = loadTrack(slug);
  const artLap = replay ? Math.max(1, Math.round(replay.laps * 0.4)) : 1;

  const games: Game[] = [];
  if (acts.call)
    games.push({
      n: "01",
      top: "Call",
      lit: "the race",
      href: `/gp/${slug}/${acts.call.session}/call`,
      art: replay && <TrackArt r={replay} track={track} lap={artLap} className="game-track" />,
      copy:
        "The whole race plays back in three minutes on the real track. When it turns, it stops and asks what happens next. Say how sure you are, then watch the race answer you.",
      stats: [["Laps", acts.call.laps], ["Calls", acts.call.calls], ["Time", "3′"]],
      go: "Lights out",
      sprint: acts.call.sprint ? { href: `/gp/${slug}/sprint/call`, label: "Call the sprint too" } : null,
    });
  if (acts.exchange)
    games.push({
      n: "02",
      top: "Paddock",
      lit: "exchange",
      href: `/gp/${slug}/${acts.exchange.session}/exchange`,
      art: replay && <ExchangeArt r={replay} field className="game-chart" />,
      copy:
        "Every driver is a share and his price is his place. The race plays back lap by lap as it really went: buy the cheap ones, sell when they climb, and lose it all if one retires.",
      stats: [["Laps", acts.exchange.laps], ["Drivers", acts.exchange.drivers], ["Time", "2′"]],
      go: "Open the market",
      sprint: acts.exchange.sprint ? { href: `/gp/${slug}/sprint/exchange`, label: "Trade the sprint too" } : null,
    });

  const many = ["", "", "", "Three", "Four", "Five", "Six"][games.length] ?? String(games.length);
  const intro =
    games.length === 2
      ? "Two ways to play this Grand Prix, both built from the same timing data as the weekend itself."
      : games.length > 2
        ? `${many} ways to play this Grand Prix, all built from the same timing data as the weekend itself.`
      : games.length === 1
        ? "One way to play this Grand Prix. The other needs more of the race than this one has."
        : "Nothing to play with here yet. The activities arrive with the timing data.";

  return (
    <>
      <div className="hub-top">
        <Link href={`/gp/${slug}`} prefetch={false} className="hub-back">
          ← {weekend.circuit}
        </Link>
        <Link href="/" prefetch={false} className="hub-home">Racing Simplified</Link>
      </div>

      <main className="acts fx-page">
        <MotionFX />
        <Speedlines n={5} />
        <Beam className="acts-beam" />
        <header className="acts-head" data-fx="left">
          <span className="acts-eyebrow">
            {weekend.short} · {weekend.date}
          </span>
          <h1>
            <span>{weekend.circuit}</span>
            <span className="glow">Simplified</span>
          </h1>
          <p>{intro}</p>
        </header>

        <div
          className="games"
          data-odd={games.length > 1 && games.length % 2 ? "" : undefined}
          style={{ "--cols": columns(games.length) } as CSSProperties}
        >
          {games.map((g, i) => (
            <article className="game" key={g.n} data-fx={i % 2 ? "right" : "left"}>
              <Link href={g.href} className="game-main">
                <div className="game-art" aria-hidden>{g.art}</div>
                <div className="game-body">
                  <span className="game-n">Activity {g.n}</span>
                  <h2 className="game-title">
                    <span>{g.top}</span>
                    <em>{g.lit}</em>
                  </h2>
                  <p>{g.copy}</p>
                  <dl className="game-stats">
                    {g.stats.map(([k, v]) => (
                      <div key={k}>
                        <dt>{k}</dt>
                        <dd>{typeof v === "number" ? v.toLocaleString("en-GB") : v}</dd>
                      </div>
                    ))}
                  </dl>
                  <span className="game-go">
                    {g.go} <i aria-hidden>→</i>
                  </span>
                </div>
              </Link>
              {g.sprint && (
                <Link href={g.sprint.href} className="game-sprint">
                  <span>Sprint weekend</span>
                  <b>{g.sprint.label}</b>
                  <i aria-hidden>→</i>
                </Link>
              )}
            </article>
          ))}
        </div>
      </main>
    </>
  );
}
