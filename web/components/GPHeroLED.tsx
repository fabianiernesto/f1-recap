import fs from "node:fs";
import path from "node:path";
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

/** What each corner of this circuit is worth knowing. */
const CORNER_NOTES: Record<string, string> = {
  COPSE: "Barely a corner at racing speed. <em>The commitment test of the lap.</em>",
  MAGGOTTS: "Four direction changes in six seconds. The best sequence in Formula 1.",
  BECKETTS: "Where the car is loaded and unloaded left to right. <em>No time to breathe.</em>",
  "HANGAR STRAIGHT": "Lowest drag, highest speed. Where the passes get set up.",
  STOWE: "Heavy braking from top speed. <em>Brave laps are won or thrown away here.</em>",
  CLUB: "The last corner. Carry speed or lose the lap at the line.",
  VILLAGE: "Slowest point of the lap. Traction out of here decides the next straight.",
  BROOKLANDS: "Long and open, easy to run wide. Patience pays more than commitment.",
  LUFFIELD: "It keeps tightening. The exit matters more than the entry.",
  ABBEY: "Flat out for the brave, straight after the start line.",
  "WELLINGTON STRAIGHT": "The first real overtaking chance of the lap.",
};

const GENERIC_NOTES: [string, string][] = [
  ["Start / Finish", "The point where every lap begins. <em>Full throttle launch.</em> Maximum reaction."],
  ["DRS zone", "Lower drag on the straight. Designed for overtaking, <em>only when the gap is close.</em>"],
  ["Braking point", "The last moment before turn-in. Maximum deceleration. Precision defines the corner."],
  ["Apex", "The innermost point of the turn, where speed meets control. <em>Hit it, gain time.</em>"],
  ["Exit line", "Power back on the throttle. Traction becomes acceleration. Every metre matters."],
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

  // real corners of this circuit, falling back to the generic racing notes
  const named = track.corners
    .map((c) => c.label)
    .filter((l) => CORNER_NOTES[l])
    .slice(0, 5);
  const notes: [string, string][] =
    named.length >= 4
      ? named.map((l) => [l, CORNER_NOTES[l]])
      : GENERIC_NOTES;

  return (
    <section className="ledhero">
      <div className="ledhero-logo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/f1_pixel_logo.svg" alt="" />
      </div>

      <div className="ledhero-notes">
        <div className="ledhero-labels">
          {notes.map(([label]) => (
            <div key={label}>{label}</div>
          ))}
        </div>
        <div className="ledhero-map">
          <svg viewBox={vb} aria-hidden>
            <path d={d} fill="none" stroke="#ff1c12" strokeWidth={6} strokeLinejoin="round" />
            {track.corners.slice(0, 6).map((c) => (
              <circle key={c.label} cx={c.x} cy={c.y} r={9} fill="none"
                stroke="#ff1c12" strokeWidth={3} />
            ))}
          </svg>
        </div>
        <div className="ledhero-caps">
          {notes.map(([label, text]) => (
            <div key={label} dangerouslySetInnerHTML={{ __html: text }} />
          ))}
        </div>
      </div>

      <div className="ledhero-car">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={carFor(weekend.slug)} alt="" />
      </div>

      <span className="ledhero-l1">{track.circuit}</span>
      <span className="ledhero-l2">Simplified</span>
      <span className="ledhero-tag">Race {round} // Recap</span>

      {/* the only way in: no scroll on this screen */}
      <Link className="ledhero-enter" href={`/gp/${weekend.slug}/weekend`}>
        Enter the weekend
        <i aria-hidden>→</i>
      </Link>
    </section>
  );
}
