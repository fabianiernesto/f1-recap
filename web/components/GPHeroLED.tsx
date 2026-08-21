import fs from "node:fs";
import path from "node:path";
import { Fragment } from "react";
import Link from "next/link";
import type { Track, Weekend } from "@/lib/types";

/**
 * LED hero — the template Ernesto validated, wired to real GP data.
 * Layout is measured 1:1 from his reference: logo x0-54/y0-28, car x0-95/y31-80,
 * headline 12.6vh with the second line indented, annotations top-right.
 * Per GP only the texts, the minimap and the car change.
 */

const CAR_FORMATS = ["png", "webp", "jpg"];

function carFor(slug: string): string {
  // a GP can ship its own car at public/cars/<slug>.png; otherwise the default
  for (const ext of CAR_FORMATS) {
    if (fs.existsSync(path.join(process.cwd(), "public", "cars", `${slug}.${ext}`)))
      return `/cars/${slug}.${ext}`;
  }
  return "/cars/default.png";
}

/** Shown when a circuit has not been measured yet, so the panel never lies. */
const FALLBACK_STATS = [
  { label: "Corners", value: "—", short: "Not measured yet" },
];

export default function GPHeroLED({
  weekend,
  track,
  round = 12,
}: {
  weekend: Weekend;
  track: Track;
  round?: number;
}) {
  const pts = track.points;
  const d = "M " + pts.map((p) => p[0] + " " + p[1]).join(" L ");

  // crop the viewBox to the track so the minimap fills its slot
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const pad = 30;
  const vb = [
    Math.min(...xs) - pad,
    Math.min(...ys) - pad,
    Math.max(...xs) - Math.min(...xs) + pad * 2,
    Math.max(...ys) - Math.min(...ys) + pad * 2,
  ].join(" ");

  const stats = track.stats?.length ? track.stats : FALLBACK_STATS;

  return (
    <section className="ledhero">
      <div className="ledhero-logo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/f1_pixel_logo.svg" alt="" />
      </div>

      {/* label · circuit · number. One CSS grid row per stat, with the map
          spanning the middle column, so a label can never drift from its
          number the way two loose columns did. */}
      <dl className="ledhero-notes">
        <div className="ledhero-map">
          <svg viewBox={vb} aria-hidden>
            <path d={d} fill="none" stroke="#ff1c12" strokeWidth={6} strokeLinejoin="round" />
            {track.corners.slice(0, 6).map((c) => (
              <circle key={c.label} cx={c.x} cy={c.y} r={9} fill="none"
                stroke="#ff1c12" strokeWidth={3} />
            ))}
          </svg>
        </div>
        {stats.map((s) => (
          <Fragment key={s.label}>
            <dt>{s.label}</dt>
            <dd>
              {s.value}
              {s.short && <small>{s.short}</small>}
            </dd>
          </Fragment>
        ))}
      </dl>

      <div className="ledhero-car">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={carFor(weekend.slug)} alt="" />
      </div>

      <span className="ledhero-l1">{track.circuit}</span>
      <span className="ledhero-l2">Simplified</span>
      {/* the way back out, above the tag so it reads as part of the same
          bottom-left block instead of floating on its own */}
      <Link className="ledhero-home" href="/">
        <i aria-hidden>←</i>
        All circuits
      </Link>
      <span className="ledhero-tag">Race {round} // Recap</span>

      {/* the only way in: no scroll on this screen */}
      <Link className="ledhero-enter" href={`/gp/${weekend.slug}/weekend`}>
        Enter the weekend
        <i aria-hidden>→</i>
      </Link>
    </section>
  );
}
