"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { BlindRound, BlindTest as Test } from "@/lib/types";
import { GHOST, bigPhoto } from "@/lib/photo";
import Term from "@/components/Term";
import { Blur, MOOD, Speedlines } from "@/components/Mood";

/**
 * Five drivers with their names taken off.
 *
 * You are not really guessing names. You are learning to read a timing sheet,
 * which is the thing the sport never bothers to teach anybody: that three
 * stops means something went wrong, that a big climb is worth more than the
 * position it ended on, that a fast median lap and a bad result is a story.
 *
 * The screen is a file with the subject struck out of it. Until you answer,
 * the subject is a figure that is the same for every driver, with a question
 * mark over it and his name, team and number under three redaction bars.
 * Answer and the real photograph arrives in its place, his team's colour
 * floods the panel behind him, the bars wipe away.
 *
 * Two things this used to get wrong. The first version blacked the real
 * photograph down to a silhouette, and a silhouette is an identification:
 * Hamilton's hair and Alonso's stance are recognisable from across a room. So
 * the real image is not in the document at all until the answer is in; there
 * is nothing to inspect, nothing to squint at. The second was a leak between
 * rounds: React kept the one <img> and swapped its src, and the CSS transition
 * from lit back to hidden showed the next driver in full colour for half a
 * second. The figure is keyed by round now, so each one is a fresh element
 * with no previous state to animate away from.
 *
 * The pack holds more rounds than a run uses, and the five are drawn when you
 * press start, so a second run is a different test.
 */

const ROUNDS = 5;
const LETTERS = ["A", "B", "C", "D", "E", "F"];

function draw(all: BlindRound[]): BlindRound[] {
  const pool = [...all];
  const out: BlindRound[] = [];
  while (out.length < Math.min(ROUNDS, all.length) && pool.length)
    out.push(...pool.splice(Math.floor(Math.random() * pool.length), 1));
  return out;
}

function teamTone(colour?: string): string {
  const hex = (colour || "").replace("#", "");
  return /^[0-9a-f]{6}$/i.test(hex) ? `#${hex}` : "#e10600";
}

export default function BlindTest({ test, backTo }: { test: Test; backTo: string }) {
  const [rounds, setRounds] = useState<BlindRound[] | null>(null);
  const [at, setAt] = useState(0);
  const [pick, setPick] = useState<string | null>(null);
  const [score, setScore] = useState(0);

  /* warm the cache with the current round's real photograph while the sheet
     is being read, so the reveal is instant. A fetch is not a render: nothing
     goes on screen. Lives up here with the other hooks, above the early
     returns, because a hook that only sometimes runs is a React error. */
  const upcoming = rounds?.[at]?.headshot;
  useEffect(() => {
    if (upcoming) new Image().src = bigPhoto(upcoming);
  }, [upcoming]);

  const start = () => {
    setRounds(draw(test.rounds));
    setAt(0);
    setPick(null);
    setScore(0);
  };

  /* the draw happens on click, never during render: a run has to be the same
     on the server and in the browser until somebody asks for one */
  if (!rounds) {
    return (
      <main className="bt bt-cover bt-fx">
        <Speedlines n={6} />
        <div className="bt-cover-copy" data-fx="left">
          <span className="bt-eyebrow">The blind test · {test.session}</span>
          <h1 className="bt-h1">
            Five drivers.
            <span className="glow">No names.</span>
          </h1>
          <p className="bt-lede">
            Every sheet is somebody&rsquo;s real afternoon: where they started,
            what they did with it, how often they stopped, what the stewards
            made of them. Read the numbers and tell me who you are looking at.
          </p>
          <button className="bt-go" onClick={start}>
            Start the test <i aria-hidden>→</i>
          </button>
          <Link href={backTo} className="bt-back">
            back to the activities
          </Link>
        </div>
        <div className="bt-crowd" data-fx="right" aria-hidden>
          {[0, 1, 2, 3, 4].map((i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={GHOST} alt="" style={{ zIndex: 5 - i }} />
          ))}
        </div>
      </main>
    );
  }

  const done = at >= rounds.length;
  if (done)
    return (
      <main className="bt bt-cover bt-fx bt-done">
        <Speedlines n={6} />
        <div className="bt-done-run" aria-hidden>
          <Blur src={MOOD.pilot} className="mood-horse mood-pilot" />
        </div>
        <div className="bt-cover-copy">
          <span className="bt-eyebrow">Result</span>
          <div className="bt-score">
            {score}
            <small>/ {rounds.length}</small>
          </div>
          <p className="bt-lede">
            {score === rounds.length
              ? "Every one. You are reading the sheet better than most people read the race."
              : score >= rounds.length - 1
                ? "One away. You are reading the numbers, not guessing them."
                : score >= 2
                  ? "Halfway there. The stops and the climbs are the tell, more than the finishing position."
                  : "Rough one. Look at the stops first next time: they give away more than anything else on the sheet."}
          </p>
          <ul className="bt-recap">
            {rounds.map((r) => (
              <li key={r.answer} style={{ ["--team" as string]: teamTone(r.colour) }}>
                {r.headshot && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={bigPhoto(r.headshot)} alt="" />
                )}
                <b>{r.answer}</b>
                <em>{r.team}</em>
              </li>
            ))}
          </ul>
          <button className="bt-go" onClick={start}>
            Again, different drivers <i aria-hidden>→</i>
          </button>
          <Link href={backTo} className="bt-back">
            back to the activities
          </Link>
        </div>
      </main>
    );

  const round = rounds[at];
  const answered = pick !== null;
  const right = pick === round.answer;
  const tone = teamTone(round.colour);
  const face = round.headshot ? bigPhoto(round.headshot) : null;

  const next = () => {
    setAt((i) => i + 1);
    setPick(null);
  };

  const choose = (o: string) => {
    if (answered) return;
    if (o === round.answer) setScore((s) => s + 1);
    setPick(o);
  };

  return (
    <main className="bt" style={{ ["--team" as string]: tone }}>
      <div className="bt-stage">
        <aside className={`bt-subject${answered ? " lit" : ""}`}>
          <span className="bt-glow" aria-hidden />
          <span className="bt-stamp">
            {answered ? "Identified" : "Subject withheld"}
          </span>
          <figure className="bt-shot" key={at}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="bt-ghost" src={GHOST} alt="" aria-hidden />
            {answered && face && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="bt-face" src={face} alt={round.answer} />
            )}
            {!answered && (
              <span className="bt-mark" aria-hidden>
                ?
              </span>
            )}
          </figure>
          <div className="bt-plate">
            <span className="bt-num">
              {answered ? round.number : <i className="bt-bar" />}
            </span>
            <div>
              <b>{answered ? round.answer : <i className="bt-bar wide" />}</b>
              <em>{answered ? round.team : <i className="bt-bar mid" />}</em>
            </div>
          </div>
        </aside>

        <section className="bt-file">
          <header className="bt-strip">
            <span>
              Sheet {String(at + 1).padStart(2, "0")}
              <em> / {String(rounds.length).padStart(2, "0")}</em>
            </span>
            <span className="bt-dots" aria-hidden>
              {rounds.map((_, i) => (
                <i key={i} className={i < at ? "done" : i === at ? "on" : ""} />
              ))}
            </span>
            <span className="bt-tally">
              {score}
              <em> right</em>
            </span>
          </header>

          <h2 className="bt-q">Who is this?</h2>

          <dl className="bt-sheet">
            {round.rows.map(([k, v]) => (
              <div key={k}>
                <dt>
                  <Term label={k} />
                </dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>

          <ol className="bt-opts">
            {round.options.map((o, i) => (
              <li key={o}>
                <button
                  className={`bt-opt${pick === o ? " picked" : ""}${
                    answered ? (o === round.answer ? " right" : " wrong") : ""
                  }`}
                  disabled={answered}
                  onClick={() => choose(o)}
                >
                  <span className="bt-key">{LETTERS[i]}</span>
                  <b>{o}</b>
                </button>
              </li>
            ))}
          </ol>

          {answered && (
            <div className="bt-out">
              <div className={`bt-verdict${right ? " got" : ""}`}>
                {right ? "Got him" : `It was ${round.answer}`}
              </div>
              <p className="bt-tell">{round.tell}</p>
              <button className="bt-go bt-next" onClick={next}>
                {at + 1 === rounds.length ? "See how you did" : "Next driver"}{" "}
                <i aria-hidden>→</i>
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
