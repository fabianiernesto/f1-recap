"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { GhostRace, GhostSeat, GhostWindow, Replay, Track } from "@/lib/types";
import ReplayTrack from "@/components/ReplayTrack";
import { hex, standings } from "@/lib/replay";
import { Speedlines } from "@/components/Mood";
import { drawCard, saveCard, shareCard } from "@/lib/shareCard";

/**
 * The ghost, live (activity 02, rebuilt 24/10/2026).
 *
 * The race never stops. You pick a driver and it plays on the real track;
 * when his pit window opens the replay drops into slow motion and a BOX
 * button is yours. Call it when you see it: the tyre is fading in front of
 * you, the cars ahead and behind are moving, and your ghost (white) dives
 * into the pit lane the moment you press while the real driver stays out, or
 * the other way round. Miss the window and the garage calls it for you on
 * its last lap.
 *
 * Every lap of every window is priced in pipeline/muro.py the way the pit
 * wall prices its options: this race's own tyre wear and stop cost, over the
 * laps the stop touches and no further, and only the windows where the model
 * agrees with the real strategist within three seconds. The other cars run
 * exactly as they did. A safety car after your calls bunches the field: the
 * ghost keeps the order it was caught in, not the seconds.
 */

const RUN_SECONDS = 110;
// an open window lasts about this long on screen, however many laps it spans
const WINDOW_SECONDS = 22;
const RAMP = 4;
const CC: Record<string, string> = { SOFT: "#e10600", MEDIUM: "#ffd12e", HARD: "#f2f2f2", INTERMEDIATE: "#2fd06a", WET: "#2f7bff" };

function secs(v: number) {
  if (Math.abs(v) < 0.05) return "level";
  return `${v > 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}s`;
}

type Box = { lap: number; auto: boolean };

export default function TheGhost({
  r, race, track, gp, slug, callHref, storyHref,
}: {
  r: Replay; race: GhostRace; track: Track; gp: string; slug: string; callHref: string | null; storyHref: string;
}) {
  const seats = useMemo(() => race.seats.filter((s) => (s.windows ?? []).length > 0), [race.seats]);
  const [seatIdx, setSeatIdx] = useState<number | null>(null);
  const [phase, setPhase] = useState<"pick" | "run" | "done">("pick");
  const [boxes, setBoxes] = useState<(Box | null)[]>([]);
  const [flash, setFlash] = useState<{ i: number; until: number } | null>(null);
  const [, setTick] = useState(0);
  const [copied, setCopied] = useState(false);
  const tRef = useRef(0);
  const shiftRef = useRef(0);
  const boxesRef = useRef<(Box | null)[]>([]);
  boxesRef.current = boxes;

  const seat: GhostSeat | null = seatIdx != null ? seats[seatIdx] : null;
  const car = useMemo(() => (seat ? r.field.find((c) => c.num === seat.number) ?? null : null), [seat, r.field]);
  const W: GhostWindow[] = seat?.windows ?? [];
  const end = car ? car.cross[car.cross.length - 1] + 4 : 0;
  const speed = end / RUN_SECONDS;
  const loss = race.economics.pitLoss;

  /** his lap at time t (the one he is running) */
  const lapOf = (t: number) => {
    if (!car) return 0;
    let l = 0;
    while (l < car.cross.length - 1 && car.cross[l + 1] <= t) l++;
    return l + 1;
  };
  /** how far through that lap he is, 0..1 */
  const fracOf = (t: number) => {
    if (!car) return 0;
    const l = lapOf(t) - 1;
    const a = car.cross[l], b = car.cross[Math.min(l + 1, car.cross.length - 1)];
    return b > a ? Math.min(1, Math.max(0, (t - a) / (b - a))) : 0;
  };

  /**
   * The ghost against the real driver, in seconds, at a point in his race:
   * the priced difference of every stop you called, landing over a few laps,
   * plus the stop itself while only one of the two has made it (you boxed
   * early: you are a stop behind until he boxes too, and the other way round).
   */
  const shiftAt = (lapF: number, list: (Box | null)[] = boxesRef.current) =>
    W.reduce((sum, w, i) => {
      const b = list[i];
      if (!b) return sum;
      const d = w.laps[String(b.lap)]?.d ?? 0;
      const from = Math.min(b.lap, w.stop);
      sum += d * Math.max(0, Math.min(1, (lapF - from) / RAMP));
      const ramp = (x: number) => Math.max(0, Math.min(1, lapF - x));
      if (b.lap < w.stop) sum += loss * (ramp(b.lap) - ramp(w.stop));
      if (b.lap > w.stop) sum -= loss * (ramp(w.stop) - ramp(b.lap));
      return sum;
    }, 0);

  const start = (i: number) => {
    setSeatIdx(i);
    setBoxes(seats[i].windows!.map(() => null));
    tRef.current = 0;
    shiftRef.current = 0;
    setFlash(null);
    setPhase("run");
  };

  // the clock: normal speed, slow motion while a window is open and uncalled
  useEffect(() => {
    if (phase !== "run" || !car) return;
    let raf = 0, last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const lap = lapOf(tRef.current);
      const open = W.findIndex((w, i) => !boxesRef.current[i] && lap >= w.lo && lap <= w.hi);
      let v = speed;
      if (open >= 0) {
        const w = W[open];
        const span = car.cross[Math.min(w.hi, car.cross.length - 1)] - car.cross[Math.max(0, w.lo - 1)];
        v = Math.min(speed * 0.6, span / WINDOW_SECONDS);
      }
      tRef.current += dt * v;
      const lapNow = lapOf(tRef.current);
      // a window that shut uncalled: the garage calls it on its last lap
      W.forEach((w, i) => {
        if (!boxesRef.current[i] && lapNow > w.hi) {
          const next = boxesRef.current.map((b, j) => (j === i ? { lap: w.hi, auto: true } : b));
          boxesRef.current = next;
          setBoxes(next);
          setFlash({ i, until: performance.now() + 3600 });
        }
      });
      shiftRef.current = shiftAt(lapNow - 1 + fracOf(tRef.current));
      if (tRef.current >= end) { setPhase("done"); return; }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, car, W, speed, end]);

  useEffect(() => {
    if (phase !== "run") return;
    const id = setInterval(() => setTick((n) => n + 1), 100);
    return () => clearInterval(id);
  }, [phase]);

  const box = () => {
    const lap = lapOf(tRef.current);
    const i = W.findIndex((w, j) => !boxesRef.current[j] && lap >= w.lo && lap <= w.hi);
    if (i < 0) return;
    const next = boxesRef.current.map((b, j) => (j === i ? { lap, auto: false } : b));
    boxesRef.current = next;
    setBoxes(next);
    setFlash({ i, until: performance.now() + 3600 });
  };
  // the space bar is the radio button on a keyboard
  useEffect(() => {
    if (phase !== "run") return;
    const k = (e: KeyboardEvent) => { if (e.code === "Space") { e.preventDefault(); box(); } };
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, W]);

  const share = async (text: string, blob: Blob | null = null) => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const res = await shareCard(blob, text, url);
    if (res === "copied") { setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };

  /* ---------- pick a driver */
  if (phase === "pick" || !seat || !car)
    return (
      <main className="gh gh-pick">
        <Speedlines n={6} />
        <header className="gh-head">
          <span className="cr-eyebrow">Activity 02 <em>//</em> {gp} · Race</span>
          <h1 className="cr-h1">The<span className="glow">ghost</span></h1>
          <ol className="cr-how">
            <li><b>01</b><span>Pick a driver. The race runs on the real track and never stops.</span></li>
            <li><b>02</b><span>When his pit window opens it drops into slow motion and the BOX button is yours. Call it when you see it.</span></li>
            <li><b>03</b><span>Your ghost dives into the pits when you say, and races him and the real field to the flag.</span></li>
          </ol>
        </header>
        <section className="gh-seats">
          <span className="gh-seats-k">{seats.length} drivers whose stops can be priced from this race</span>
          <div className="gh-grid">
            {seats.map((s, i) => (
              <button key={s.number} className="gh-seat" style={{ ["--tc" as string]: hex(s.colour) }} onClick={() => start(i)}>
                {s.headshot && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.headshot.replace("w_1000", "w_420")} alt="" loading="lazy" decoding="async" />
                )}
                <span className="gh-seat-n">{s.number}</span>
                <b>{s.name}</b>
                <span className="gh-seat-k">P{s.finish} · {s.windows!.length} window{s.windows!.length === 1 ? "" : "s"} to call</span>
              </button>
            ))}
          </div>
        </section>
      </main>
    );

  const t = tRef.current;
  const lap = Math.min(r.laps, lapOf(t));
  const tc = hex(seat.colour);
  const total = shiftAt(r.laps + RAMP + 2);
  const lapF = lap - 1 + fracOf(t);
  const nowDelta = phase === "done" ? total : shiftAt(lapF) - W.reduce((s2, w, i) => {
    // the live readout shows the priced gain, not the stop in flight
    const b = boxes[i];
    if (!b) return s2;
    const ramp = (x: number) => Math.max(0, Math.min(1, lapF - x));
    if (b.lap < w.stop) return s2 + loss * (ramp(b.lap) - ramp(w.stop));
    if (b.lap > w.stop) return s2 - loss * (ramp(w.stop) - ramp(b.lap));
    return s2;
  }, 0);

  /* ---------- the flag */
  if (phase === "done") {
    const realGap = race.ladder.find((x) => x.pos === seat.finish)?.gap ?? 0;
    const others = race.ladder.filter((x) => x.pos !== seat.finish);
    const firstCall = Math.min(...W.map((w) => w.lo));
    const sc = r.neutral.filter((n) => n.kind === "SC" && n.from > firstCall && n.from < r.laps).map((n) => n.from).pop();
    let ghostGap = realGap + total;
    let scNote = "";
    if (sc && car.cross[sc] != null) {
      const before = shiftAt(sc);
      const after = total - before;
      const gT = car.cross[sc] + before;
      const rivals = r.field.filter((c) => c.num !== car.num && c.cross[sc] != null);
      const shift = rivals.filter((c) => c.cross[sc] < gT).length - rivals.filter((c) => c.cross[sc] < car.cross[sc]).length;
      const rowAt = (pos: number) => race.ladder.find((x) => x.pos === pos)?.gap;
      ghostGap = shift === 0 ? realGap + after : (rowAt(seat.finish + shift) ?? realGap + before) + (shift > 0 ? 0.001 : -0.001) + after;
      scNote = `The safety car on lap ${sc} bunched the field: ${Math.abs(before) >= 0.05 ? `the ${secs(before)} before it was wiped, ` : ""}the order it caught you in was not.`;
    }
    const eff = ghostGap - realGap;
    const place = 1 + others.filter((x) => x.gap < ghostGap).length;
    const moved = seat.finish - place;
    const rows = [...others.map((x) => ({ name: x.name, gap: x.gap, you: false })), { name: "Your ghost", gap: ghostGap, you: true }]
      .sort((a, b) => a.gap - b.gap).map((x, i) => ({ ...x, pos: i + 1 }));
    const mine = rows.find((x) => x.you)!;
    const near = rows.filter((x) => Math.abs(x.pos - mine.pos) <= 3);
    const sameAll = boxes.every((b, i) => !b || b.lap === W[i].stop);
    const title = sameAll ? "The pit wall" : moved > 0 ? "Sharp strategist" : eff < -0.05 ? "Quicker, same place" : moved < 0 ? "Back to the garage" : eff > 0.05 ? "Close, but slower" : "Level with the wall";
    const line = sameAll ? `Every stop on the same lap as ${seat.name}'s garage. They knew what they were doing.`
      : moved > 0 ? `${secs(eff)} on his real race, and ${moved} place${moved > 1 ? "s" : ""} up.`
      : moved < 0 ? `${secs(eff)} on his real race, and ${-moved} place${moved < -1 ? "s" : ""} down. The wall had it right.`
      : `${secs(eff)} on his real race, and the same place at the flag.`;
    // your stints: his, with the stops moved to where you called them
    const his = seat.stints ?? [];
    const yours = his.map((st) => [...st] as [string | null, number, number | null]);
    W.forEach((w, i) => {
      const b = boxes[i];
      if (!b) return;
      const k = yours.findIndex((st) => st[2] === w.stop);
      if (k >= 0 && yours[k + 1]) { yours[k][2] = b.lap; yours[k + 1][1] = b.lap + 1; }
    });
    const Bar = ({ st }: { st: [string | null, number, number | null][] }) => (
      <span className="gh-bar">
        {st.map(([c, a, b], i) => (
          <i key={i} style={{ width: `${(((b ?? r.laps) - a + 1) / r.laps) * 100}%`, background: CC[c ?? ""] ?? "#666" }} />
        ))}
      </span>
    );
    const ghostCard = () => drawCard({
      kicker: "Activity 02 // The ghost", gp: `${gp} · Race`, title: ["The", "ghost"],
      big: moved > 0 ? `+${moved}` : moved < 0 ? `${moved}` : "=", bigLabel: `places on his real race · ${secs(eff)}`,
      verdict: title,
      marks: W.map((w, i) => ((w.laps[String(boxes[i]?.lap)]?.d ?? 0) <= 0 ? "hit" : "miss")),
      foot: `I called ${seat.name}'s stops live. Call yours.`,
    });
    return (
      <main className="gh gh-done" style={{ ["--team" as string]: tc }}>
        <Speedlines n={5} />
        <section className="cr-final">
          <span className="cr-eyebrow">{seat.name} <em>//</em> {gp}</span>
          <div className={`cr-score gh-place${moved > 0 ? " up" : moved < 0 ? " down" : ""}`}>P{place}<small>your ghost at the flag · he was P{seat.finish}</small></div>
          <h2 className="cr-verdict">{title}</h2>
          <p className="cr-line">{line[0].toUpperCase() + line.slice(1)}</p>
          {scNote && <p className="gh-scnote">{scNote}</p>}
          <div className="gh-strat">
            <span className="gh-strat-k">Your race against his</span>
            <div><b>You</b><Bar st={yours} /><em>{boxes.map((b) => b?.lap).join(" · ")}</em></div>
            <div><b style={{ color: tc }}>{seat.name}</b><Bar st={his} /><em>{W.map((w) => w.stop).join(" · ")}</em></div>
          </div>
          <div className="cr-share">
            <button className="bt-go" onClick={async () => share(`Racing Simplified · ${gp} · The ghost\nI called ${seat.name}'s stops live: ${moved > 0 ? `${moved} place${moved > 1 ? "s" : ""} up` : moved < 0 ? `${-moved} place${moved < -1 ? "s" : ""} down` : "the same place"}, ${secs(eff)}.\nYour turn:`, await ghostCard().catch(() => null))}>
              {copied ? "Link copied" : "Share your race"} <i aria-hidden>→</i></button>
            <button className="myst-link" onClick={async () => saveCard(await ghostCard().catch(() => null), `the-ghost-${slug}.png`)}>Save the card for Stories</button>
          </div>
        </section>
        <section className="cr-review">
          <h3>At the flag</h3>
          <ol className="gh-ladder">
            {near.map((x) => (
              <li key={x.name} className={x.you ? "is-you" : ""}>
                <span>{x.pos}</span><b>{x.name}</b><em>{x.gap === 0 ? "Winner" : `+${x.gap.toFixed(3)}`}</em>
              </li>
            ))}
          </ol>
          <h3 className="gh-h3b">Your stops</h3>
          <ol>
            {W.map((w, i) => {
              const b = boxes[i];
              const e = b ? w.laps[String(b.lap)] : undefined;
              const d = e?.d ?? 0;
              return (
                <li key={i} className={d <= 0 ? "is-hit" : "is-miss"}>
                  <span className="cr-rv-k">Stop {i + 1} · {w.comp.toLowerCase()} to {w.next.toLowerCase()} · {secs(d)}</span>
                  <b>You boxed on lap {b?.lap}{b?.auto ? " (the window shut: the garage called it)" : ""}. He boxed on lap {w.stop}.</b>
                  {e?.rejoin && <span className="cr-rv-a">Out in P{e.rejoin.pos}{e.rejoin.ahead ? `, ${e.rejoin.ahead[1].toFixed(1)}s behind ${e.rejoin.ahead[0]}` : ""}</span>}
                </li>
              );
            })}
          </ol>
          <nav className="cr-next">
            <button className="myst-door" onClick={() => { setPhase("pick"); setSeatIdx(null); }}><span>Again</span><b>Take another driver</b><i aria-hidden>→</i></button>
            {callHref && <Link href={callHref} className="myst-door"><span>Activity 01</span><b>Call the race</b><i aria-hidden>→</i></Link>}
            <Link href={storyHref} className="myst-door"><span>Read it</span><b>Every moment, in order</b><i aria-hidden>→</i></Link>
          </nav>
          <p className="gh-fine">An estimate from this race&rsquo;s lap times, its {loss}s stop and the tyre wear measured in it. The other cars run exactly as they did.</p>
        </section>
      </main>
    );
  }

  /* ---------- the race, live */
  const openI = W.findIndex((w, i) => !boxes[i] && lap >= w.lo && lap <= w.hi);
  const open = openI >= 0 ? W[openI] : null;
  const nextI = W.findIndex((w, i) => !boxes[i] && lap < w.lo);
  // the set he is on now, as far as your ghost is concerned
  const lastBox = W.map((w, i) => ({ w, b: boxes[i] })).filter((x) => x.b && x.b.lap < lap).pop();
  const stintFrom = lastBox ? lastBox.b!.lap + 1 : (W[0]?.from ?? 1);
  const comp = lastBox ? lastBox.w.next : (W[0]?.comp ?? "MEDIUM");
  const age = Math.max(0, lap - stintFrom);
  const deg = (lastBox ? (W.find((w) => w.comp === comp)?.deg) : W[0]?.deg) ?? 0.05;
  const lossLap = deg * age;
  const rows = standings(r, t);
  const me = rows.find((x) => x.car.num === car.num);
  const ahead = me && me.pos > 1 ? rows[me.pos - 2] : null;
  const behind = me ? rows[me.pos] : null;
  const fl = flash && flash.until > performance.now() ? flash : null;
  const fw = fl ? W[fl.i] : null;
  const fb = fl ? boxes[fl.i] : null;
  const fe = fw && fb ? fw.laps[String(fb.lap)] : undefined;
  const pct = (l: number) => `${((l - 1) / Math.max(1, r.laps - 1)) * 100}%`;

  return (
    <main className={`cr cr-game gh-game gh-live${open ? " is-window" : ""}`} style={{ ["--team" as string]: tc }}>
      <header className="cr-hud">
        <div className="cr-lap"><span>Lap</span><b>{lap}<small> / {r.laps}</small></b></div>
        <div className="cr-pts"><span>You vs the real {seat.name}</span><b className={nowDelta < -0.05 ? "good" : nowDelta > 0.05 ? "bad" : ""}>{secs(nowDelta)}</b></div>
      </header>
      <div className="gh-windows" aria-label="His pit windows">
        <div className="gh-lane">
          {W.map((w, i) => (
            <span key={i} className={`gh-open${boxes[i] ? " is-done" : i === openI ? " is-now" : ""}`} style={{ left: pct(w.lo), width: `calc(${pct(w.hi)} - ${pct(w.lo)})` }} />
          ))}
          {W.map((w, i) => boxes[i] && <span key={`y${i}`} className="gh-you" style={{ left: pct(boxes[i]!.lap) }} />)}
          {W.map((w, i) => boxes[i] && <span key={`h${i}`} className="gh-his" style={{ left: pct(w.stop), background: tc }} />)}
          <span className="gh-now" style={{ left: pct(lap) }} />
        </div>
        <div className="gh-lane-k">
          <span>{open ? `Pit window open · closes lap ${open.hi}` : nextI >= 0 ? `Next window · laps ${W[nextI].lo} to ${W[nextI].hi}` : "All stops called"}</span>
          <span>{r.laps}</span>
        </div>
      </div>
      {open && <span className="gh-slowmo">Slow motion · the window is open</span>}
      <div className="cr-stage">
        <ReplayTrack r={r} track={track} tRef={tRef} focus={[car.num, ...(ahead ? [ahead.car.num] : []), ...(behind ? [behind.car.num] : [])]}
          ghost={{ num: car.num, shiftRef }} />
      </div>
      <div className="gh-side">
        <div className="gh-gaps">
          <div><span>Ahead</span><b>{ahead ? `${ahead.car.code} ${me ? Math.abs(me.gap - ahead.gap).toFixed(1) : "-"}s` : "Leading"}</b></div>
          <div><span>Behind</span><b>{behind ? `${behind.car.code} ${me ? Math.abs(behind.gap - me.gap).toFixed(1) : "-"}s` : "-"}</b></div>
        </div>
        <div className="gh-wear">
          <div className="gh-wear-top"><b>{comp.toLowerCase()} · {age} lap{age === 1 ? "" : "s"}</b><span className={lossLap > 0.6 ? "hot" : lossLap > 0.3 ? "warm" : ""}>{lossLap > 0.6 ? "gone" : lossLap > 0.3 ? "fading" : "fresh"}</span></div>
          <div className="gh-meter"><i style={{ left: `${Math.min(96, (lossLap / 1.2) * 100)}%` }} /></div>
          <span className="gh-wear-k">Losing {lossLap.toFixed(2)}s a lap to a new set</span>
        </div>
      </div>
      {open && (
        <button className="gh-box" onClick={box} aria-label={`Box ${seat.name} this lap`}>
          BOX<small>tap or space</small>
        </button>
      )}
      {fl && fw && fb && (
        <div className={`gh-boxed${(fe?.d ?? 0) <= 0 ? " good" : " bad"}`} role="status">
          <span className="gh-boxed-k">{fb.auto ? `The window shut · the garage called it on lap ${fb.lap}` : `Box, box · lap ${fb.lap}`}{fb.lap === fw.stop ? " · the same lap as his garage" : fb.lap < fw.stop ? ` · ${fw.stop - fb.lap} laps before his garage` : ` · ${fb.lap - fw.stop} laps after his garage`}</span>
          <b>{fe?.rejoin ? `Out in P${fe.rejoin.pos}` : "Boxed"}</b>
          <p>
            {fe?.rejoin?.ahead ? `${fe.rejoin.ahead[1].toFixed(1)}s behind ${fe.rejoin.ahead[0]}, ` : ""}on fresh {fw.next.toLowerCase()}s.
            {" "}Against his real stop: <em>{secs(fe?.d ?? 0)}</em>.
          </p>
        </div>
      )}
      <div className="gh-legend">
        <span><i className="gh-dot-real" style={{ background: tc }} />The real {seat.name}{me ? ` · P${me.pos}` : ""}</span>
        <span><i className="gh-dot-ghost" />Your ghost</span>
      </div>
    </main>
  );
}
