import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { listGPs, loadBrain, loadTrack, loadWeekend } from "@/lib/data";
import { askAlfred } from "@/lib/alfred";
import { GHOST, bigPhoto } from "@/lib/photo";
import type { RaceFacts, Track, Weekend } from "@/lib/types";

/**
 * The front door.
 *
 * Two worlds, alternating. The black one is the site's own voice: the LED
 * board, the red signal, the timing data. The cream one is borrowed from the
 * magazine spread Ernesto sent, black condensed type over a red graphic with
 * a photograph cutting through both, and an italic serif doing the talking.
 * The moodboard asked for exactly that alternation, section by section, and
 * the poster at the end of every race already lives in the cream world, so
 * the home page is where the two finally meet.
 *
 * Everything on it is read out of the built weekends. The winner, the margin,
 * the number of passes, the answer Alfred gives: none of it is written here,
 * all of it comes from the same JSON the race pages run on, which is the only
 * way a home page stays true when the next Grand Prix lands.
 */

/** Hero artwork, dropped at public/home/driver.(png|jpg|webp). */
function homeFigure(): string | null {
  for (const ext of ["png", "webp", "jpg", "jpeg"]) {
    if (fs.existsSync(path.join(process.cwd(), "public", "home", `driver.${ext}`)))
      return `/home/driver.${ext}`;
  }
  return null;
}

function trackArt(track: Track, pad = 40) {
  const pts = track.points;
  const d = "M " + pts.map((p) => p[0] + " " + p[1]).join(" L ");
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const vb = [
    Math.min(...xs) - pad,
    Math.min(...ys) - pad,
    Math.max(...xs) - Math.min(...xs) + pad * 2,
    Math.max(...ys) - Math.min(...ys) + pad * 2,
  ].join(" ");
  return { d, vb };
}

function tone(colour?: string): string {
  const hex = (colour || "").replace("#", "");
  return /^[0-9a-f]{6}$/i.test(hex) ? `#${hex}` : "#ff1c12";
}

/** One line of the ticker per race: the thing you would tell a friend. */
function headline(w: Weekend): string {
  const f = w.facts;
  if (!f) return `${w.circuit} · ${w.sessions.length} sessions`;
  const climb = f.winner.start && f.winner.start > 3 ? ` from P${f.winner.start}` : "";
  const by = f.margin !== null ? ` by ${f.margin.toFixed(3)}s` : "";
  return `${w.circuit} · ${f.winner.last} wins${climb}${by}`;
}

/** The race in a sentence, for the spread. Built from facts, not typed. */
function story(w: Weekend, f: RaceFacts): string {
  const bits: string[] = [];
  if (f.winner.start && f.winner.start > 3)
    bits.push(`${f.winner.first} ${f.winner.last} started ${f.winner.start}th and won`);
  else bits.push(`${f.winner.first} ${f.winner.last} won from P${f.winner.start ?? "?"}`);
  if (f.margin !== null && f.runnerUp)
    bits.push(
      f.margin < 1
        ? `with ${f.runnerUp} ${f.margin.toFixed(3)} seconds behind after ${f.laps} laps`
        : `${f.margin.toFixed(1)} seconds clear of ${f.runnerUp}`
    );
  const drama = [
    f.redFlag && "a red flag that stopped the race",
    f.safetyCars > 0 && `${f.safetyCars} safety car${f.safetyCars > 1 ? "s" : ""}`,
    f.dnfs > 0 && `${f.dnfs} cars that never saw the flag`,
  ].filter(Boolean) as string[];
  const tail = drama.length ? `, through ${drama.join(", ")}` : "";
  return `${bits.join(", ")}${tail}. ${f.passes} passes on track, ${f.stops} pit stops, ${w.laps} laps of ${w.circuit}.`;
}

export default function Home() {
  const when = (d: string) => Date.parse(d.replace(/^(\d+) (\w+) (\d+)$/, "$2 $1 $3"));
  const weekends = listGPs()
    .map((slug) => ({ weekend: loadWeekend(slug), track: loadTrack(slug) }))
    .sort((a, b) => when(b.weekend.date) - when(a.weekend.date));

  const latest = weekends.find((w) => w.weekend.facts) ?? weekends[0];
  const facts = latest?.weekend.facts ?? null;
  const figure = homeFigure();

  // totals across everything built, for the numbers section
  const totals = weekends.reduce(
    (t, { weekend: w }) => ({
      races: t.races + 1,
      moments: t.moments + w.sessions.reduce((n, s) => n + s.moments, 0),
      laps: t.laps + (w.facts?.laps ?? 0),
      passes: t.passes + (w.facts?.passes ?? 0),
      stops: t.stops + (w.facts?.stops ?? 0),
    }),
    { races: 0, moments: 0, laps: 0, passes: 0, stops: 0 }
  );

  // Alfred, answering for real: the same function the race pages call
  const brain = latest ? loadBrain(latest.weekend.slug, "race") : null;
  const asks = brain && facts
    ? [
        "who won?",
        `why did ${facts.runnerUp?.toLowerCase() ?? "russell"} lose it?`,
        "what's an undercut?",
      ].map((q) => ({ q, a: askAlfred(q, brain) }))
    : [];

  const ticker = weekends.map(({ weekend }) => headline(weekend));

  return (
    <main className="home">
      <nav className="home-nav">
        <span className="home-brand">Racing Simplified</span>
        <a href="#latest">Latest</a>
        <a href="#races">Races</a>
        <a href="#play">Play</a>
        <a href="#alfred">Alfred</a>
        <span className="home-season">Season 2026</span>
      </nav>

      {/* ------------------------------------------------ 1 · the board */}
      <header className="home-hero">
        {latest && (
          <svg className="home-hero-track" viewBox={trackArt(latest.track).vb} aria-hidden>
            <path
              d={trackArt(latest.track).d}
              fill="none"
              stroke="currentColor"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              pathLength={1}
            />
          </svg>
        )}
        {figure && (
          <div className="home-figure" aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={figure} alt="" />
          </div>
        )}
        <h1>
          <span className="home-l1">Every race</span>
          <span className="home-l2">Simplified</span>
        </h1>
        <p className="home-lede">
          Missed the Grand Prix? Fell asleep on lap 30? Every weekend is
          rebuilt from the official timing data and told moment by moment,
          with the calls handed to you along the way.
        </p>
        <div className="home-cta">
          {latest && (
            <Link href={`/gp/${latest.weekend.slug}`} className="home-go">
              Open {latest.weekend.circuit} <i aria-hidden>→</i>
            </Link>
          )}
          <a href="#races" className="home-more">
            all circuits
          </a>
        </div>
        {ticker.length > 0 && (
          <div className="home-ticker" aria-hidden>
            <div className="home-ticker-run">
              {[...ticker, ...ticker].map((t, i) => (
                <span key={i}>{t}</span>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* ------------------------------------------- 2 · the latest race */}
      {latest && facts && (
        <section className="spread" id="latest" style={{ ["--team" as string]: tone(facts.winner.colour) }}>
          <div className="spread-head">
            <span className="spread-n">01</span>
            <span className="spread-eyebrow">
              The last one · {latest.weekend.short} · {latest.weekend.date}
            </span>
          </div>
          <svg className="spread-track" viewBox={trackArt(latest.track, 20).vb} aria-hidden>
            <path
              d={trackArt(latest.track, 20).d}
              fill="none"
              stroke="currentColor"
              strokeWidth={18}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <h2 className="spread-name">
            <span>{facts.winner.first}</span>
            <span>{facts.winner.last}</span>
          </h2>
          <figure className="spread-shot">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={bigPhoto(facts.winner.headshot)} alt={`${facts.winner.first} ${facts.winner.last}`} />
          </figure>
          <div className="spread-copy">
            <p className="spread-serif">{story(latest.weekend, facts)}</p>
            <dl className="spread-facts">
              <div>
                <dt>Winning margin</dt>
                <dd>{facts.margin !== null ? `${facts.margin.toFixed(3)}s` : "-"}</dd>
              </div>
              <div>
                <dt>Fastest lap</dt>
                <dd>{facts.fastest ? `${facts.fastest.last} · ${facts.fastest.time}` : "-"}</dd>
              </div>
              <div>
                <dt>From the grid</dt>
                <dd>{facts.winner.start ? `P${facts.winner.start} to P1` : "-"}</dd>
              </div>
            </dl>
            <Link href={`/gp/${latest.weekend.slug}/race`} className="spread-go">
              Scroll the race <i aria-hidden>→</i>
            </Link>
          </div>
        </section>
      )}

      {/* --------------------------------------------- 3 · the circuits */}
      <section className="home-races" id="races">
        <div className="home-sec-head">
          <span className="home-sec-n">02</span>
          <h2>The circuits</h2>
          <p>Every weekend built so far. Newest first.</p>
        </div>
        <div className="home-grid">
          {weekends.map(({ weekend: w, track }, i) => {
            const art = trackArt(track);
            const moments = w.sessions.reduce((n, s) => n + s.moments, 0);
            const f = w.facts;
            return (
              <Link
                key={w.slug}
                href={`/gp/${w.slug}`}
                className="home-card"
                style={{ ["--team" as string]: tone(f?.winner.colour) }}
              >
                <span className="home-card-i">{String(i + 1).padStart(2, "0")}</span>
                <svg viewBox={art.vb} aria-hidden>
                  <path
                    d={art.d}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.6}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray="0 6"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
                {f && (
                  <figure className="home-card-face" aria-hidden>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={bigPhoto(f.winner.headshot)} alt="" />
                  </figure>
                )}
                <span className="home-card-name">{w.circuit}</span>
                <span className="home-card-sub">
                  {w.short} · {w.date}
                </span>
                {f ? (
                  <span className="home-card-win">
                    <b>{f.winner.last}</b> wins
                    {f.winner.start && f.winner.start > 3 ? ` from P${f.winner.start}` : ""}
                    {f.margin !== null ? ` · by ${f.margin.toFixed(3)}s` : ""}
                  </span>
                ) : (
                  <span className="home-card-win">Race not built yet</span>
                )}
                <span className="home-card-meta">
                  <em>{w.sessions.length} sessions</em>
                  <b>{moments} moments</b>
                </span>
                <span className="home-card-go">Enter →</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ------------------------------------------- 4 · three ways in */}
      <section className="ways" id="play">
        <div className="home-sec-head">
          <span className="home-sec-n">03</span>
          <h2>Three ways through a Grand Prix</h2>
          <p className="ways-serif">
            Read it, guess it, or run it yourself. All three come out of the
            same timing feed, and none of them will tell you anything the data
            cannot back up.
          </p>
        </div>
        <div className="ways-grid">
          <Link href={latest ? `/gp/${latest.weekend.slug}/sessions` : "#races"} className="way">
            <span className="way-n">Scrolled</span>
            <svg viewBox="0 0 120 80" className="way-art" aria-hidden>
              <rect x="6" y="8" width="108" height="64" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
              {[0, 1, 2, 3, 4, 5, 6, 7].map((r) =>
                [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((c) => (
                  <circle
                    key={`${r}${c}`}
                    cx={14 + c * 8.4}
                    cy={16 + r * 7}
                    r="1.6"
                    fill="currentColor"
                    opacity={(r === 3 || r === 4) && c > 1 && c < 10 ? 1 : 0.18}
                  />
                ))
              )}
            </svg>
            <h3>The weekend, moment by moment</h3>
            <p>
              The circuit draws itself under you as you scroll. Cards land as
              the laps go by, with predictions and pit-wall calls you make
              before the answer shows.
            </p>
            <span className="way-go">Scroll a race →</span>
          </Link>
          <Link href={latest ? `/gp/${latest.weekend.slug}/race/blind` : "#races"} className="way">
            <span className="way-n">The blind test</span>
            <figure className="way-ghost" aria-hidden>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={GHOST} alt="" />
              <b>?</b>
            </figure>
            <h3>Five drivers, no names</h3>
            <p>
              A real afternoon on a timing sheet, name struck out. Where he
              started, how often he stopped, what the stewards made of him.
              Work out who you are looking at.
            </p>
            <span className="way-go">Start the test →</span>
          </Link>
          <Link href={latest ? `/gp/${latest.weekend.slug}/race/pitwall` : "#races"} className="way">
            <span className="way-n">The pit wall</span>
            <svg viewBox="0 0 120 80" className="way-art" aria-hidden>
              <path d="M30 52v-8a30 30 0 0 1 60 0v8" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              <rect x="22" y="48" width="14" height="22" rx="5" fill="currentColor" />
              <rect x="84" y="48" width="14" height="22" rx="5" fill="currentColor" />
              <path d="M91 70v3a7 7 0 0 1-7 7H70" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
            <h3>You make the calls</h3>
            <p>
              Take a driver&rsquo;s seat and decide when he stops, with the race
              frozen where his garage decided. At the flag it tells you where
              your afternoon would have ended.
            </p>
            <span className="way-go">Take the wall →</span>
          </Link>
        </div>
      </section>

      {/* ---------------------------------------------------- 5 · Alfred */}
      {asks.length > 0 && latest && (
        <section className="alfred" id="alfred">
          <div className="home-sec-head">
            <span className="home-sec-n">04</span>
            <h2>Ask Alfred</h2>
            <p>
              He watched every lap so you did not have to. He talks while you
              scroll, and answers whatever you type, from the timing data and
              nothing else. These are his real answers about {latest.weekend.circuit}.
            </p>
          </div>
          <div className="alfred-chat">
            {asks.map(({ q, a }) => (
              <div key={q} className="alfred-turn">
                <p className="alfred-you">{q}</p>
                {a.map((line, i) => (
                  <p key={i} className="alfred-him">
                    {line}
                  </p>
                ))}
              </div>
            ))}
            <Link href={`/gp/${latest.weekend.slug}/race`} className="alfred-go">
              Ask him yourself <i aria-hidden>→</i>
            </Link>
          </div>
        </section>
      )}

      {/* ------------------------------------------------ 6 · the numbers */}
      <section className="numbers">
        <div className="home-sec-head">
          <span className="home-sec-n">05</span>
          <h2>Built so far</h2>
        </div>
        <dl className="numbers-row">
          <div>
            <dd>{totals.races}</dd>
            <dt>Grands Prix</dt>
          </div>
          <div>
            <dd>{totals.moments}</dd>
            <dt>moments told</dt>
          </div>
          <div>
            <dd>{totals.laps}</dd>
            <dt>race laps</dt>
          </div>
          <div>
            <dd>{totals.passes}</dd>
            <dt>passes on track</dt>
          </div>
          <div>
            <dd>{totals.stops}</dd>
            <dt>pit stops</dt>
          </div>
        </dl>
        <p className="numbers-serif">
          Counted, not estimated. Every figure on this site is read from the
          official timing feed, and when the feed cannot back a claim, the
          claim is not made.
        </p>
      </section>

      <footer className="home-foot">
        <span>Racing Simplified</span>
        <span>Built from OpenF1 and FastF1 timing data · not affiliated with Formula 1</span>
      </footer>
    </main>
  );
}
