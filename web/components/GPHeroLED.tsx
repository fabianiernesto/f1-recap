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

  const channels: Channel[] = [
    {
      n: "00",
      word: "Simplified",
      label: "Simplified",
      href: "#ways-in",
      cta: "See the ways in",
      map: "corners",
      rows: stats.map((s) => ({
        label: s.label, value: s.value, short: cap(s.short ?? "", 62),
      })),
      read: [
        `${weekend.date} · ${weekend.short}`,
        acts.scroll
          ? `${acts.sessions} sessions · ${acts.moments} moments on the board`
          : "Timing data still to come",
        `${weekend.laps} laps · ${weekend.circuit}`,
      ],
    },
  ];

  if (acts.scroll)
    channels.push({
      n: "01",
      word: "Scroll it",
      label: "Scroll it",
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
    });

  if (acts.blind)
    channels.push({
      n: String(channels.length).padStart(2, "0"),
      word: "Blind test",
      label: "Blind test",
      href: `/gp/${weekend.slug}/${acts.blind.session}/blind`,
      cta: "Start the blind test",
      map: "blank",
      rows: [
        { label: "Sheets", value: String(acts.blind.rounds),
          short: "Real afternoons with the name taken off the top" },
        { label: "Options", value: String(acts.blind.options),
          short: "Four names, and only the numbers to tell them apart" },
        { label: "Clues", value: String(acts.blind.clues),
          short: "Grid, stops, tyres, pace, and what the stewards made of him" },
        { label: "Source", value: acts.blind.session.toUpperCase(),
          short: "Drawn from the session that had the most happen in it" },
        { label: "Names", value: "None",
          short: "The circuit loses its corner names for this one too" },
      ],
      read: [
        `${acts.blind.rounds} sheets · no names`,
        "Read the numbers and tell me who you are looking at",
        "Five drawn at random, so a second run is a different test",
      ],
    });

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
      <GPBoard channels={channels} track={track} d={d} vb={vb} />

    </section>
  );
}
