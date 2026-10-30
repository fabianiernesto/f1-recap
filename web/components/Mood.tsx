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

/** Trails baked by scripts/bake_trails.py: the same blur, colour and
 *  brightness as the live filter, drawn once instead of every frame. Only
 *  photographs shown at their own proportions are here (see the script). */
const BAKED: Record<string, string> = {
  [MOOD.helmet]: "/home/mood/trails/helmet",
  [MOOD.car]: "/home/mood/trails/car-top",
  [MOOD.glovesSmoke]: "/home/mood/trails/helmet-guantes-c",
};

/** A photograph with a smeared copy of itself dragging behind it. `lazy`
 *  keeps a photograph out of the page's preloads: the 404's was being
 *  preloaded on every page of the site, because Next ships that page with
 *  all of them. */
export function Blur({ src, className = "", lazy = false }: { src: string; className?: string; lazy?: boolean }) {
  const loading = lazy ? "lazy" : undefined;
  const baked = BAKED[src];
  return (
    <div className={`mood ${className}`} aria-hidden>
      {baked ? (
        <picture>
          <source media="(max-width: 900px)" srcSet={`${baked}-m.webp`} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="mood-trail is-baked" src={`${baked}-d.webp`} alt="" loading={loading} decoding="async" />
        </picture>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="mood-trail" src={src} alt="" loading={loading} />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="mood-img" src={src} alt="" loading={loading} />
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
