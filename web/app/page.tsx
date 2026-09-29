import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { activitiesFor, listGPs, loadBrain, loadStory, loadTrack, loadWeekend } from "@/lib/data";
import { askAlfred } from "@/lib/alfred";
import { GHOST, bigPhoto } from "@/lib/photo";
import HowSwitch from "@/components/HowSwitch";
import MotionFX from "@/components/MotionFX";
import { Beam, Blur, MOOD, Speedlines, Streak } from "@/components/Mood";
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

/** The front-page headline: circuit first, then what the timing says
 *  happened. Each branch only claims what its own facts support. */
function frontPage(w: Weekend, f: RaceFacts): { circuit: string; line: string; em: string } {
  const who = f.winner.last;
  if (f.winner.start && f.winner.start >= 10)
    return { circuit: w.circuit, line: `${who} wins`, em: `from P${f.winner.start}` };
  if (f.margin !== null && f.runnerUp && f.margin < 1)
    return { circuit: w.circuit, line: `${who} holds off ${f.runnerUp}`, em: `by ${f.margin.toFixed(3)}s` };
  if (f.redFlag) return { circuit: w.circuit, line: `${who} wins`, em: "a race that was stopped" };
  if (f.margin !== null) return { circuit: w.circuit, line: `${who} wins`, em: `by ${f.margin.toFixed(1)}s` };
  return { circuit: w.circuit, line: `${who} wins`, em: "" };
}


export default function Home() {
  const when = (d: string) => Date.parse(d.replace(/^(\d+) (\w+) (\d+)$/, "$2 $1 $3"));
  const weekends = listGPs()
    .map((slug) => ({ weekend: loadWeekend(slug), track: loadTrack(slug) }))
    .sort((a, b) => when(b.weekend.date) - when(a.weekend.date));

  const latest = weekends.find((w) => w.weekend.facts) ?? weekends[0];
  const facts = latest?.weekend.facts ?? null;
  void homeFigure;

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

  // the latest weekend, counted rather than described: how many calls the
  // race hands you, how many sheets the blind test has, whose pit wall it is
  const acts = latest ? activitiesFor(latest.weekend.slug, latest.weekend) : null;
  const calls = latest && facts
    ? loadStory(latest.weekend.slug, "race").cards.filter((c) =>
        ["decision", "prediction", "guess"].includes(c.type)).length
    : 0;
  // the opening line of the site is the latest race, in one sentence
  const opener = facts && latest
    ? facts.winner.start && facts.winner.start > 3
      ? `${facts.winner.last} started P${facts.winner.start} at ${latest.weekend.circuit} and won it` +
        (facts.margin !== null ? ` by ${facts.margin.toFixed(3)}s.` : ".")
      : `${facts.winner.last} won ${latest.weekend.circuit}` +
        (facts.margin !== null ? ` by ${facts.margin.toFixed(3)}s.` : ".")
    : null;

  return (
    <main className="home led fx-home">
      <MotionFX />
      <nav className="home-nav">
        <span className="home-brand">Racing Simplified</span>
        <a href="#how">How it works</a>
        <a href="#latest">Latest</a>
        <a href="#races">Races</a>
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
        <div className="hero-helmet" data-par="0.12">
          <Blur src={MOOD.helmet} className="mood-helmet" />
        </div>
        <Speedlines />
        <span className="home-kicker">Formula 1 · Season 2026</span>
        <h1>
          <span className="home-l1">Every race</span>
          <span className="home-l2 glow">Simplified</span>
        </h1>
        <p className="home-lede">
          {opener && <span className="home-opener">{opener} </span>}
          Every weekend, rebuilt from the official timing data. Read it as a
          story with <b>Scrolled</b>, or play the race with <b>Simplified</b>.
        </p>
        <div className="home-cta">
          {latest && (
            <Link href={`/gp/${latest.weekend.slug}/sessions`} className="home-go">
              Scroll {latest.weekend.circuit} <i aria-hidden>→</i>
            </Link>
          )}
          {latest && (
            <Link href={`/gp/${latest.weekend.slug}/activities`} className="home-go home-go-alt">
              Play {latest.weekend.circuit} <i aria-hidden>→</i>
            </Link>
          )}
          <a href="#how" className="home-more">
            how it works
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

      <div className="cross-car" data-par="0.28" aria-hidden>
        <Blur src={MOOD.car} className="mood-car" />
      </div>

      {/* ------------------------------------------ 2 · the two channels */}
      <section className="how" id="how">
        <div className="how-banner">
          <div className="how-banner-text">
            <span className="how-banner-k">Racing Simplified</span>
            <h2 data-fx="left">How it works</h2>
            <p>
              Every circuit has the same two doors. Both open on the official
              timing feed, and when the feed cannot back a claim, the claim is
              not made. That rule costs us cards, and we keep it.
            </p>
          </div>
        </div>

        <HowSwitch
          doors={[
            { key: "scrolled", n: "01", name: "Scrolled", line: "Read the whole weekend, first practice to the flag" },
            { key: "simplified", n: "02", name: "Simplified", line: "Play the race: guess it, run it, rewrite it" },
          ]}
          scrolled={
            <>
              {/* ---- 01 · Scrolled: the weekend itself, with Alfred riding along */}
              <div className="how-block how-scrolled">
                <div className="how-copy">
                  <span className="how-n">01 · Read it</span>
                  <h3 className="how-title">Scrolled</h3>
                  <p className="how-sub">The whole weekend, moment by moment</p>
                  <p>
                    Practice 1 to the chequered flag, told in the order it happened.
                    The circuit draws itself under you as you scroll, the cards land
                    as the laps go by, and every few laps the story stops and hands
                    you the call: box or stay out, penalty or no penalty, who is not
                    going to see the flag. Then the data shows what the team did.
                  </p>
                  <Link href={latest ? `/gp/${latest.weekend.slug}/sessions` : "#races"} className="how-go">
                    Scroll {latest?.weekend.circuit ?? "a race"} <i aria-hidden>→</i>
                  </Link>
                </div>
                <div className="how-acts">
                  <Link href={latest ? `/gp/${latest.weekend.slug}/sessions` : "#races"} className="how-act">
                    <span className="how-act-n">Session by session</span>
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
                    <h4>The five sessions</h4>
                    <p>
                      {acts && latest
                        ? `${acts.sessions} sessions at ${latest.weekend.circuit}, ${acts.moments} moments, Friday practice included. `
                        : "FP1 to the race, nothing skipped. "}
                      One card for every moment that mattered, none for the ones
                      that did not.
                    </p>
                    <span className="how-act-go">Scroll it →</span>
                  </Link>
                  <Link href={latest ? `/gp/${latest.weekend.slug}/race` : "#races"} className="how-act">
                    <span className="how-act-n">Your calls</span>
                    <svg viewBox="0 0 120 80" className="way-art" aria-hidden>
                      <path d="M60 70V40" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                      <path d="M60 40L30 14M60 40L90 14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                      <circle cx="30" cy="14" r="6" fill="currentColor" />
                      <circle cx="90" cy="14" r="6" fill="none" stroke="currentColor" strokeWidth="3" />
                    </svg>
                    <h4>Decisions, then the reveal</h4>
                    <p>
                      {calls && latest
                        ? `${calls} calls to make in the ${latest.weekend.circuit} race alone. `
                        : "Box or stay out, penalty or no penalty, who retires. "}
                      You answer first, with the gap and the tyres in front of you,
                      and the timing sheet answers back.
                    </p>
                    <span className="how-act-go">Make a call →</span>
                  </Link>
                  <Link href={latest ? `/gp/${latest.weekend.slug}/race` : "#races"} className="how-act how-act-alfred">
                    <span className="how-act-n">Alfred, riding along</span>
                    {asks.length > 0 ? (
                      <div className="how-chat" aria-hidden>
                        <p className="alfred-you">{asks[0].q}</p>
                        {asks[0].a.slice(0, 2).map((line, i) => (
                          <p key={i} className="alfred-him">{line}</p>
                        ))}
                      </div>
                    ) : (
                      <svg viewBox="0 0 120 80" className="way-art" aria-hidden>
                        <rect x="10" y="14" width="100" height="52" rx="10" fill="none" stroke="currentColor" strokeWidth="3" />
                      </svg>
                    )}
                    <h4>Ask him anything</h4>
                    <p>
                      He has the timing data for the race and nothing else, which is
                      why he talks like a mate and not like a press release. When he
                      does not know, he says so.
                    </p>
                    <span className="how-act-go">Ask him →</span>
                  </Link>
                </div>
              </div>
            </>
          }
          simplified={
            <>
              {/* ---- 02 · Simplified: the activities, ours, on the same data */}
              <div className="how-block how-simplified">
                <div className="how-copy">
                  <span className="how-n">02 · Play it</span>
                  <h3 className="how-title">Simplified</h3>
                  <p className="how-sub">Our activities, on the same data</p>
                  <p>
                    The name on the door and the things you play with behind it.
                    Every activity is built from the race that happened and stops
                    where the data stops: the pit wall never scores a safety car,
                    because nobody can measure one.
                  </p>
                  <Link href={latest ? `/gp/${latest.weekend.slug}/activities` : "#races"} className="how-go">
                    Play {latest?.weekend.circuit ?? "a race"} <i aria-hidden>→</i>
                  </Link>
                </div>
                <div className="how-acts">
                  <Link href={latest ? `/gp/${latest.weekend.slug}/race/blind` : "#races"} className="how-act">
                    <span className="how-act-n">Activity 01</span>
                    <figure className="way-ghost" aria-hidden>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={GHOST} alt="" />
                      <b>?</b>
                    </figure>
                    <h4>The blind test</h4>
                    <p>
                      {acts?.blind && latest
                        ? `${acts.blind.rounds} real timing sheets from ${latest.weekend.circuit}, names struck out. `
                        : "Real timing sheets, names struck out. "}
                      Where he started, when he stopped, what the stewards made of
                      him. Say who it is.
                    </p>
                    <span className="how-act-go">Start the test →</span>
                  </Link>
                  <Link href={latest ? `/gp/${latest.weekend.slug}/race/pitwall` : "#races"} className="how-act">
                    <span className="how-act-n">Activity 02</span>
                    <svg viewBox="0 0 120 80" className="way-art" aria-hidden>
                      <path d="M30 52v-8a30 30 0 0 1 60 0v8" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                      <rect x="22" y="48" width="14" height="22" rx="5" fill="currentColor" />
                      <rect x="84" y="48" width="14" height="22" rx="5" fill="currentColor" />
                      <path d="M91 70v3a7 7 0 0 1-7 7H70" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                    <h4>The pit wall</h4>
                    <p>
                      {acts?.pitwall && latest
                        ? `${acts.pitwall.driver}'s seat at ${latest.weekend.circuit}, ${acts.pitwall.calls} calls, the race frozen where his garage chose. `
                        : "A driver's seat, the race frozen where his garage chose. "}
                      At the flag it tells you where your afternoon would have ended.
                    </p>
                    <span className="how-act-go">Take the wall →</span>
                  </Link>
                  <div className="how-act how-act-next">
                    <span className="how-act-n">Activity 03</span>
                    <svg viewBox="0 0 120 80" className="way-art" aria-hidden>
                      <path d="M14 60 L60 20 L106 60" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="4 6" />
                      <circle cx="60" cy="20" r="5" fill="currentColor" />
                    </svg>
                    <h4>The what-if</h4>
                    <p>
                      Take the safety car out, hand the retirement its car back and
                      watch the podium rearrange on the real pace. Coming only if it
                      can be done honestly.
                    </p>
                    <span className="how-act-go">In the works</span>
                  </div>
                </div>
              </div>
            </>
          }
        />
      </section>

      <Streak />

      {/* ------------------------------------------- 3 · the latest race */}
      {latest && facts && (
        <section
          className="spread spread-horse"
          id="latest"
          style={{ ["--team" as string]: tone(facts.winner.colour) }}
        >
          <div className="spread-run" data-fx="left">
            <Blur src={MOOD.horse} className="mood-horse" />
          </div>
          <div className="spread-head">
            <span className="spread-tag">Latest recap</span>
            <span className="spread-eyebrow">
              {latest.weekend.short} · {latest.weekend.date}
            </span>
          </div>
          <h2 className="spread-name" data-fx="right">
            <span className="spread-circuit">{frontPage(latest.weekend, facts).circuit}</span>
            <span className="spread-line">
              {frontPage(latest.weekend, facts).line}{" "}
              <span className="glow">{frontPage(latest.weekend, facts).em}</span>
            </span>
          </h2>
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
            <div className="spread-ctas">
              <Link href={`/gp/${latest.weekend.slug}/sessions`} className="spread-go">
                Scrolled <i aria-hidden>→</i>
              </Link>
              <Link href={`/gp/${latest.weekend.slug}/activities`} className="spread-go spread-go-alt">
                Simplified <i aria-hidden>→</i>
              </Link>
            </div>
          </div>
        </section>
      )}

      <Streak flip />

      {/* --------------------------------------------- 4 · the circuits */}
      <section className="home-races races-run" id="races">
        <div className="home-sec-head">
          <h2 data-fx="left">The circuits</h2>
          <p>Every weekend built so far, newest first. Each one opens on the same two doors.</p>
        </div>
        <div className="races-wrap" data-fx="right">
        <div className="home-grid races-track" data-strip>
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
        <div className="races-bar" data-strip-bar aria-hidden>
          <i className="races-thumb" />
        </div>
        </div>
      </section>

      {/* ------------------------------------------------ 5 · the numbers */}
      <section className="numbers numbers-fire">
        <div className="numbers-tyre">
          <Blur src={MOOD.tyre} className="mood-tyre" />
        </div>
        <Beam />
        <div className="home-sec-head">
          <h2 data-fx="left">Built so far</h2>
        </div>
        <dl className="numbers-row numbers-stagger" data-fx="right">
          <div>
            <dd className="glow">{totals.races}</dd>
            <dt>Grands Prix</dt>
          </div>
          <div>
            <dd className="glow">{totals.moments}</dd>
            <dt>moments told</dt>
          </div>
          <div>
            <dd className="glow">{totals.laps}</dd>
            <dt>race laps</dt>
          </div>
          <div>
            <dd className="glow">{totals.passes}</dd>
            <dt>passes on track</dt>
          </div>
          <div>
            <dd className="glow">{totals.stops}</dd>
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
