"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { BlindTest as Test, Mystery, MysteryDriverRow } from "@/lib/types";
import { GHOST, bigPhoto } from "@/lib/photo";
import Term from "@/components/Term";
import BlindTest from "@/components/BlindTest";
import { Beam, Blur, MOOD, Speedlines } from "@/components/Mood";

/**
 * The mystery driver (activity 01, rebuilt 22/10/2026 on the moodboard).
 *
 * One driver per race, the same one for everybody who opens it, so everybody
 * who watched argues about the same name. It is dressed in the sport's own
 * objects rather than in a quiz's:
 *
 *   the start lights count your tries. Every miss lights one red; get him
 *   and it is lights out; miss six and the gantry stays lit;
 *
 *   the clues are the data as a poster, a giant figure and a small label, the
 *   tyres in their real compound colours. They open from the vaguest to the
 *   most damning (pipeline/mystery.py sorts them by how many drivers each
 *   still fits), and every miss unlocks the next one;
 *
 *   you guess from the garages: the whole field team by team, in each team's
 *   colour, with the faces. Pick one, then lock it in, the way a call is
 *   confirmed on the radio, so a stray thumb is not a wasted try;
 *
 *   every miss comes back on a timing tower with arrows pointing at the
 *   mystery driver: same team or not, started higher or lower, stopped more or
 *   less, passed more or less. Never where he finished: that is the last clue.
 *
 * The reveal is the moodboard's signature: his name across the stage in the
 * wide face, the real photograph in front of the letters, the stage flooded
 * in his team's colour. The share is spoiler-free: squares as text, and a
 * 1080x1920 card for Stories drawn on a canvas with no name and no result.
 * The game is kept in this browser; the blind test stays as the free mode.
 */

const TRIES = 6;

const VERDICTS: { title: string; line: string }[] = [
  { title: "Race engineer", line: "One look at the sheet and you had him." },
  { title: "Strategist", line: "Two tries. You read the race, you did not guess it." },
  { title: "Paddock regular", line: "You followed the clues the way the timing screen tells it." },
  { title: "Grandstand", line: "Got there. The stops and the tyres did most of the talking." },
  { title: "Sofa", line: "Most of the sheet, but you got him." },
  { title: "Sofa", line: "Last light, last try. Still counts." },
];

/** F1's compound colours: the only colours a tyre is allowed to wear */
const COMPOUND: Record<string, { c: string; l: string }> = {
  soft: { c: "#e10600", l: "S" },
  medium: { c: "#ffd12e", l: "M" },
  hard: { c: "#f2f2f2", l: "H" },
  intermediate: { c: "#2fd06a", l: "I" },
  wet: { c: "#2f7bff", l: "W" },
};

function tone(colour?: string, fallback = "#e10600"): string {
  const hex = (colour || "").replace("#", "");
  return /^[0-9a-f]{6}$/i.test(hex) ? `#${hex}` : fallback;
}

/** which way the mystery driver lies from a guess: up = his value is higher */
function cmp(mine: number | null, theirs: number | null): "up" | "down" | "same" | null {
  if (mine == null || theirs == null) return null;
  return mine > theirs ? "up" : mine < theirs ? "down" : "same";
}

/** a clue as a poster: the figure big, and under it the clue said as a
 *  sentence about him, so nothing has to be decoded */
function ClueFace({ c }: { c: Mystery["clues"][number] }) {
  if (c.kind === "tyres") {
    const sets = c.big.split(/\s+to\s+/).map((x) => x.trim().toLowerCase());
    return (
      <>
        <span className="myst-tyres">
          {sets.map((t, i) => (
            <span key={i} className="myst-tyre" style={{ ["--tc" as string]: COMPOUND[t]?.c ?? "#888" }}>
              <i>{COMPOUND[t]?.l ?? "?"}</i>
            </span>
          ))}
        </span>
        <span className="myst-say">{c.say}</span>
      </>
    );
  }
  if (c.kind === "tell") return <span className="myst-tell-v">{c.say}</span>;
  return (
    <>
      <span className={`myst-big${c.kind === "purple" ? " myst-purple" : ""}`}>{c.big}</span>
      <span className="myst-say">{c.say}</span>
    </>
  );
}

/** the start lights: one pair per try */
function Gantry({ lit, out, all }: { lit: number; out: boolean; all: boolean }) {
  return (
    <div className={`myst-gantry${out ? " is-out" : ""}${all ? " is-all" : ""}`} aria-hidden>
      {Array.from({ length: TRIES }, (_, i) => (
        <span key={i} className={`myst-pod${!out && (all || i < lit) ? " on" : ""}`}>
          <i /><i />
        </span>
      ))}
    </div>
  );
}

/** the Stories card, drawn rather than screenshotted so it is the same everywhere */
async function drawCard(o: { gp: string; session: string; marks: ("hit" | "miss")[]; verdict: string; score: string }) {
  const W = 1080, H = 1920;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const x = cv.getContext("2d")!;
  try { await Promise.all([document.fonts.load('800 120px "Anybody"'), document.fonts.ready]); } catch {}
  const wide = (px: number, w = 800) => {
    x.font = `${w} ${px}px "Anybody", sans-serif`;
    (x as unknown as { fontStretch: string }).fontStretch = "extra-expanded";
  };
  x.fillStyle = "#0a0a0a"; x.fillRect(0, 0, W, H);
  const g = x.createRadialGradient(W * 0.7, H * 0.78, 40, W * 0.7, H * 0.78, 1100);
  g.addColorStop(0, "#e10600aa"); g.addColorStop(0.45, "#e1060033"); g.addColorStop(1, "#0a0a0a00");
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  // the neon tube on a diagonal
  x.save(); x.shadowColor = "#ff2415"; x.shadowBlur = 40; x.strokeStyle = "#ff3b2a"; x.lineWidth = 6;
  x.beginPath(); x.moveTo(W * 0.62, -40); x.lineTo(W * 1.08, H * 0.42); x.stroke(); x.restore();
  // speed lines
  x.strokeStyle = "#ffffff14"; x.lineWidth = 2;
  for (let i = 0; i < 9; i++) { const y = 260 + i * 170; x.beginPath(); x.moveTo(0, y); x.lineTo(W * (0.3 + (i % 3) * 0.12), y); x.stroke(); }
  x.textBaseline = "alphabetic";
  x.fillStyle = "#e10600"; x.font = '700 30px "JetBrains Mono", monospace';
  x.fillText("RACING SIMPLIFIED  //  ACTIVITY 01", 80, 150);
  x.fillStyle = "#8c8c8c"; x.fillText(`${o.gp.toUpperCase()} · ${o.session.toUpperCase()}`, 80, 200);
  wide(118); x.fillStyle = "#ffffff"; x.fillText("MYSTERY", 74, 430);
  x.save(); x.shadowColor = "#ff2415"; x.shadowBlur = 36; x.fillStyle = "#ff2415"; x.fillText("DRIVER", 74, 560); x.restore();
  // the lights
  for (let i = 0; i < TRIES; i++) {
    const cx = 130 + i * 164, cy = 820, m = o.marks[i];
    x.fillStyle = "#151515"; x.fillRect(cx - 62, cy - 120, 124, 240);
    for (const dy of [-56, 56]) {
      x.beginPath(); x.arc(cx, cy + dy, 44, 0, Math.PI * 2);
      const col = m === "hit" ? "#2fd06a" : m === "miss" ? "#ff2415" : "#262626";
      x.save(); if (m) { x.shadowColor = col; x.shadowBlur = 40; }
      x.fillStyle = col; x.fill(); x.restore();
    }
  }
  wide(220, 900); x.fillStyle = "#ffffff"; x.fillText(o.score, 74, 1240);
  x.fillStyle = "#e10600"; x.font = '700 34px "JetBrains Mono", monospace'; x.fillText("VERDICT", 80, 1340);
  wide(88); x.fillStyle = "#ffffff";
  const words = o.verdict.toUpperCase().split(" ");
  let line = "", y = 1450;
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (x.measureText(t).width > W - 160 && line) { x.fillText(line, 74, y); y += 100; line = w; } else line = t;
  }
  x.fillText(line, 74, y);
  x.fillStyle = "#8c8c8c"; x.font = '500 30px "JetBrains Mono", monospace';
  x.fillText("No names, no spoilers. Guess yours.", 80, H - 120);
  return new Promise<Blob | null>((r) => cv.toBlob(r, "image/png"));
}

export default function MysteryDriver({
  mystery, test, gp, storyHref, storageKey,
}: {
  mystery: Mystery; test: Test | null; gp: string; storyHref: string; storageKey: string;
}) {
  const a = mystery.answer;
  const [guesses, setGuesses] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [free, setFree] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLElement>(null);
  const topRef = useRef<HTMLElement>(null);

  // a finished puzzle stays finished in this browser. Nothing is written until
  // the saved game has been read, or the first empty render would wipe it;
  // storage can be missing or blocked, and the game works without it.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "[]");
      if (Array.isArray(saved)) setGuesses(saved.filter((g) => typeof g === "string").slice(0, TRIES));
    } catch {}
    setLoaded(true);
  }, [storageKey]);
  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(storageKey, JSON.stringify(guesses)); } catch {}
  }, [guesses, storageKey, loaded]);
  useEffect(() => {
    if (a.headshot) new Image().src = bigPhoto(a.headshot);
  }, [a.headshot]);

  const won = guesses.includes(a.name);
  const over = won || guesses.length >= TRIES;
  const wrong = guesses.filter((g) => g !== a.name).length;
  const total = mystery.clues.length;
  // the opening clues are sized so the last of them shows up by the last try
  const first = Math.max(2, total - (TRIES - 1));
  const shown = over ? total : Math.min(total, first + wrong);
  const byName = useMemo(() => new Map(mystery.field.map((d) => [d.name, d])), [mystery.field]);
  const garages = useMemo(() => {
    const m = new Map<string, MysteryDriverRow[]>();
    for (const d of mystery.field) m.set(d.team, [...(m.get(d.team) ?? []), d]);
    return [...m.entries()].sort((x, y) => x[0].localeCompare(y[0]));
  }, [mystery.field]);
  const t = tone(a.colour);
  const face = a.headshot ? bigPhoto(a.headshot) : null;
  const verdict = won ? VERDICTS[Math.min(guesses.length, TRIES) - 1] : null;
  const marks = guesses.map((g) => (g === a.name ? "hit" : "miss") as "hit" | "miss");
  const score = `${won ? guesses.length : "X"}/${TRIES}`;
  const last = guesses[guesses.length - 1];

  const lockIn = () => {
    if (!sel || over || guesses.includes(sel)) return;
    const pick = sel;
    setGuesses((g) => [...g, pick]);
    setSel(null);
    // the answer to a guess is up at the clues (or, if it was him, the stage)
    requestAnimationFrame(() => {
      // a guess that ends the game goes back up to the stage, where the
      // answer is; any other goes to the clues, where the next one opened
      const ends = pick === a.name || guesses.length + 1 >= TRIES;
      const target = ends ? topRef.current : fileRef.current;
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const shareText = [
    `Racing Simplified · ${gp} · Mystery driver ${score}`,
    marks.map((m) => (m === "hit" ? "🟩" : "🟥")).join(""),
  ].join("\n");
  const flash = (s: string) => { setNote(s); setTimeout(() => setNote(null), 2200); };
  const card = () => drawCard({ gp, session: mystery.session, marks, verdict: verdict?.title ?? "He got away", score });
  const share = async () => {
    const blob = await card().catch(() => null);
    const file = blob ? new File([blob], "mystery-driver.png", { type: "image/png" }) : null;
    try {
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: shareText });
        return;
      }
      if (navigator.share) { await navigator.share({ text: shareText }); return; }
    } catch { return; }
    try { await navigator.clipboard.writeText(shareText); flash("Copied. Paste it in the group chat."); } catch {}
  };
  const save = async () => {
    const blob = await card().catch(() => null);
    if (!blob) return;
    const u = URL.createObjectURL(blob);
    const l = document.createElement("a");
    l.href = u; l.download = `mystery-driver-${gp.toLowerCase().replace(/\s+/g, "-")}.png`; l.click();
    setTimeout(() => URL.revokeObjectURL(u), 4000);
    flash("Saved. Ready for your Stories.");
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(shareText); flash("Copied. Paste it in the group chat."); } catch {}
  };

  if (free && test) return <BlindTest test={test} backTo={storyHref.replace(/\/[^/]+$/, "/activities")} />;

  const Dir = ({ k, d, up, down, same }: { k: string; d: "up" | "down" | "same" | null; up: string; down: string; same: string }) =>
    d === null ? <span className="myst-cell" data-k={k}>-</span> :
    d === "same" ? <span className="myst-cell is-hit" data-k={k}><b>=</b>{same}</span> :
    <span className="myst-cell" data-k={k}><b>{d === "up" ? "▲" : "▼"}</b>{d === "up" ? up : down}</span>;

  return (
    <main className={`myst${over ? (won ? " is-won" : " is-lost") : ""}`} style={{ ["--team" as string]: t }}>
      {/* ============ the stage ============ */}
      <section className="myst-stage" ref={topRef}>
        <div className="myst-mood" data-par="0.12"><Blur src={MOOD.pilot} className="mood-pilot" /></div>
        <Speedlines n={7} />
        <Beam className="myst-beam" />
        <span className="myst-flood" aria-hidden />
        {over && <div className="myst-ghostnum" aria-hidden>{a.number}</div>}

        <header className="myst-head" data-fx="left">
          <span className="myst-eyebrow">
            Activity 01 <em>//</em> {gp} · {mystery.session}
          </span>
          {over ? (
            <h1 className="myst-h1 myst-name">
              <span className="myst-name-k">{won ? "Lights out. It was" : "He got away. It was"}</span>
              <span className="myst-name-v">{a.name}</span>
            </h1>
          ) : (
            <h1 className="myst-h1">
              <span>Who is</span>
              <span className="glow">the mystery</span>
              <span>driver?</span>
            </h1>
          )}
          {over ? (
            <p className="myst-lede">
              {a.team} · #{a.number} · started P{a.start ?? "-"}, {a.stops} stop{a.stops === 1 ? "" : "s"},{" "}
              {a.passes} pass{a.passes === 1 ? "" : "es"} on track.
            </p>
          ) : (
            <ol className="myst-how">
              <li><b>01</b><span>One driver from this race is hidden. Same one for everybody.</span></li>
              <li><b>02</b><span>Read the clues, then pick him in the garages and lock it in.</span></li>
              <li><b>03</b><span>Miss, and a red light comes on and a new clue opens. Six lights and he gets away.</span></li>
            </ol>
          )}
        </header>

        <figure className="myst-who" aria-label={over ? a.name : "The mystery driver"}>
          <span className="myst-rim" aria-hidden />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="myst-ghost" src={GHOST} alt="" aria-hidden />
          {!over && <span className="myst-scan" aria-hidden />}
          {!over && <span className="myst-q" aria-hidden>?</span>}
          {over && face && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="myst-face" src={face} alt={a.name} />
          )}
        </figure>

        <div className="myst-lights">
          <Gantry lit={wrong} out={won} all={over && !won} />
          <span className="myst-lights-k">
            {won ? "Lights out" : over ? "Six lights, no driver" : `${TRIES - guesses.length} of ${TRIES} tries left`}
            <em>{won ? ` · got him in ${guesses.length}` : over ? "" : " · every miss lights one"}</em>
          </span>
        </div>
      </section>

      {/* ============ the result ============ */}
      {over && (
        <section className="myst-result">
          <div className="myst-band" data-fx="left">
            <span className="myst-band-k">Verdict <em>//</em> {score}</span>
            <h2 className="myst-band-v">{verdict ? verdict.title : "He got away"}</h2>
            <p className="myst-band-line">
              {verdict ? verdict.line : "Six tries and he stayed hidden. His race is the reason why."}
            </p>
          </div>
          <div className="myst-after">
            <blockquote className="myst-quote" data-fx="right">
              <span>Why him</span>
              {a.tell[0].toUpperCase() + a.tell.slice(1)}.
            </blockquote>
            <div className="myst-share" data-fx="right">
              <div className="myst-card" aria-label="The card you share: no name, no result">
                <span className="myst-card-k">Racing Simplified // Activity 01</span>
                <span className="myst-card-gp">{gp} · {mystery.session}</span>
                <b>Mystery<br /><span className="glow">driver</span></b>
                <span className="myst-card-lights">
                  {Array.from({ length: TRIES }, (_, i) => (
                    <i key={i} className={marks[i] ?? ""} />
                  ))}
                </span>
                <strong>{score}</strong>
                <em>{verdict ? verdict.title : "He got away"}</em>
              </div>
              <div className="myst-share-do">
                <span className="myst-share-k">No names, no spoilers. Send it.</span>
                <button className="bt-go" onClick={share}>Share the card <i aria-hidden>→</i></button>
                <div className="myst-share-row">
                  <button className="myst-link" onClick={save}>Save image</button>
                  <button className="myst-link" onClick={copy}>Copy the squares</button>
                </div>
                {note && <span className="myst-note" role="status">{note}</span>}
              </div>
            </div>
            <nav className="myst-next" data-fx="left">
              <Link href={storyHref} className="myst-door">
                <span>Read his race</span>
                <b>Every moment, in order</b>
                <i aria-hidden>→</i>
              </Link>
              {test && test.rounds.length >= 3 && (
                <button className="myst-door" onClick={() => setFree(true)}>
                  <span>Free mode</span>
                  <b>The blind test: five more drivers</b>
                  <i aria-hidden>→</i>
                </button>
              )}
            </nav>
          </div>
        </section>
      )}

      {/* ============ the file ============ */}
      <section className="myst-file" ref={fileRef}>
        {!over && last && last !== a.name && (
          <div className="myst-news" role="status" style={{ ["--tc" as string]: tone(byName.get(last)?.colour, "#555") }}>
            <b>Not {last}.</b>
            <span>
              Light {wrong} of {TRIES} is on{shown > first + wrong - 1 && wrong > 0 ? `, and clue ${String(shown).padStart(2, "0")} just opened` : ""}.
              {" "}Check how he compares in your calls below.
            </span>
          </div>
        )}
        <header className="myst-sec">
          <span>{over ? "The full file" : "The clues"}</span>
          <em>{shown} of {total} open</em>
        </header>
        <ol className="myst-clues">
          {mystery.clues.slice(0, shown).map((c, i) => {
            const fresh = !over && wrong > 0 && shown === first + wrong && i === shown - 1;
            return (
              <li
                key={c.k}
                className={`myst-clue${fresh ? " is-new" : ""}${c.kind === "tell" ? " is-wide" : ""}${c.k === "Finish" ? " is-last" : ""}`}
              >
                {!fresh && <span className="myst-clue-n">{String(i + 1).padStart(2, "0")}</span>}
                <span className="myst-clue-k"><Term label={c.k} /></span>
                <span className="myst-clue-v"><ClueFace c={c} /></span>
                {fresh && <span className="myst-clue-new">New</span>}
              </li>
            );
          })}
        </ol>
        {shown < total && (
          <div className="myst-locked">
            <span className="myst-locked-slots" aria-hidden>
              {Array.from({ length: total - shown }, (_, i) => (
                <i key={i}>{String(shown + i + 1).padStart(2, "0")}</i>
              ))}
            </span>
            <span>
              {total - shown} more clue{total - shown === 1 ? "" : "s"} locked. Each miss opens the next one,
              and the last ones give him away.
            </span>
          </div>
        )}

        {guesses.length > 0 && (
          <div className="myst-tower">
            <header className="myst-sec">
              <span>Your calls</span>
              <em>how the mystery driver compares with each guess</em>
            </header>
            <div className="myst-row myst-row-head" aria-hidden>
              <span>#</span><span>Your guess</span><span>Team</span><span>On the grid he</span><span>In the pits he</span><span>On track he</span>
            </div>
            <ol>
              {guesses.map((g, i) => {
                const row = byName.get(g);
                if (!row) return null;
                const hit = g === a.name;
                return (
                  <li key={g} className={`myst-row${hit ? " is-win" : ""}`} style={{ ["--tc" as string]: tone(row.colour, "#555") }}>
                    <span className="myst-row-n">{i + 1}</span>
                    <b>{row.name}</b>
                    <span className={`myst-cell${row.team === a.team ? " is-hit" : ""}`} data-k="Team">
                      <b>{row.team === a.team ? "=" : "≠"}</b>{row.team === a.team ? "same team" : "other team"}
                    </span>
                    {/* grid slots count down the field: a smaller number is further up */}
                    <Dir k="On the grid he" d={cmp(row.start, a.start)} up="started ahead" down="started behind" same="same slot" />
                    <Dir k="In the pits he" d={cmp(a.stops, row.stops)} up="stopped more" down="stopped less" same="same stops" />
                    <Dir k="On track he" d={cmp(a.passes, row.passes)} up="passed more" down="passed less" same="same passes" />
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </section>

      {/* ============ the garages ============ */}
      {!over && (
        <section className="myst-garages">
          <header className="myst-sec">
            <span>Pick your driver</span>
            <em>tap a driver, then lock it in · {TRIES - guesses.length} tries left</em>
          </header>
          <div className="myst-teams">
            {garages.map(([team, ds]) => (
              <div key={team} className="myst-team" style={{ ["--tc" as string]: tone(ds[0]?.colour, "#555") }}>
                <span className="myst-team-k">{team}</span>
                <div className="myst-team-cars">
                  {ds.map((d) => {
                    const used = guesses.includes(d.name);
                    return (
                      <button
                        key={d.name}
                        className={`myst-car${used ? " is-used" : ""}${sel === d.name ? " is-sel" : ""}`}
                        disabled={used}
                        aria-pressed={sel === d.name}
                        onClick={() => setSel((s) => (s === d.name ? null : d.name))}
                      >
                        {d.headshot && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={bigPhoto(d.headshot).replace("w_1000", "w_420")} alt="" loading="lazy" />
                        )}
                        <span className="myst-car-n">{d.number}</span>
                        <b>{d.name}</b>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {!over && sel && (
        <div className="myst-lock-bar" role="region" aria-label="Confirm your guess">
          <span>Your call <b>{sel}</b></span>
          <button className="bt-go" onClick={lockIn}>Lock it in <i aria-hidden>→</i></button>
          <button className="myst-link" onClick={() => setSel(null)}>Cancel</button>
        </div>
      )}
    </main>
  );
}
