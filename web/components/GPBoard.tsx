"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { Track } from "@/lib/types";

/**
 * The board.
 *
 * The front door used to be a picture with one button on it. Now the second
 * LED line is the board's channel: point at a way in and the whole panel
 * re-lamps to it, five real numbers about that activity, the map changing what
 * it is willing to show, the button re-lettering and re-targeting. You leave
 * having already chosen, and the door opens by putting the lights out.
 *
 * The rule the map obeys is the important one. It answers where the data
 * actually places something and goes quiet where it does not, because the
 * panel it sits in exists so that this screen never says anything it cannot
 * back up. Nothing here is modelled: no fitted speed, no inferred braking
 * points, no turn numbers the corner list does not carry.
 *
 * Everything is rendered as a Fragment of absolutely positioned siblings, so
 * every coordinate in the validated composition keeps working untouched.
 */

export type Channel = {
  n: string;
  word: string;
  label: string;
  href: string;
  cta: string;
  rows: { label: string; value: string; short: string }[];
  map: "corners" | "lap" | "blank";
  read: string[];
};

const PEEK_IN = 90;
const PEEK_OUT = 180;
const IDLE_MS = 3400;

export default function GPBoard({
  channels,
  start,
  track,
  d,
  vb,
}: {
  channels: Channel[];
  /** which channel the screen lands on, which is not the first on the rail */
  start: number;
  track: Track;
  d: string;
  vb: string;
}) {
  const [ch, setCh] = useState(start);
  const [peek, setPeek] = useState<number | null>(null);
  const [row, setRow] = useState<number | null>(null);
  const [sec, setSec] = useState<number | null>(null);
  const [pin, setPin] = useState<number | null>(null);
  const [msg, setMsg] = useState(0);
  const [firing, setFiring] = useState(false);
  const [still, setStill] = useState(false);

  const peekT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const touchX = useRef<number | null>(null);
  const touchY = useRef<number | null>(null);

  const shown = peek ?? ch;
  const active = channels[shown] ?? channels[0];

  /* ---------- geometry, once ---------- */

  const geo = useMemo(() => {
    const pts = track.points;
    const cum = [0];
    for (let i = 1; i < pts.length; i++)
      cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const total = cum[cum.length - 1] || 1;

    // a named section, by the vertex it sits on, in true lap order rather than
    // the order the file happens to list them in
    const named = track.corners.map((c) => {
      let bi = 0, bd = Infinity;
      pts.forEach((p, i) => {
        const dd = (p[0] - c.x) ** 2 + (p[1] - c.y) ** 2;
        if (dd < bd) { bd = dd; bi = i; }
      });
      return { ...c, at: bi };
    });
    named.sort((a, b) => a.at - b.at);
    return { pts, cum, total, named };
  }, [track]);

  /* ---------- a still screen if that is what was asked for ---------- */

  useEffect(() => {
    setStill(matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  /* ---------- the readout cycles until you touch something ---------- */

  useEffect(() => {
    if (still || row !== null || sec !== null || pin !== null) return;
    const t = setInterval(() => setMsg((m) => m + 1), IDLE_MS);
    return () => clearInterval(t);
  }, [still, row, sec, pin]);

  /* ---------- keys: the channels, and nothing else global ---------- */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const i = Number(e.key);
      if (e.key === "Escape" || e.key === "0") { setCh(start); setPeek(null); return; }
      if (i >= 1 && i < channels.length) { setCh(i); setPeek(null); }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [channels.length, start]);

  /* ---------- hover previews, click commits ---------- */

  const previewIn = (i: number) => {
    if (peekT.current) clearTimeout(peekT.current);
    peekT.current = setTimeout(() => setPeek(i), PEEK_IN);
  };
  const previewOut = () => {
    if (peekT.current) clearTimeout(peekT.current);
    peekT.current = setTimeout(() => setPeek(null), PEEK_OUT);
  };
  const commit = (i: number) => {
    if (peekT.current) clearTimeout(peekT.current);
    setPeek(null);
    setCh((c) => (c === i ? start : i));
  };

  /* ---------- the head follows the pointer along the lap ---------- */

  const moveHead = (e: React.PointerEvent<HTMLDivElement>) => {
    if (still) return;
    const svg = mapRef.current?.querySelector("svg");
    if (!svg) return;
    const box = svg.getBoundingClientRect();
    const [vx, vy, vw, vh] = vb.split(" ").map(Number);
    // the viewBox is cropped and preserveAspectRatio is the default, so the
    // drawing is letterboxed inside its slot: undo that before comparing
    const scale = Math.min(box.width / vw, box.height / vh);
    const ox = box.x + (box.width - vw * scale) / 2;
    const oy = box.y + (box.height - vh * scale) / 2;
    const ux = (e.clientX - ox) / scale + vx;
    const uy = (e.clientY - oy) / scale + vy;

    let bi = 0, bd = Infinity;
    geo.pts.forEach((p, i) => {
      const dd = (p[0] - ux) ** 2 + (p[1] - uy) ** 2;
      if (dd < bd) { bd = dd; bi = i; }
    });
    mapRef.current?.style.setProperty("--head", String(geo.cum[bi] / geo.total));

    // which named section that vertex belongs to, only when it changes
    let ni = 0, nd = Infinity;
    geo.named.forEach((c, i) => {
      const dd = Math.abs(c.at - bi);
      if (dd < nd) { nd = dd; ni = i; }
    });
    setSec((s) => (s === ni ? s : ni));
  };

  const stepSection = (dir: number) => {
    const from = pin ?? sec ?? -1;
    const next = (from + dir + geo.named.length) % geo.named.length;
    setPin(next);
    setSec(next);
    mapRef.current?.style.setProperty(
      "--head", String(geo.cum[geo.named[next].at] / geo.total)
    );
  };

  /* ---------- what the readout is saying right now ---------- */

  const readout = (() => {
    if (row !== null && active.rows[row]) return active.rows[row].short;
    const at = pin ?? sec;
    if (at !== null && geo.named[at]) return geo.named[at].label;
    return active.read[msg % active.read.length];
  })();

  const mapMode = row !== null
    ? (active.rows[row].label.toUpperCase().includes("CORNER") ? "corners"
      : active.rows[row].label.toUpperCase().includes("LAP LENGTH") ? "lap"
      : "quiet")
    : active.map;

  const swipe = {
    onTouchStart: (e: React.TouchEvent) => {
      if ((e.target as HTMLElement).closest("a")) return;
      touchX.current = e.touches[0].clientX;
      touchY.current = e.touches[0].clientY;
    },
    onTouchEnd: (e: React.TouchEvent) => {
      if (touchX.current === null || touchY.current === null) return;
      const dx = e.changedTouches[0].clientX - touchX.current;
      const dy = e.changedTouches[0].clientY - touchY.current;
      touchX.current = null;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy))
        setCh((c) => (c + (dx < 0 ? 1 : channels.length - 1)) % channels.length);
    },
  };

  return (
    <>
      <dl
        className="ledhero-notes"
        data-probe={row !== null ? "" : undefined}
        onMouseLeave={() => setRow(null)}
      >
        <div
          ref={mapRef}
          className={`ledhero-map m-${mapMode}`}
          tabIndex={0}
          role="group"
          aria-label="Circuit map"
          onPointerMove={moveHead}
          /* the map sits inside the panel, so leaving a row for the map never
             fires the list's mouseleave: the map has to clear the probe */
          onPointerEnter={() => setRow(null)}
          onPointerLeave={() => setSec(null)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") { e.preventDefault(); stepSection(1); }
            if (e.key === "ArrowLeft") { e.preventDefault(); stepSection(-1); }
          }}
        >
          <svg viewBox={vb} aria-hidden>
            <path className="trk" d={d} pathLength={1} fill="none" stroke="#ff1c12"
              strokeWidth={6} strokeLinejoin="round" />
            {!still && (
              <path className="head" d={d} pathLength={1} fill="none" stroke="#ff1c12"
                strokeWidth={11} strokeLinecap="round" strokeDasharray=".012 .988" />
            )}
            {geo.named.map((c, i) => (
              <circle key={c.label} className="ring" cx={c.x} cy={c.y} r={9} fill="none"
                stroke="#ff1c12" strokeWidth={3}
                data-on={pin === i || sec === i ? "" : undefined} />
            ))}
            {geo.named.map((c, i) => (
              <circle key={`hit-${c.label}`} cx={c.x} cy={c.y} r={30}
                fill="transparent" pointerEvents="all" style={{ cursor: "pointer" }}
                onClick={() => setPin((p) => (p === i ? null : i))} />
            ))}
          </svg>
        </div>

        {active.rows.map((s, i) => (
          <Fragment key={`${active.n}-${s.label}`}>
            <dt
              style={{ ["--r" as string]: i }}
              tabIndex={0}
              data-on={row === i ? "" : undefined}
              onMouseEnter={() => setRow(i)}
              onFocus={() => setRow(i)}
              onBlur={() => setRow(null)}
            >
              {s.label}
            </dt>
            <dd style={{ ["--r" as string]: i }} data-on={row === i ? "" : undefined}>
              {s.value}
              {s.short && <small>{s.short}</small>}
            </dd>
          </Fragment>
        ))}
      </dl>

      <span className="ledhero-l2" key={active.word}>
        {[...active.word].map((c, i) => (
          <b key={i} style={{ ["--i" as string]: i }}>
            {c === " " ? " " : c}
          </b>
        ))}
      </span>

      <p className="ledhero-read" aria-live="polite">
        <i aria-hidden>▸</i> {readout}
      </p>

      {channels.length > 1 && (
        <div className="ledhero-rail" {...swipe}>
          {channels.map((c, i) => (
            <Fragment key={c.n}>
              {i > 0 && <em aria-hidden>//</em>}
              <button
                type="button"
                aria-pressed={shown === i}
                onMouseEnter={() => previewIn(i)}
                onMouseLeave={previewOut}
                onFocus={() => setPeek(i)}
                onBlur={() => setPeek(null)}
                onClick={() => commit(i)}
              >
                <b>{c.n}</b>
                {c.label}
              </button>
            </Fragment>
          ))}
        </div>
      )}

      <Link
        className="ledhero-enter"
        href={active.href}
        data-fx-delay={still || !active.href.startsWith("/") ? undefined : 260}
        /* the lights only go out when you are actually leaving the screen */
        onClick={() => { if (!still && active.href.startsWith("/")) setFiring(true); }}
      >
        <span key={active.cta}>{active.cta}</span>
        <i aria-hidden>→</i>
      </Link>

      {firing && <FireLights />}
    </>
  );
}

/** Puts .is-firing on the hero so the panel can go dark in one frame. */
function FireLights() {
  useEffect(() => {
    const el = document.querySelector(".ledhero");
    el?.classList.add("is-firing");
    return () => el?.classList.remove("is-firing");
  }, []);
  return null;
}
