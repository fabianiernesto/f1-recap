"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FX_DEFAULT, FX_KEY, type FXVariant } from "./PageFX";

const OPTIONS: { id: FXVariant; name: string; line: string; note: string }[] = [
  {
    id: "sting",
    name: "The sting",
    line: "Bars, impact frame, the mark lands",
    note: "A broadcast ident. Five skewed bars rip across at different speeds, "
        + "one white frame marks the hit, and R//R snaps in out of focus with "
        + "its colour channels apart, then pulls sharp and whips away left.",
  },
  {
    id: "lights",
    name: "Lights out",
    line: "Five reds, one by one, then black",
    note: "The start procedure every fan already knows by heart. Slowest of "
        + "the three at about six tenths, and the only one that feels like a "
        + "ritual rather than an effect.",
  },
  {
    id: "sweep",
    name: "Light trail",
    line: "One red streak wipes the screen",
    note: "A car going past you at night. Quickest of the three, four tenths, "
        + "and it never gets in the way when you are clicking around.",
  },
  {
    id: "grid",
    name: "LED curtain",
    line: "The dot matrix floods in and drains",
    note: "The hero's own pixels take over the screen. Sits between the other "
        + "two on speed and ties hardest to the identity.",
  },
];

export default function FXPicker() {
  const [current, setCurrent] = useState<FXVariant>(FX_DEFAULT);

  useEffect(() => {
    const saved = localStorage.getItem(FX_KEY) as FXVariant | null;
    if (saved) setCurrent(saved);
  }, []);

  const pick = (id: FXVariant) => {
    localStorage.setItem(FX_KEY, id);
    setCurrent(id);
    dispatchEvent(new CustomEvent("f1recap:fx", { detail: id }));
  };

  return (
    <main className="home">
      <div className="home-top">
        <span>RACE // RECAP</span>
        <span>Transitions</span>
      </div>

      <header className="home-hero">
        <h1>
          <span className="home-l1">Pick a</span>
          <span className="home-l2">Curtain</span>
        </h1>
        <p>
          Choose one, then use the links underneath to move around the site and
          feel it on a real navigation. The choice sticks in this browser, so
          you can live with it for a while before it becomes the only one.
        </p>
      </header>

      <section className="home-grid">
        {OPTIONS.map((o) => (
          <button
            key={o.id}
            className={`fxcard${current === o.id ? " on" : ""}`}
            onClick={() => pick(o.id)}
          >
            <span className="fxcard-name">{o.name}</span>
            <span className="fxcard-line">{o.line}</span>
            <span className="fxcard-note">{o.note}</span>
            <span className="fxcard-state">
              {current === o.id ? "● Selected" : "Select"}
            </span>
          </button>
        ))}
      </section>

      <nav className="fxtry">
        <span>Try it on</span>
        <Link href="/">The home</Link>
        <Link href="/gp/silverstone-2026">Silverstone front door</Link>
        <Link href="/gp/silverstone-2026/weekend">The weekend</Link>
        <Link href="/gp/silverstone-2026/race">The race</Link>
      </nav>
    </main>
  );
}
