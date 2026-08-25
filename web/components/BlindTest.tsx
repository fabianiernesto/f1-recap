"use client";

import Link from "next/link";
import { useState } from "react";
import type { BlindRound, BlindTest as Test } from "@/lib/types";
import { soundAllowed, uiRight, uiWrong } from "@/lib/sfx";

/**
 * Five drivers with their names taken off.
 *
 * You are not really guessing names. You are learning to read a timing sheet,
 * which is the thing the sport never bothers to teach anybody: that three
 * stops means something went wrong, that a big climb is worth more than the
 * position it ended on, that a fast median lap and a bad result is a story.
 *
 * The pack holds more rounds than a run uses, and the five are drawn when you
 * press start, so a second run is a different test.
 */

const ROUNDS = 5;

function draw(all: BlindRound[]): BlindRound[] {
  const pool = [...all];
  const out: BlindRound[] = [];
  while (out.length < Math.min(ROUNDS, all.length) && pool.length)
    out.push(...pool.splice(Math.floor(Math.random() * pool.length), 1));
  return out;
}

export default function BlindTest({
  test,
  backTo,
}: {
  test: Test;
  backTo: string;
}) {
  const [rounds, setRounds] = useState<BlindRound[] | null>(null);
  const [at, setAt] = useState(0);
  const [pick, setPick] = useState<string | null>(null);
  const [score, setScore] = useState(0);

  const start = () => {
    setRounds(draw(test.rounds));
    setAt(0);
    setPick(null);
    setScore(0);
  };

  /* the draw happens on click, never during render: a run has to be the same
     on the server and in the browser until somebody asks for one */
  if (!rounds)
    return (
      <main className="blind">
        <div className="blind-intro">
          <span className="blind-eyebrow">The blind test · {test.session}</span>
          <h1>
            <span>Five drivers</span>
            <span>No names</span>
          </h1>
          <p>
            Every sheet is somebody&rsquo;s real afternoon: where they started,
            what they did with it, how often they stopped, what the stewards
            made of them. Read the numbers and tell me who you are looking at.
          </p>
          <button className="blind-go" onClick={start}>
            Start the test <i aria-hidden>→</i>
          </button>
          <Link href={backTo} className="blind-back">
            back to the race
          </Link>
        </div>
      </main>
    );

  const done = at >= rounds.length;
  if (done)
    return (
      <main className="blind">
        <div className="blind-intro">
          <span className="blind-eyebrow">Result</span>
          <div className="blind-score">
            {score}
            <small>/ {rounds.length}</small>
          </div>
          <p>
            {score === rounds.length
              ? "Every one. You are reading the sheet better than most people read the race."
              : score >= rounds.length - 1
                ? "One away. You are reading the numbers, not guessing them."
                : score >= 2
                  ? "Halfway there. The stops and the climbs are the tell, more than the finishing position."
                  : "Rough one. Look at the stops first next time: they give away more than anything else on the sheet."}
          </p>
          <button className="blind-go" onClick={start}>
            Again, different drivers <i aria-hidden>→</i>
          </button>
          <Link href={backTo} className="blind-back">
            back to the race
          </Link>
        </div>
      </main>
    );

  const round = rounds[at];
  const answered = pick !== null;
  const right = pick === round.answer;

  const next = () => {
    setAt((i) => i + 1);
    setPick(null);
  };

  const choose = (o: string) => {
    if (answered) return;
    const got = o === round.answer;
    setPick(o);
    if (got) setScore((s) => s + 1);
    // the result is worth more than a click, so it gets its own sound
    if (soundAllowed()) (got ? uiRight : uiWrong)();
  };

  return (
    <main className="blind">
      <div className="blind-run">
        <div className="blind-progress">
          <span>
            {String(at + 1).padStart(2, "0")} / {String(rounds.length).padStart(2, "0")}
          </span>
          <span>{score} right</span>
        </div>

        <h2 className="blind-q">Who is this?</h2>

        <dl className="blind-sheet">
          {round.rows.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>

        <div className="call-opts blind-opts" data-sfx="own">
          {round.options.map((o) => (
            <button
              key={o}
              className={`call-opt${pick === o ? " picked" : ""}${
                answered ? (o === round.answer ? " right" : " wrong") : ""
              }`}
              disabled={answered}
              onClick={() => choose(o)}
            >
              <b>{o}</b>
              {answered && o === round.answer && <em>That&rsquo;s him</em>}
            </button>
          ))}
        </div>

        {answered && (
          <div className="call-out">
            <div className={`call-verdict${right ? " agreed" : ""}`}>
              {right ? "Got him" : `It was ${round.answer}`}
            </div>
            <p className="call-reveal">{round.tell}</p>
            <button className="blind-go blind-next" onClick={next}>
              {at + 1 === rounds.length ? "See how you did" : "Next driver"}{" "}
              <i aria-hidden>→</i>
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
