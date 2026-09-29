"use client";

import Link from "next/link";
import { useState } from "react";
import type { PitWall as Wall, PitWallCall } from "@/lib/types";
import { bigPhoto } from "@/lib/photo";
import Term from "@/components/Term";
import { Speedlines } from "@/components/Mood";

/**
 * You take the calls, and the calls cost what they cost.
 *
 * The point is not that you beat a strategist. It is that you find out how
 * little room he had: most of these decisions come down to a second either
 * way, and a second is the whole race. Every number on the screen was measured
 * out of this Grand Prix, which is why the answers are allowed to be boring:
 * sometimes the lap he picked really was the right one.
 *
 * Laid out as a wall, not a quiz. The driver stands down the right of the
 * screen for the whole run, lit by his team's colour, with the lap counter and
 * your running deficit stacked beside him: that column is the only thing that
 * changes as you play, so it is where the eye goes. The work happens on the
 * left. The blind test hides a face and gives you half a screen to guess at
 * it; this one puts the face where you cannot avoid it, because the entire
 * premise is whose afternoon you are spending.
 */

function secs(v: number): string {
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}s`;
}

/**
 * The classification with your afternoon dropped into it.
 *
 * The driver's own row comes out first. He is not on the timing screen twice
 * and you are not racing him: you are him, finishing wherever the seconds you
 * spent put you.
 */
function standings(wall: Wall, gap: number) {
  const rows = wall.ladder
    .filter((r) => r.pos !== wall.driver.finish)
    .map((r) => ({ name: r.name, gap: r.gap, you: false }))
    .concat([{ name: wall.driver.name, gap, you: true }])
    .sort((a, b) => a.gap - b.gap)
    .map((r, i) => ({ ...r, pos: i + 1 }));
  const mine = rows.find((r) => r.you)!;
  const top = rows.slice(0, 8);
  return { place: mine.pos, rows: top.some((r) => r.you) ? top : [...top, mine] };
}

export default function PitWall({ wall, backTo }: { wall: Wall; backTo: string }) {
  const [started, setStarted] = useState(false);
  const [at, setAt] = useState(0);
  const [pick, setPick] = useState<number | null>(null);
  const [lost, setLost] = useState(0);

  const start = () => {
    setStarted(true);
    setAt(0);
    setPick(null);
    setLost(0);
  };

  const { driver, economics, calls, ladder } = wall;
  const realGap = ladder.find((r) => r.pos === driver.finish)?.gap ?? 0;
  const hex = (driver.colour || "ff1c12").replace("#", "");
  const tone = { ["--team" as string]: `#${hex}` };
  const shot = driver.headshot ? bigPhoto(driver.headshot) : null;

  const Portrait = ({ className = "" }: { className?: string }) => (
    <figure className={`pw-shot ${className}`}>
      <span className="pw-glow" aria-hidden />
      {shot ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={shot} alt={driver.name} />
      ) : (
        <span className="pw-noshot" aria-hidden>
          {driver.number}
        </span>
      )}
      <figcaption>
        <span className="pw-num">{driver.number}</span>
        <b>{driver.name}</b>
        <em>{driver.team}</em>
      </figcaption>
    </figure>
  );

  if (!started)
    return (
      <main className="pw pw-cover pw-fx" style={tone}>
        <Speedlines n={6} />
        <div className="pw-cover-copy" data-fx="left">
          <span className="pw-eyebrow">The pit wall · {wall.session}</span>
          <h1 className="pw-h1">
            You are on
            <span className="glow">{driver.name}&rsquo;s radio</span>
          </h1>
          <p className="pw-lede">
            He started P{driver.start} and finished P{driver.finish}, with{" "}
            <b>{driver.margin}s</b> between him and the car next door. You get
            the {calls.length} calls his garage got, with the race frozen where
            they were made and nothing on the screen he did not have.
          </p>
          <dl className="pw-terms">
            <div>
              <dt>
                <Term label="A stop cost" />
              </dt>
              <dd>
                {economics.pitLoss}
                <small>seconds, every time he came in</small>
              </dd>
            </div>
            {Object.entries(economics.tyres).map(([c, t]) => (
              <div key={c}>
                <dt>
                  <Term label={`${c.toLowerCase()} wear`} />
                </dt>
                <dd>
                  {(t.deg * 1000).toFixed(0)}
                  <small>
                    ms slower each lap, so {((t.deg * 20)).toFixed(1)}s worse
                    twenty laps in
                  </small>
                </dd>
              </div>
            ))}
          </dl>
          <p className="pw-fine">
            Measured off this race once the fuel burn was taken out of it.
          </p>
          <button className="pw-go" onClick={start}>
            Take the wall <i aria-hidden>→</i>
          </button>
          <Link href={backTo} className="pw-back">
            back to the activities
          </Link>
        </div>
        <Portrait className="cover" />
      </main>
    );

  if (at >= calls.length) {
    const gap = realGap + lost;
    const { place, rows } = standings(wall, gap);
    const moved = place - driver.finish;
    return (
      <main className="pw pw-cover" style={tone}>
        <div className="pw-cover-copy">
          <span className="pw-eyebrow">At the flag</span>
          <div className="pw-result">
            <div className="pw-place">
              <small>P</small>
              {place}
            </div>
            <div className="pw-final">
              <b className={lost > 0 ? "bad" : lost < 0 ? "good" : ""}>
                {lost === 0 ? "level" : secs(lost)}
              </b>
              <span>on his real race</span>
            </div>
          </div>
          <p className="pw-lede">
            {moved === 0 && lost === 0
              ? `Every call his. You ran ${driver.name}'s race to the lap.`
              : moved === 0
                ? `${secs(lost)} across the afternoon, and it changed nothing. `
                  + `The car behind was ${driver.margin}s away and stayed there.`
                : moved > 0
                  ? `${secs(lost)} across the afternoon, and it cost `
                    + `${moved} place${moved > 1 ? "s" : ""}. This is what people `
                    + "mean when they say a race is won on the pit wall."
                  : `${secs(lost)} up on what they did. You would have beaten `
                    + `${Math.abs(moved)} car${moved < -1 ? "s" : ""} he finished behind.`}
          </p>
          <ol className="pw-ladder">
            {rows.map((r) => (
              <li key={r.pos} className={r.you ? "you" : ""}>
                <b>{r.pos}</b>
                <span>{r.you ? `${r.name} (you)` : r.name}</span>
                <em>{r.gap ? `+${r.gap.toFixed(3)}` : "winner"}</em>
              </li>
            ))}
          </ol>
          <button className="pw-go" onClick={start}>
            Take it again <i aria-hidden>→</i>
          </button>
          <Link href={backTo} className="pw-back">
            back to the activities
          </Link>
        </div>
        <Portrait className="cover" />
      </main>
    );
  }

  const call: PitWallCall = calls[at];
  const answered = pick !== null;
  const chosen = answered ? call.options[pick] : null;
  const real = call.options.find((o) => o.real);
  const best = Math.min(...call.options.map((o) => o.lost));

  const choose = (i: number) => {
    if (answered) return;
    setPick(i);
    setLost((v) => Math.round((v + call.options[i].lost - (real?.lost ?? 0)) * 10) / 10);
  };

  return (
    <main className="pw" style={tone}>
      <div className="pw-stage">
        <section className="pw-desk">
          <span className="pw-kicker">
            {call.kicker}
            <em>
              call {at + 1} of {calls.length}
            </em>
          </span>
          <h2 className="pw-q">{call.question}</h2>

          <div className="pw-instruments">
            {call.facts.map(([k, v]) => (
              <div key={k}>
                <dt>
                  <Term label={k} />
                </dt>
                <dd>{v}</dd>
              </div>
            ))}
          </div>

          <p className="pw-scale">
            Every option is priced against the quickest one available, over the
            laps that call touches. Nothing is a guess: the seconds come out of
            what the tyres did in this race.
          </p>

          <ol className="pw-opts">
            {call.options.map((o, i) => (
              <li key={o.label}>
                <button
                  className={`pw-opt${pick === i ? " picked" : ""}${
                    answered && o.lost === best ? " best" : ""
                  }`}
                  disabled={answered}
                  onClick={() => choose(i)}
                >
                  <span className="pw-lap">
                    L<b>{o.lap}</b>
                  </span>
                  <span className="pw-said">
                    <b>{o.label}</b>
                    <small>{o.note}</small>
                  </span>
                  <span className="pw-cost">
                    {answered ? (
                      <>
                        <i>{o.lost === 0 ? "-" : `+${o.lost}s`}</i>
                        <u>
                          {pick === i && "yours"}
                          {pick === i && o.real && " · "}
                          {o.real && "theirs"}
                        </u>
                      </>
                    ) : (
                      <i className="hush">?</i>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ol>

          {answered && chosen && (
            <div className="pw-out">
              <div
                className={`pw-verdict${chosen.lost <= (real?.lost ?? 0) ? " good" : ""}`}
              >
                {chosen.real
                  ? "Their call, exactly"
                  : chosen.lost <= (real?.lost ?? 0)
                    ? `${secs(chosen.lost - (real?.lost ?? 0))} on what they did`
                    : `${secs(chosen.lost - (real?.lost ?? 0))} against you`}
              </div>
              <p className="pw-reading">{call.reading}</p>
              <button
                className="pw-go pw-next"
                onClick={() => {
                  setAt((i) => i + 1);
                  setPick(null);
                }}
              >
                {at + 1 === calls.length ? "Take it to the flag" : "Next call"}{" "}
                <i aria-hidden>→</i>
              </button>
            </div>
          )}
        </section>

        <aside className="pw-rail">
          <Portrait />
          <div className="pw-live">
            <div>
              <dt>Lap</dt>
              <dd>
                {call.lap}
                <small>/ {wall.laps}</small>
              </dd>
            </div>
            <div>
              <dt>Against his race</dt>
              <dd className={lost > 0 ? "bad" : lost < 0 ? "good" : ""}>
                {lost === 0 ? "level" : secs(lost)}
              </dd>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
