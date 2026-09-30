/**
 * The site's speed kit, shared by every page that is not a circuit's own
 * front door: the moodboard photographs, a photograph with its smeared copy
 * dragging behind it, the red tear between sections, the speed lines, and
 * the neon tube. Plain markup, so server and client components can both use
 * it; the motion lives in globals.css and MotionFX.
 */

/** The moodboard: red and black, shot at speed. */
export const MOOD = {
  helmet: "/home/mood/helmet.jpg",
  car: "/home/mood/car-top.jpg",
  horse: "/home/mood/horse.jpg",
  tyre: "/home/mood/tyre.jpg",
  // the second shoot, so no page wears the same photograph as the home
  gloves: "/home/mood/nuevas/helmet-guantes-a.webp",
  glovesSmoke: "/home/mood/nuevas/helmet-guantes-c.webp",
  pilot: "/home/mood/nuevas/helmet-guantes-vertical.webp",
  rain: "/home/mood/nuevas/coche-lluvia-trasera.webp",
};

/** A photograph with a smeared copy of itself dragging behind it. */
export function Blur({ src, className = "" }: { src: string; className?: string }) {
  return (
    <div className={`mood ${className}`} aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="mood-trail" src={src} alt="" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="mood-img" src={src} alt="" />
    </div>
  );
}

/** A red line that tears across the page between two sections. */
export function Streak({ flip = false }: { flip?: boolean }) {
  return (
    <div className={`streak${flip ? " streak-flip" : ""}`} data-fx="streak" aria-hidden>
      <i />
      <i />
      <i />
    </div>
  );
}

/** Light streaking across a dark stage. */
export function Speedlines({ n = 7 }: { n?: number }) {
  return (
    <div className="speedlines" aria-hidden>
      {Array.from({ length: n }, (_, i) => (
        <i key={i} style={{ ["--i" as string]: i }} />
      ))}
    </div>
  );
}

/** The neon tube cutting the frame on a diagonal. */
export function Beam({ className = "" }: { className?: string }) {
  return (
    <div className={`cross-beam ${className}`} data-fx="beam" aria-hidden>
      <i className="beam-tube" />
      <i className="beam-haze" />
      <i className="beam-pulse" />
    </div>
  );
}
