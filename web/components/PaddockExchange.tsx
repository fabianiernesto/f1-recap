"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent as RowPointer, type ReactNode } from "react";
import type { Replay, Track } from "@/lib/types";
import ReplayTrack from "@/components/ReplayTrack";
import { hex, leaderAt, standings } from "@/lib/replay";
import { Speedlines } from "@/components/Mood";
import CardActions from "@/components/CardActions";
import type { CardInput } from "@/lib/shareCard";

/**
 * Paddock exchange (activity 02, since 26/10/2026, in place of The ghost).
 *
 * Every driver is a share and his price is his place: last is worth 5 and
 * every place he gains adds 5. The race plays back on the real track in about
 * two minutes and the prices move at the end of every lap, straight from the
 * timing. You start with 1,000, put 100 at a time on whoever you like and
 * sell when you like the number. A retirement is worth nothing, and
 * whatever you hold at the flag is paid at the driver's official final place.
 *
 * Nothing is predicted or modelled: a price is a position, and every position
 * is the one the timing gives at the moment the leader crosses the line.
 */

const START = 1000;
const STAKE = 100;

type Trade = { n: number; paid: number; got: number; lap: number; how: "sold" | "flag" | "retired" };
type Hold = { shares: number; paid: number };

const fmt = (v: number) => Math.round(v).toLocaleString("en-GB");
// money moves in whole credits, so what is on screen is what is paid and every sum adds up
const worth = (h: Hold, price: number) => Math.round(h.shares * price);
// "Norris", "Norris and Russell", "Norris, Russell and Piastri"
const names = (cs: { name: string }[]) => cs.map((c) => c.name).join(", ").replace(/, ([^,]*)$/, " and $1");

function verdict(d: number, traded: boolean) {
  if (!traded) return { t: "Kept the cash", l: "You watched it go by. Every price moved and none of it was yours." };
  if (d >= 1000) return { t: "Paddock tycoon", l: "You doubled it and then some. This race paid whoever read it." };
  if (d >= 300) return { t: "Team principal", l: "The right cars at the right laps. The pit wall would hire you." };
  if (d > 0) return { t: "In the money", l: "Up on the day. There was more on the table, there always is." };
  if (d === 0) return { t: "Break even", l: "Every trade cancelled out. Not a bad day, not a good one." };
  return { t: "Bad day at the office", l: "The race went the other way. It does that to pit walls too." };
}

export default function PaddockExchange({
  r, track, gp, slug, session, callHref, storyHref,
}: {
  r: Replay; track: Track; gp: string; slug: string; session: string; callHref: string | null; storyHref: string;
}) {
  const N = r.field.length;
  const priceOf = (pos: number) => (N + 1 - pos) * 5;
  const byNum = useMemo(() => new Map(r.field.map((c) => [c.num, c])), [r.field]);

  // every lap's market, worked out once: order, place and price of each car
  const snaps = useMemo(() => {
    const out: { order: number[]; pos: Map<number, number | null>; price: Map<number, number> }[] = [];
    for (let lap = 0; lap <= r.laps; lap++) {
      const order: number[] = [];
      const pos = new Map<number, number | null>(), price = new Map<number, number>();
      if (lap === 0) {
        [...r.field].sort((a, b) => (a.grid ?? 99) - (b.grid ?? 99) || a.num - b.num)
          .forEach((c, i) => { order.push(c.num); pos.set(c.num, i + 1); price.set(c.num, (N - i) * 5); });
      } else {
        // the order at the end of this lap, the moment the leader closes it: the whole board
        // moves together, a few seconds before the last car reaches the line on the track
        const road = standings(r, Infinity, lap);
        if (lap === r.laps) {
          // the flag pays the official classification, penalties included: road order is only
          // the race as it ran. No finishing place (retired, disqualified, not classified) pays 0
          const home = road.filter((x) => x.car.finish != null).sort((a, b) => a.car.finish! - b.car.finish!);
          for (const x of [...home, ...road.filter((y) => y.car.finish == null)]) {
            const f = x.car.finish;
            order.push(x.car.num);
            pos.set(x.car.num, f);
            price.set(x.car.num, f == null ? 0 : (N + 1 - f) * 5);
          }
        } else road.forEach((x, i) => {
          order.push(x.car.num);
          pos.set(x.car.num, x.out ? null : i + 1);
          price.set(x.car.num, x.out ? 0 : (N - i) * 5);
        });
      }
      out.push({ order, pos, price });
    }
    return out;
  }, [r, N]);
  const pitsAt = useMemo(() => {
    const m = new Map<number, number[]>();
    for (const [num, lap] of r.pits) m.set(lap, [...(m.get(lap) ?? []), num]);
    return m;
  }, [r.pits]);
  const end = useMemo(() => leaderAt(r, r.laps), [r]);
  const lapTimes = useMemo(() => Array.from({ length: r.laps + 1 }, (_, l) => leaderAt(r, l)), [r]);
  // about two minutes for a race, a minute for a sprint, never a blur
  const secPerLap = Math.min(3.2, Math.max(1.6, 120 / r.laps));
  const speed = end / (r.laps * secPerLap);

  const tRef = useRef(0);
  const [phase, setPhase] = useState<"cover" | "run" | "done">("cover");
  const [lap, setLap] = useState(0);
  const [cash, setCash] = useState(START);
  const [held, setHeld] = useState<Record<number, Hold>>({});
  const [trades, setTrades] = useState<Trade[]>([]);
  const [coach, setCoach] = useState<ReactNode>(null);
  const [feed, setFeed] = useState("");
  // the order the rows held when a finger landed on the board; null when no finger is down
  const [pressed, setPressed] = useState<number[] | null>(null);
  const release = useRef(0);
  const heldRef = useRef(held);
  heldRef.current = held;
  // the wallet as of the last tap, not the last render: taps can land between renders
  const cashRef = useRef(cash);
  cashRef.current = cash;
  const bought = useRef(false);

  // the finger is up (or became a scroll): the rows catch up, a beat after the tap has landed
  useEffect(() => {
    if (!pressed) return;
    const up = () => { clearTimeout(release.current); release.current = window.setTimeout(() => setPressed(null), 120); };
    for (const ev of ["pointerup", "pointercancel", "blur"]) window.addEventListener(ev, up);
    return () => { for (const ev of ["pointerup", "pointercancel", "blur"]) window.removeEventListener(ev, up); };
  }, [pressed]);

  // the clock: one pass per frame, the market moves when the leader crosses
  useEffect(() => {
    if (phase !== "run") return;
    let raf = 0, last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const t = Math.min(end, tRef.current + dt * speed);
      tRef.current = t;
      let l = 0;
      while (l < r.laps && lapTimes[l + 1] <= t) l++;
      setLap((p) => (p === l ? p : l));
      if (t >= end) return;
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [phase, end, speed, r.laps, lapTimes]);

  // a new lap: what moved, in words, and retirements written off
  useEffect(() => {
    if (phase !== "run" || lap === 0) return;
    const now = snaps[lap], before = snaps[lap - 1];
    const neutral = r.neutral.find((x) => lap + 1 >= x.from && lap <= x.to);
    const outs = r.field.filter((c) => now.price.get(c.num) === 0 && (before.price.get(c.num) ?? 0) > 0);
    const pits = (pitsAt.get(lap) ?? []).map((n) => byNum.get(n)!).filter(Boolean);
    const lost = outs.filter((c) => heldRef.current[c.num]);
    if (lost.length) {
      const gone = lost.reduce((s, c) => s + heldRef.current[c.num].paid, 0);
      setTrades((tr) => [...tr, ...lost.map((c) => ({ n: c.num, paid: heldRef.current[c.num].paid, got: 0, lap, how: "retired" as const }))]);
      setHeld((h) => { const x = { ...h }; for (const c of lost) delete x[c.num]; return x; });
      setCoach(lost.every((c) => c.out == null)
        ? <><b>Not classified.</b> {names(lost)} {lost.length > 1 ? "have" : "has"} no official finish, with your money in {lost.length > 1 ? "them" : "him"}: <b>{fmt(gone)} gone</b>.</>
        : <><b>Retirement.</b> {names(lost)} retired with your money in {lost.length > 1 ? "them" : "him"}: <b>{fmt(gone)} gone</b>.</>);
    } else if (pits.length && bought.current && lap < r.laps - 3) {
      setCoach(neutral
        ? <><b>Stops under the {neutral.kind === "SC" ? "safety car" : "virtual safety car"}.</b> Everybody is slow, so a stop costs little now: watch who comes out ahead.</>
        : <><b>Pit stops.</b> A driver who just stopped loses places for a lap or two, so his price drops. Buy him there and sell when he is back up.</>);
    } else if (!bought.current) {
      setCoach(<>Prices move at the end of every lap. Pick a driver and press <b>Invest {STAKE}</b>. Somebody cheap who should be further up is the best buy.</>);
    }
    if (lap === r.laps - 3) setCoach(<><b>Three laps to go.</b> At the flag, whatever you still hold is paid at the driver&rsquo;s official final place, penalties included.</>);

    const many = (a: unknown[]) => a.length > 1;
    let msg = "";
    if (outs.length) {
      msg = `${names(outs)} ${many(outs) ? "are" : "is"} ${outs.every((c) => c.out == null) ? "not classified" : "out"}. ${many(outs) ? "Their" : "His"} shares are worth nothing now.`;
    } else if (pits.length) {
      const who = names(pits);
      const fell = pits.filter((c) => (now.price.get(c.num) ?? 0) < (before.price.get(c.num) ?? 0));
      const stop = many(pits) ? "stop" : "stops";
      msg = neutral
        ? `${who} ${stop} under the ${neutral.kind === "SC" ? "safety car" : "virtual safety car"}. A stop costs far less now.`
        : !fell.length || lap >= r.laps - 3
          ? `${who} ${stop} for tyres.`
          : fell.length === pits.length
            ? `${who} ${stop} for tyres and ${many(fell) ? "drop" : "drops"} down the order. Cheap for a lap or two, while ${many(fell) ? "they climb" : "he climbs"} back.`
            : `${who} ${stop} for tyres. ${names(fell)} ${many(fell) ? "drop" : "drops"} down the order, cheap for a lap or two while ${many(fell) ? "they climb" : "he climbs"} back.`;
    }
    setFeed(msg ? `Lap ${lap} · ${msg}` : "");

    if (lap >= r.laps) {
      // the flag: everything still held is paid at the final place
      // (a retirement on the last lap was written off above, not paid again)
      const gone = new Set(lost.map((c) => c.num));
      const h = Object.fromEntries(Object.entries(heldRef.current).filter(([n]) => !gone.has(+n)));
      const paid = Object.entries(h).map(([n, x]) => ({ n: +n, paid: x.paid, got: worth(x, now.price.get(+n) ?? 0), lap, how: "flag" as const }));
      setCash((c) => c + paid.reduce((s, x) => s + x.got, 0));
      setTrades((tr) => [...tr, ...paid]);
      setHeld({});
      const id = setTimeout(() => { setPhase("done"); scrollTo(0, 0); }, 900);
      return () => clearTimeout(id);
    }
  }, [lap, phase, snaps, r, pitsAt, byNum]);

  const start = () => {
    const pole = byNum.get(snaps[0].order[0]);
    tRef.current = 0;
    bought.current = false;
    setLap(0); setCash(START); setHeld({}); setTrades([]); setFeed("");
    setCoach(<>The grid sets the first prices. <b>{pole?.name} starts on pole: {priceOf(1)}.</b> Pick somebody and press <b>Invest {STAKE}</b> before the first lap is over.</>);
    setPhase("run");
    scrollTo(0, 0);
  };

  const snap = snaps[lap];
  const prevSnap = snaps[Math.max(0, lap - 1)];
  const price = (n: number) => snap.price.get(n) ?? 0;
  const over = lap >= r.laps;

  const buy = (n: number) => {
    const p = price(n), amt = Math.min(STAKE, cashRef.current);
    if (!p || amt <= 0 || over) return;
    cashRef.current -= amt;
    setCash((c) => c - amt);
    setHeld((h) => ({ ...h, [n]: { shares: (h[n]?.shares ?? 0) + amt / p, paid: (h[n]?.paid ?? 0) + amt } }));
    if (!bought.current) {
      bought.current = true;
      setCoach(<>You own a piece of <b>{byNum.get(n)?.name}</b> at {p}. If he climbs, his price climbs with him. When you like the number, <b>sell</b>.</>);
    }
    if (cashRef.current <= 0) setCoach(<><b>All your money is in.</b> Sell a driver to invest again.</>);
  };
  const sell = (n: number) => {
    const h = heldRef.current[n];
    if (!h || over) return;
    const got = worth(h, price(n));
    const { [n]: _sold, ...rest } = heldRef.current; // a second tap finds nothing left to sell
    heldRef.current = rest;
    cashRef.current += got;
    setCash((c) => c + got);
    setTrades((tr) => [...tr, { n, paid: h.paid, got, lap, how: "sold" }]);
    setHeld((x) => { const y = { ...x }; delete y[n]; return y; });
    setCoach(<><b>Sold {byNum.get(n)?.name}.</b> Paid {fmt(h.paid)}, got {fmt(got)}.</>);
  };

  // a mouse takes a moment to reach a button, and a row moving in that moment buys another driver: on
  // a button the rows hold as they do under a finger, until it has stopped for a moment or has left
  const holdForMouse = (e: RowPointer) => {
    if (e.pointerType !== "mouse") return;
    const on = !!(e.target as Element).closest(".px-acts button");
    if (!on && !pressed) return;
    if (on) setPressed((o) => o ?? snap.order);
    clearTimeout(release.current);
    release.current = window.setTimeout(() => setPressed(null), on ? 1200 : 120);
  };

  // with a mouse a trade happens on the press: a row still settling can slide away before the
  // release, and then the browser fires no click. A finger stays on click, or a scroll would buy
  const lastPointer = useRef("");
  const trade = (act: () => void) => ({
    onPointerDown: (e: RowPointer) => { lastPointer.current = e.pointerType; if (e.pointerType === "mouse" && e.button === 0) act(); },
    onClick: (e: MouseEvent) => { if (e.detail > 0 && lastPointer.current === "mouse") return; act(); },
  });

  const inDrivers = Object.entries(held).reduce((s, [n, h]) => s + worth(h, price(+n)), 0);
  const total = cash + inDrivers;
  const delta = total - START;

  /* ---------- the rules */
  if (phase === "cover")
    return (
      <main className="cr cr-cover px-cover">
        <Speedlines n={6} />
        <div className="cr-cover-track"><ReplayTrack r={r} track={track} tRef={tRef} /></div>
        <div className="cr-cover-copy">
          <span className="cr-eyebrow">Activity 02 <em>//</em> {gp} · {session === "sprint" ? "Sprint" : "Race"}</span>
          <h1 className="cr-h1">Paddock<span className="glow">exchange</span></h1>
          <ol className="cr-how">
            <li><b>01</b><span><strong>A driver is worth his place.</strong> Last is worth 5 and every place he gains adds 5, so the leader is worth {priceOf(1)}. Prices change at the end of every lap, with the real race.</span></li>
            <li><b>02</b><span><strong>Buy low, sell high.</strong> Invest {STAKE} in a driver when he is cheap and sell when he has climbed. You start with {fmt(START)}.</span></li>
            <li><b>03</b><span><strong>If he retires, you lose it.</strong> A retired driver is worth nothing. Whatever you hold at the flag is paid at his official final place, penalties included.</span></li>
          </ol>
          <div className="px-ladder" aria-label="The price of every place" style={{ ["--n" as string]: N }}>
            {Array.from({ length: N }, (_, i) => (
              <div key={i}><i style={{ height: `${priceOf(i + 1) * 0.42}px` }} className={i === 0 ? "top" : ""} /><span>P{i + 1}</span><b>{priceOf(i + 1)}</b></div>
            ))}
          </div>
          <div className="cr-stats">
            <div><span>Laps</span><b>{r.laps}</b></div>
            <div><span>Drivers</span><b>{N}</b></div>
            <div><span>Time</span><b>{Math.round((r.laps * secPerLap) / 60)}&rsquo;</b></div>
          </div>
          <button className="bt-go" onClick={start}>Lights out <i aria-hidden>→</i></button>
        </div>
      </main>
    );

  /* ---------- the flag */
  if (phase === "done") {
    const v = verdict(delta, trades.length > 0);
    const name = (n: number) => byNum.get(n)?.name ?? "";
    const best = [...trades].sort((a, b) => (b.got - b.paid) - (a.got - a.paid))[0];
    // the trade of the race: the cheapest any finisher ever was, held to the flag
    let star: { n: number; low: number; at: number; end: number } | null = null;
    for (const c of r.field) {
      const fin = snaps[r.laps].price.get(c.num) ?? 0;
      if (!fin) continue;
      let low = Infinity, at = 0;
      snaps.forEach((s, l) => { const p = s.price.get(c.num) ?? 0; if (p > 0 && p < low) { low = p; at = l; } });
      if (!star || fin / low > star.end / star.low) star = { n: c.num, low, at, end: fin };
    }
    const winner = r.field.find((c) => snaps[r.laps].order[0] === c.num);
    const marks = trades.length ? trades.map((x) => (x.got > x.paid ? "hit" : x.got < x.paid ? "miss" : "flat") as "hit" | "miss" | "flat") : ["flat" as const];
    const shareText = `Racing Simplified · ${gp} · Paddock exchange\nTurned 1,000 into ${fmt(total)}\n`
      + (trades.length ? trades.map((x) => (x.got > x.paid ? "🟩" : x.got < x.paid ? "🟥" : "⬜")).join("") + "\n" : "") + `Same race, same prices. Beat me:`;
    const card: CardInput = {
      kicker: "Activity 02 // Paddock exchange", gp: `${gp} · ${session === "sprint" ? "Sprint" : "Race"}`,
      title: ["Paddock", "exchange"], big: fmt(total), bigLabel: `from 1,000 · ${trades.length} trade${trades.length === 1 ? "" : "s"}`,
      verdict: v.t, marks, foot: "Same race, same prices. Beat that.",
    };
    return (
      <main className="cr cr-done px-done">
        <Speedlines n={5} />
        <section className="cr-final">
          <span className="cr-eyebrow">Chequered flag <em>//</em> {gp}</span>
          <div className="cr-score">{fmt(total)}<small>from 1,000</small></div>
          <span className={`cr-right ${delta > 0 ? "px-up" : delta < 0 ? "px-down" : ""}`}>
            {delta === 0 ? "Not a credit either way" : `${delta > 0 ? "+" : "−"}${fmt(Math.abs(delta))} on your ${fmt(START)}`}
          </span>
          <h2 className="cr-verdict">{v.t}</h2>
          <p className="cr-line">{v.l}</p>
          <div className="cr-marks" aria-hidden>{trades.map((x, i) => <i key={i} className={x.got > x.paid ? "hit" : x.got < x.paid ? "miss" : ""} style={x.got === x.paid ? { background: "#555" } : undefined} />)}</div>
          <div className="cr-share">
            <CardActions card={card} text={shareText} name={`paddock-exchange-${slug}.png`} />
            <span>Same race and the same prices for whoever opens it.</span>
          </div>
        </section>
        <section className="cr-review px-review">
          <div className="px-facts">
            <div><span>Your best trade</span>{best && best.got > best.paid
              ? <><b>{name(best.n)}</b><p>Paid {fmt(best.paid)}, got {fmt(best.got)}{best.how === "flag" ? " at the flag" : ` on lap ${best.lap}`}.</p></>
              : <><b>None</b><p>{trades.length ? "No trade made money this time." : "No trades."}</p></>}</div>
            {star && <div><span>The trade of the race</span><b>{name(star.n)}</b>
              <p>Cheapest at {star.low} {star.at ? `on lap ${star.at}` : "on the grid"}, worth {star.end} at the flag: {(star.end / star.low).toFixed(1)} times the money.</p></div>}
            {winner && <div><span>The winner</span><b>{winner.name}</b><p>From P{winner.grid ?? snaps[0].pos.get(winner.num)} on the grid. Worth {priceOf(1)} at the flag.</p></div>}
          </div>
          <h3>Your trades</h3>
          <ol className="px-trades">
            {trades.length ? trades.map((x, i) => (
              <li key={i}>
                <span>{name(x.n)} · {x.how === "retired" ? (byNum.get(x.n)?.out == null ? "not classified" : `retired on lap ${byNum.get(x.n)?.out}`) : x.how === "flag" ? "held to the flag" : `sold on lap ${x.lap}`}</span>
                <b className={x.got >= x.paid ? "px-up" : "px-down"}>{x.got >= x.paid ? "+" : "−"}{fmt(Math.abs(x.got - x.paid))}</b>
              </li>
            )) : <li><span>No trades</span><b /></li>}
          </ol>
          <nav className="cr-next">
            <button className="myst-door" onClick={start}><span>Again</span><b>Trade this race again</b><i aria-hidden>→</i></button>
            {callHref && <Link href={callHref} className="myst-door"><span>Activity 01</span><b>Call the race</b><i aria-hidden>→</i></Link>}
            <Link href={storyHref} className="myst-door"><span>Scrolled</span><b>Every moment, in order</b><i aria-hidden>→</i></Link>
          </nav>
        </section>
      </main>
    );
  }

  /* ---------- the race, and the market */
  const flag = r.neutral.find((x) => lap + 1 >= x.from && lap <= x.to);
  const pitNow = new Set(pitsAt.get(lap) ?? []);
  return (
    <main className="cr px-game">
      <aside className="px-left">
        <div className="px-top">
          <div className="px-lap"><span>Lap</span><b>{lap}<small> / {r.laps}</small></b></div>
          <div className="px-flag">{flag && <><b>{flag.kind === "SC" ? "Safety car" : "Virtual safety car"}</b><span>{flag.kind === "SC" ? "The field is bunched up. Places will shuffle." : "Everybody slows down, so a stop costs less."}</span></>}</div>
        </div>
        <div className="px-track"><ReplayTrack r={r} track={track} tRef={tRef} /></div>
        <div className="px-wallet">
          <div><span>Cash</span><b>{fmt(cash)}</b></div>
          <div><span>In drivers</span><b>{fmt(inDrivers)}</b>
            <em>{Object.entries(held).map(([n, h]) => `${byNum.get(+n)?.code} ${fmt(worth(h, price(+n)))}`).join(" · ")}</em></div>
          <div className="px-total"><span>Your total</span><b>{fmt(total)}</b>
            <em className={delta > 0 ? "px-up" : delta < 0 ? "px-down" : ""}>{delta ? `${delta > 0 ? "+" : "−"}${fmt(Math.abs(delta))} on your ${fmt(START)}` : ""}</em>
            <small className="px-cashline">Cash {fmt(cash)}</small></div>
        </div>
        <p className="px-coach" role="status">{coach}</p>
      </aside>
      <section className="px-board" aria-label="The market">
        <div className="px-head"><span>Pos</span><span>Driver</span><span>Price</span><span>You hold</span><span /></div>
        {/* a row moving under the finger loses the tap on an iPhone, or buys the wrong driver:
            while a finger is on the board the rows hold their places (prices stay live) */}
        <div className="px-rows" style={{ ["--n" as string]: N }}
          onPointerDown={() => { clearTimeout(release.current); setPressed((o) => o ?? snap.order); }}
          onPointerMove={holdForMouse} onPointerLeave={holdForMouse}>
          {/* in grid order in the page: the field comes sorted by final place, and tabbing or a screen reader would read it out */}
          {snaps[0].order.map((num) => byNum.get(num)!).map((c) => {
            const i = (pressed ?? snap.order).indexOf(c.num);
            const pos = snap.pos.get(c.num);
            const out = pos == null;
            const p = price(c.num), d = lap ? p - (prevSnap.price.get(c.num) ?? p) : 0;
            const h = held[c.num], val = h ? worth(h, p) : 0;
            return (
              <div key={c.num} className={`px-row${out ? " is-out" : ""}${h ? " is-mine" : ""}`} style={{ ["--i" as string]: i }}>
                <span className="px-p">{out ? "" : pos}</span>
                <span className="px-who">
                  <i style={{ background: hex(c.colour) }} />
                  <b>{c.code}</b><span>{c.name} · {c.team}</span>
                  {out ? <em>{c.out == null ? "Not classified" : "Retired"}</em> : pitNow.has(c.num) ? <em>Pit</em> : null}
                </span>
                <span className="px-price">
                  <b>{p}</b>
                  <small className={out || d < 0 ? "px-down" : d > 0 ? "px-up" : ""}>{out ? "Out" : d > 0 ? `▲ +${d}` : d < 0 ? `▼ ${d}` : ""}</small>
                </span>
                <span className="px-hold">{h ? <><b className={val >= h.paid ? "px-up" : "px-down"}>{fmt(val)}</b>paid {fmt(h.paid)}</> : null}</span>
                <span className="px-acts">
                  <button className="px-buy" aria-label={`Invest ${cash >= 1 ? Math.min(STAKE, cash) : STAKE} in ${c.name}`} disabled={out || cash < 1 || over} {...trade(() => buy(c.num))}>Invest {cash >= 1 ? Math.min(STAKE, cash) : STAKE}</button>
                  <button className="px-sell" aria-label={`Sell ${c.name}`} disabled={!h || over} {...trade(() => sell(c.num))}>Sell</button>
                </span>
              </div>
            );
          })}
        </div>
        <p className="px-feed">{feed}</p>
      </section>
    </main>
  );
}
