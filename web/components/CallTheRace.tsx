"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RaceCall, Replay, Track } from "@/lib/types";
import ReplayTrack from "@/components/ReplayTrack";
import { hex, lapAt, leaderAt, revealAt, standings } from "@/lib/replay";
import { Speedlines } from "@/components/Mood";
import CardActions from "@/components/CardActions";
import type { CardInput } from "@/lib/shareCard";

/**
 * Call the race (activity 01, since 23/10/2026).
 *
 * The whole race plays back in about three minutes on the real track. At the
 * real turning points (pipeline/replay.py builds them from what happened) it
 * freezes and asks what happens next, with nothing on the screen that had
 * not happened yet. You give your answer 10, 25 or 50 points by how sure you are, and the race
 * runs on and answers you. Same race, same calls for everybody, so a score
 * means something in a group chat.
 */

const SURE = [
  { v: 10, k: "A hunch" },
  { v: 25, k: "Pretty sure" },
  { v: 50, k: "Certain" },
];
const RUN_SECONDS = 150;

type Pick = { id: string; stake: number };

// the data only offers "Somebody else" when that is the answer, which gives it
// away: every open "who" call carries it. The rest mends templated slips in the
// data until pipeline/replay.py is run again (a stop "costs 7s" is not a real figure).
const OPEN_CALLS = new Set(["start", "neutral", "half", "finish", "third"]);
function tidyCall(c: RaceCall, r: Replay): RaceCall {
  const options = c.options.filter((o) => o.id !== "other").map((o) => ({ ...o, sub: o.sub?.replace(/ · \+-[\d.]+s/, "") }));
  if (OPEN_CALLS.has(c.kind)) options.push({ id: "other", label: "Somebody else", sub: "From further back" });
  const ctx = c.ctx.replace(/\b1 laps old/g, "1 lap old").replace(/ A stop costs \ds here, measured off this race\./, "");
  // who wins is the official winner: the feed can tie two cars at the line (Baku, 0.196s apart)
  const won = c.kind === "finish" ? r.field.find((f) => f.finish === 1) : null;
  if (won) return { ...c, options, ctx, answer: options.some((o) => o.id === String(won.num)) ? String(won.num) : "other", why: `${won.name} wins it.` };
  return { ...c, options, ctx };
}

function verdict(right: number, n: number, score: number) {
  const r = n ? right / n : 0;
  if (r === 1) return { t: "Race director", l: "Every call. You saw this race coming." };
  // a wrong call costs what you gave it, so a good count can still end below zero: no praise for that
  if (score < 0 && r >= 0.5) return { t: "Too sure", l: "You got plenty right and still went backwards. Certain costs a lot when the race disagrees." };
  if (r >= 0.75) return { t: "Strategist", l: "You read the race before it happened, most of the time." };
  if (r >= 0.5) return { t: "Paddock regular", l: "Half of it went your way. The other half is why people watch." };
  if (r >= 0.25) return { t: "Grandstand", l: "The race had other ideas. That is the fun of it." };
  return { t: "Sofa", l: "This race fooled you. It fooled a few pit walls too." };
}

export default function CallTheRace({
  r, track, gp, slug, session, exchangeHref, storyHref,
}: {
  r: Replay; track: Track; gp: string; slug: string; session: string; exchangeHref: string | null; storyHref: string;
}) {
  const calls = useMemo(() => r.calls.map((c) => tidyCall(c, r)), [r]);
  const key =`rs-call-${slug}-${session}`;
  const byNum = useMemo(() => new Map(r.field.map((c) => [String(c.num), c])), [r.field]);
  const end = useMemo(() => leaderAt(r, r.laps) + 6, [r]);
  const speed = end / RUN_SECONDS;
  // when each answer shows, never later than the flag. A retirement waits for its car even
  // on data with no `cars` yet: a lapped car stops long after the leader's lap of that number
  const reveals = useMemo(() => calls.map((c) => Math.min(end, revealAt(r, c.kind === "retire" && !c.cars ? { ...c, cars: [Number(c.answer)] } : c))), [calls, r, end]);

  const tRef = useRef(0);
  const [phase, setPhase] = useState<"cover" | "run" | "call" | "done">("cover");
  const [at, setAt] = useState(0); // the next call to ask
  const [picks, setPicks] = useState<(Pick | null)[]>(() => calls.map(() => null));
  const [draft, setDraft] = useState<Pick>({ id: "", stake: 25 });
  const [shown, setShown] = useState<boolean[]>(() => calls.map(() => false));
  // answers wait their turn: several can land on one frame, most of all at the flag
  const [queue, setQueue] = useState<number[]>([]);
  const queueRef = useRef(queue);
  queueRef.current = queue;
  const toast = queue[0] ?? null;
  const [atFlag, setAtFlag] = useState(false);
  const [, setTick] = useState(0);
  const picksRef = useRef(picks);
  picksRef.current = picks;

  // a finished game is kept in this browser; storage may be blocked
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || "null");
      if (Array.isArray(saved) && saved.length === calls.length) {
        setPicks(saved);
        setShown(calls.map(() => true));
        tRef.current = end;
        setPhase("done");
      }
    } catch {}
  }, [key, calls, end]);

  // the clock: runs while racing, stops at the next call
  useEffect(() => {
    if (phase !== "run" || atFlag) return;
    let raf = 0, last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const nextCall = calls[at];
      const freezeAt = nextCall ? leaderAt(r, nextCall.lap) : Infinity;
      const t = Math.min(freezeAt, tRef.current + dt * speed);
      tRef.current = t;
      // answers arrive when the race reaches them
      calls.forEach((_, i) => {
        if (!shown[i] && !queueRef.current.includes(i) && picksRef.current[i] && t >= reveals[i]) {
          setShown((s) => s.map((v, j) => (j === i ? true : v)));
          queueRef.current = [...queueRef.current, i];
          setQueue(queueRef.current);
        }
      });
      if (t >= freezeAt && !queueRef.current.length) {
        // the next question waits until the last answer has been read
        setDraft({ id: "", stake: 25 });
        setPhase("call");
        return;
      }
      if (t >= end) {
        tRef.current = end;
        setAtFlag(true);
        return;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [phase, atFlag, at, calls, reveals, r, speed, end, shown]);

  // the flag: the result page waits for the last answer
  useEffect(() => {
    if (!atFlag || phase !== "run" || queue.length) return;
    const id = setTimeout(() => {
      setAtFlag(false);
      setPhase("done");
      try { localStorage.setItem(key, JSON.stringify(picksRef.current)); } catch {}
    }, 500);
    return () => clearTimeout(id);
  }, [atFlag, phase, queue.length, key]);

  // the readouts refresh ten times a second, not every frame
  useEffect(() => {
    if (phase === "cover") return;
    const id = setInterval(() => setTick((n) => n + 1), 100);
    return () => clearInterval(id);
  }, [phase]);
  // one answer at a time, and the clock on it stops during a question
  const waiting = queue.length > 1 || atFlag;
  useEffect(() => {
    if (toast === null || phase !== "run") return;
    const id = setTimeout(() => setQueue((q) => q.slice(1)), waiting ? 2400 : 4200);
    return () => clearTimeout(id);
  }, [toast, phase, waiting]);

  const [closing, setClosing] = useState(false);
  const lock = () => {
    if (!draft.id || closing) return; // a double tap cannot skip the next call
    // the sheet goes down with the answer on it, then the race runs on
    setClosing(true);
    setTimeout(() => {
      setPicks((p) => p.map((v, i) => (i === at ? draft : v)));
      setAt(at + 1);
      setPhase("run");
      setClosing(false);
    }, 280);
  };
  const skip = useCallback(() => {
    // to just before the next moment, or the flag
    const nextCall = calls[at];
    const target = nextCall ? leaderAt(r, nextCall.lap) - speed * 1.2 : end - speed * 1.5;
    if (target > tRef.current) tRef.current = target;
  }, [calls, at, r, speed, end]);
  const restart = () => {
    try { localStorage.removeItem(key); } catch {}
    tRef.current = 0;
    setAt(0);
    setPicks(calls.map(() => null));
    setShown(calls.map(() => false));
    setQueue([]);
    setAtFlag(false);
    setPhase("run");
    scrollTo(0, 0);
  };

  const t = tRef.current;
  // during a call the lap is the one the question is about, also while the race waits for it behind an answer
  const asked = calls[at] && (phase === "call" || (phase === "run" && t >= leaderAt(r, calls[at].lap)));
  const lap = phase === "cover" ? 0 : asked ? Math.max(1, calls[at].lap) : lapAt(r, t);
  // a call asked under a safety car shows the flag it was asked under
  const flag = phase === "call" && calls[at]?.flag
    ? { kind: calls[at].flag as "SC" | "VSC" }
    : r.neutral.find((n) => lap >= n.from && lap <= n.to);
  // during a call the tower is the order at the end of that lap, the one the options quote
  const rows = phase === "cover" ? [] : phase === "call" && calls[at]?.lap ? standings(r, Infinity, calls[at].towerLap ?? calls[at].lap) : standings(r, t);
  const results = calls.map((c, i) => {
    const p = picks[i];
    return { c, p, right: !!p && p.id === c.answer, open: !!p && shown[i] };
  });
  // right wins the points you gave it, wrong loses them
  const score = results.reduce((s, x) => s + (x.open ? (x.right ? x.p!.stake : -x.p!.stake) : 0), 0);
  const points = score < 0 ? `−${-score}` : String(score);
  const right = results.filter((x) => x.right).length;
  const call = calls[at];
  const focus = phase === "call" && call
    ? call.options.map((o) => Number(o.id)).filter((n) => byNum.has(String(n)))
    : rows.slice(0, 3).map((x) => x.car.num);

  const shareText = `Racing Simplified · ${gp} · Call the race\n${right}/${calls.length} called · ${points} points\n`
    + results.map((x) => (x.right ? "🟩" : "🟥")).join("")
    + `\nSame race, same calls. Beat me:`;
  const card: CardInput = {
    kicker: "Activity 01 // Call the race", gp: `${gp} · ${session === "sprint" ? "Sprint" : "Race"}`,
    title: ["Call", "the race"], big: points, bigLabel: `points · ${right} of ${calls.length} calls right`,
    verdict: verdict(right, calls.length, score).t, marks: results.map((x) => (x.right ? "hit" : "miss")),
    foot: "Same race, same calls. Beat that.",
  };

  /* ---------- the cover */
  if (phase === "cover")
    return (
      <main className="cr cr-cover">
        <Speedlines n={6} />
        <div className="cr-cover-track"><ReplayTrack r={r} track={track} tRef={tRef} /></div>
        <div className="cr-cover-copy">
          <span className="cr-eyebrow">Activity 01 <em>//</em> {gp} · {session === "sprint" ? "Sprint" : "Race"}</span>
          <h1 className="cr-h1">Call<span className="glow">the race</span></h1>
          <ol className="cr-how">
            <li><b>01</b><span>The whole race plays back in three minutes, every car where the timing put it.</span></li>
            <li><b>02</b><span>When it turns, it stops and asks you what happens next. Nothing after that moment is shown.</span></li>
            <li><b>03</b><span>Give your answer 10, 25 or 50 points, by how sure you are. The race answers: right wins them, wrong loses them.</span></li>
          </ol>
          <div className="cr-stats">
            <div><span>Laps</span><b>{r.laps}</b></div>
            <div><span>Calls</span><b>{calls.length}</b></div>
            <div><span>Time</span><b>3&rsquo;</b></div>
          </div>
          <button className="bt-go" onClick={() => setPhase("run")}>Lights out <i aria-hidden>→</i></button>
        </div>
      </main>
    );

  /* ---------- the flag */
  if (phase === "done") {
    const v = verdict(right, calls.length, score);
    return (
      <main className="cr cr-done">
        <Speedlines n={5} />
        <section className="cr-final">
          <span className="cr-eyebrow">Chequered flag <em>//</em> {gp}</span>
          <div className="cr-score">{points}<small>points</small></div>
          <span className="cr-right">{right} of {calls.length} calls right</span>
          <h2 className="cr-verdict">{v.t}</h2>
          <p className="cr-line">{v.l}</p>
          <div className="cr-marks" aria-hidden>{results.map((x, i) => <i key={i} className={x.right ? "hit" : "miss"} />)}</div>
          <div className="cr-share">
            <CardActions card={card} text={shareText} name={`call-the-race-${slug}.png`} />
            <span>Same race and the same calls for whoever opens it. The card names no result.</span>
          </div>
        </section>
        <section className="cr-review">
          <h3>Your calls</h3>
          <ol>
            {results.map(({ c, p, right: ok }, i) => {
              const yours = c.options.find((o) => o.id === p?.id);
              const real = c.options.find((o) => o.id === c.answer);
              return (
                <li key={i} className={ok ? "is-hit" : "is-miss"}>
                  <span className="cr-rv-k">{c.lap ? `Lap ${c.lap}` : "The start"} · {ok ? `+${p?.stake}` : p ? `−${p.stake}` : "0"}</span>
                  <b>{c.q}</b>
                  <span className="cr-rv-a">
                    You: {yours?.label ?? "no call"} {ok ? "" : `· It was ${real?.label}`}
                  </span>
                  <p>{c.why}</p>
                </li>
              );
            })}
          </ol>
          <nav className="cr-next">
            <button className="myst-door" onClick={restart}><span>Again</span><b>Replay this race</b><i aria-hidden>→</i></button>
            {exchangeHref && <Link href={exchangeHref} className="myst-door"><span>Activity 02</span><b>Paddock exchange: trade this race</b><i aria-hidden>→</i></Link>}
            <Link href={storyHref} className="myst-door"><span>Read it</span><b>Every moment, in order</b><i aria-hidden>→</i></Link>
          </nav>
        </section>
      </main>
    );
  }

  /* ---------- the race, and the calls */
  const toastCall = toast !== null ? results[toast] : null;
  return (
    <main className={`cr cr-game${phase === "call" ? " is-call" : ""}`}>
      <header className="cr-hud">
        <div className="cr-lap"><span>Lap</span><b>{lap}<small> / {r.laps}</small></b></div>
        <div className="cr-pts"><span>Your points</span><b>{points}</b></div>
      </header>
      <div className="cr-timeline" aria-hidden>
        <i className="cr-tl-done" style={{ width: `${Math.min(100, (t / end) * 100)}%` }} />
        {results.map((x, i) => (
          <i key={i} className={`cr-tl-mark${x.open ? (x.right ? " hit" : " miss") : x.p ? " set" : i === at ? " next" : ""}`}
            style={{ left: `${(leaderAt(r, x.c.lap) / end) * 100}%` }} />
        ))}
      </div>
      <div className="cr-stage">
        {flag && <div className={`cr-flag ${flag.kind === "SC" ? "sc" : "vsc"}`}><span>{flag.kind === "SC" ? "Safety car" : "Virtual safety car"}</span></div>}
        <ReplayTrack r={r} track={track} tRef={tRef} focus={focus} dim={phase === "call"} />
      </div>

      <ol className="cr-tower" aria-label="Running order">
        {rows.slice(0, 8).map((x) => (
          <li key={x.car.num} className={focus.includes(x.car.num) ? "is-focus" : ""}>
            <span className="cr-tw-p">{x.pos}</span>
            <i style={{ background: hex(x.car.colour) }} />
            <b>{x.car.code}</b>
            <em>{x.pos === 1 ? "Leader" : x.gap > r.lapTime ? `+${Math.floor(x.gap / r.lapTime)}L` : `+${x.gap.toFixed(1)}`}</em>
          </li>
        ))}
      </ol>

      {phase === "run" && (
        <button className="cr-skip" onClick={atFlag ? () => setQueue([]) : skip}>{atFlag ? "See the result" : calls[at] ? ((calls[at].lap || 1) > lap ? `To the next call · lap ${calls[at].lap || 1}` : "To the next call") : "To the flag"} <i aria-hidden>→</i></button>
      )}

      {toastCall && phase === "run" && (
        <div className={`cr-toast${toastCall.right ? " hit" : " miss"}`} role="status">
          <b>Call {toast! + 1} · {toastCall.right ? `Called it · +${toastCall.p?.stake}` : `Not this time · −${toastCall.p?.stake}`}</b>
          <p>{toastCall.c.why}</p>
        </div>
      )}

      {phase === "call" && call && (
        <section className={`cr-sheet${closing ? " is-closing" : ""}`} role="dialog" aria-label="Your call">
          <span className="cr-sheet-k">Call {at + 1} of {calls.length} · {call.lap ? `lap ${call.lap}` : "the start"}{call.flag ? ` · ${call.flag === "SC" ? "safety car" : "virtual safety car"}` : ""}</span>
          <h2 className="cr-q">{call.q}</h2>
          <p className="cr-ctx">{call.ctx}</p>
          <div className="cr-opts">
            {call.options.map((o) => {
              const car = byNum.get(o.id);
              return (
                <button key={o.id} className={`cr-opt${draft.id === o.id ? " is-sel" : ""}${car?.photo ? "" : " is-plain"}`}
                  style={{ ["--tc" as string]: car ? hex(car.colour) : "#555" }}
                  onClick={() => setDraft((d) => ({ ...d, id: o.id }))}>
                  {car?.photo && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={car.photo} alt="" decoding="async" />
                  )}
                  <b>{o.label}{o.sub && <small>{o.sub}</small>}</b>
                </button>
              );
            })}
          </div>
          <div className="cr-stake" role="radiogroup" aria-label="How sure are you">
            {SURE.map((s) => (
              <button key={s.v} role="radio" aria-checked={draft.stake === s.v} className={draft.stake === s.v ? "is-sel" : ""}
                onClick={() => setDraft((d) => ({ ...d, stake: s.v }))}>
                <b>{s.v}</b><span>{s.k}</span>
              </button>
            ))}
          </div>
          <button className="bt-go cr-lock" disabled={!draft.id} onClick={lock}>
            {closing ? "Locked" : draft.id ? "Lock the call" : "Pick one first"} <i aria-hidden>→</i>
          </button>
        </section>
      )}
    </main>
  );
}
