import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { activitiesFor } from "@/lib/data";
import GPBoard, { type Channel } from "./GPBoard";
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

  /* The channels. Availability uses the same tests the activity chooser runs,
     so the two screens can never disagree about which doors exist, and a door
     that does not exist is not advertised. Words are capped at ten characters
     so line 2 keeps its optical mass whichever one is showing. */
  const acts = activitiesFor(weekend.slug, weekend);
  const cap = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

  /* SCROLLED comes first on the rail because the weekend is the main event,
     but the screen still lands on SIMPLIFIED: that is the brand, and the
     composition signed off with that word under the circuit's name. */
  const scrolled: Channel | null = acts.scroll
    ? {
        n: "01",
        word: "Scrolled",
        label: "Scrolled",
        href: `/gp/${weekend.slug}/sessions`,
        cta: "Scroll the weekend",
        map: "lap",
        rows: [
          { label: "Sessions", value: String(acts.sessions),
            short: "Every session of the weekend, from first practice to the flag" },
          { label: "Moments", value: String(acts.moments),
            short: "One card each, in the order they happened" },
          { label: "Longest", value: acts.longest
              ? `${acts.longest.label} ${acts.longest.moments}` : "—",
            short: "The session with the most to say for itself" },
          { label: "Laps", value: String(acts.laps),
            short: "The circuit draws itself underneath you as you read" },
          { label: "Alfred", value: String(acts.alfred),
            short: "Sessions he can answer questions about, in his own words" },
        ],
        read: [
          `${acts.sessions} sessions · ${acts.moments} moments`,
          "The circuit draws itself as you scroll",
          acts.alfred
            ? `Ask Alfred on ${acts.alfred} of them`
            : "Told from the timing data, moment by moment",
        ],
      }
    : null;

  const simplified: Channel = {
    n: scrolled ? "02" : "01",
    word: "Simplified",
    label: "Simplified",
    href: `/gp/${weekend.slug}/activities`,
    cta: "See the activities",
    map: "corners",
    rows: stats.map((s) => ({
      label: s.label, value: s.value, short: cap(s.short ?? "", 62),
    })),
    read: [
      `${weekend.date} · ${weekend.short}`,
      acts.blind
        ? `${acts.blind.rounds} sheets to guess at, and more on the way`
        : "The activities arrive with the timing data",
      `${weekend.laps} laps · ${weekend.circuit}`,
    ],
  };

  const channels: Channel[] = scrolled ? [scrolled, simplified] : [simplified];
  const start = channels.indexOf(simplified);

  return (
    <section className="ledhero">
      <div className="ledhero-logo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/f1_pixel_logo.svg" alt="" />
      </div>

      <div className="ledhero-car">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={carFor(weekend.slug)} alt="" />
      </div>

      <span className="ledhero-l1">{track.circuit}</span>

      {/* the way back out, above the tag so it reads as part of the same
          bottom-left block instead of floating on its own */}
      <Link className="ledhero-home" href="/">
        <i aria-hidden>←</i>
        All circuits
      </Link>
      <span className="ledhero-tag">Race {round} // Simplified</span>

      {/* the panel, line 2, the readout, the rail and the way in: all of
          them absolutely positioned siblings, so the validated coordinates
          keep working exactly as they are */}
      <GPBoard channels={channels} start={start} track={track} d={d} vb={vb} />

    </section>
  );
}
