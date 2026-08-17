import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { listGPs, loadTrack, loadWeekend } from "@/lib/data";
import type { Track } from "@/lib/types";

/** Hero artwork for the home, dropped at public/home/driver.(png|jpg|webp).
 *  Lit-on-black images blend straight into the page with `screen`. */
function homeFigure(): string | null {
  for (const ext of ["png", "webp", "jpg", "jpeg"]) {
    if (fs.existsSync(path.join(process.cwd(), "public", "home", `driver.${ext}`)))
      return `/home/driver.${ext}`;
  }
  return null;
}

/**
 * The front door of the whole site, in the LED language of the GP heroes:
 * black ground, red signal, pixel headline — and one card per Grand Prix,
 * carrying the real silhouette of its circuit from the telemetry.
 */

function trackArt(track: Track) {
  const pts = track.points;
  const d = "M " + pts.map((p) => p[0] + " " + p[1]).join(" L ");
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const pad = 40;
  const vb = [
    Math.min(...xs) - pad,
    Math.min(...ys) - pad,
    Math.max(...xs) - Math.min(...xs) + pad * 2,
    Math.max(...ys) - Math.min(...ys) + pad * 2,
  ].join(" ");
  return { d, vb };
}

export default function Home() {
  const weekends = listGPs()
    .map((slug) => ({ weekend: loadWeekend(slug), track: loadTrack(slug) }))
    .sort((a, b) => (a.weekend.date < b.weekend.date ? 1 : -1));

  return (
    <main className="home">
      <div className="home-top">
        <span>RACE // RECAP</span>
        <span>Season 2026</span>
      </div>

      <header className="home-hero">
        {homeFigure() && (
          <div className="home-figure" aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={homeFigure()!} alt="" />
          </div>
        )}
        <h1>
          <span className="home-l1">Every race</span>
          <span className="home-l2">Simplified</span>
        </h1>
        <p>
          Missed the Grand Prix? Fell asleep on lap 30? Every weekend rebuilt
          from the official timing data and told moment by moment — pick a
          circuit and scroll the race.
        </p>
      </header>

      <section className="home-grid">
        {weekends.map(({ weekend: w, track }) => {
          const art = trackArt(track);
          const moments = w.sessions.reduce((n, s) => n + s.moments, 0);
          return (
            <Link key={w.slug} href={`/gp/${w.slug}`} className="home-card">
              <svg viewBox={art.vb} aria-hidden>
                {/* non-scaling-stroke keeps the LED dots at screen size no
                    matter how large the circuit's coordinate space is */}
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
              <span className="home-card-name">{w.circuit}</span>
              <span className="home-card-sub">
                {w.short} · {w.country}
              </span>
              <span className="home-card-meta">
                <em>{w.date}</em>
                {w.sessions.length > 0 ? (
                  <b>
                    {w.sessions.length} sessions · {moments} moments
                  </b>
                ) : (
                  <b>Analysis coming soon</b>
                )}
              </span>
              <span className="home-card-go">Enter →</span>
            </Link>
          );
        })}
      </section>

      <footer className="home-foot">
        Built from OpenF1 + FastF1 timing data · not affiliated with Formula 1
      </footer>
    </main>
  );
}
