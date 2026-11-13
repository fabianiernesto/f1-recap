"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * Every navigation on this site used to be a cut. This puts a broadcast
 * ident in front of it: the old screen is covered, the route is pushed while
 * nothing is visible, and the new one is uncovered once it has arrived.
 *
 * The cover always finishes before the push, but the reveal waits for the
 * new pathname, so a slow route holds on the mark instead of flashing
 * half-rendered content.
 */

/* These came from measuring a sound this transition used to carry: bars over
   its 210ms rise, the white frame on its peak, the mark holding through the
   sustain, the whip out over the decay. The sound is gone and the timing
   stayed, because it was the version that finally moved as one thing. */
const COVER = 400;
const REVEAL = 250;
/* 25/10/2026: the route used to be pushed only once the cover had finished,
   so every navigation paid the animation AND the load, one after the other.
   Now it is fetched the moment the link is clicked and pushed as soon as the
   bars have closed (they are in by 150ms), so the load happens behind the
   curtain while the mark is still arriving. The whole sting also runs at
   about 0.7x its old length (globals.css, "the sting"). */
const PUSH_AT = 150;
const SAFETY = 5000;

export default function PageFX() {
  const router = useRouter();
  const pathname = usePathname();
  const [phase, setPhase] = useState<"idle" | "cover" | "hold" | "reveal">("idle");
  const pending = useRef<string | null>(null);
  const from = useRef(pathname);
  /* the earliest the curtain is allowed to lift, so a slow route never
     shortens the hold and a fast one never cuts the sound off */
  const holdUntil = useRef(0);
  /* a covered screen takes no taps, so it can never be the last word: a swipe
     back under the curtain, or a route that never lands, lifts it after 5s */
  const safety = useRef(0);
  const uncover = useCallback(() => {
    clearTimeout(safety.current);
    pending.current = null;
    document.documentElement.classList.remove("fx-in");
    setPhase("idle");
  }, []);

  /* a page brought back by the browser (bfcache) comes back exactly as it left */
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => { if (e.persisted) uncover(); };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, [uncover]);

  /* the curtain comes down, then the route changes behind it */
  const go = useCallback(
    (href: string) => {
      pending.current = href;
      holdUntil.current = performance.now() + COVER;
      clearTimeout(safety.current);
      safety.current = window.setTimeout(uncover, SAFETY);
      router.prefetch(href);
      setPhase("cover");
      setTimeout(() => router.push(href), PUSH_AT);
      // only a route that is still loading once the mark is in holds on it
      setTimeout(() => setPhase((p) => (p === "cover" ? "hold" : p)), COVER);
    },
    [router, uncover]
  );

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement)?.closest?.("a");
      if (!a) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#") || a.target === "_blank") return;
      if (!href.startsWith("/")) return;
      if (href === location.pathname) return;
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      e.preventDefault();
      // a link can ask for a beat before the curtain, so a screen has room to
      // finish saying goodbye. Nothing else on the site sets this.
      const delay = Number(a.getAttribute("data-fx-delay")) || 0;
      if (delay) setTimeout(() => go(href), delay);
      else go(href);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [go]);

  /* the new page has landed: lift the curtain */
  useEffect(() => {
    if (pathname === from.current) return;
    from.current = pathname;
    if (pending.current) {
      pending.current = null;
      let t = 0, t2 = 0, lift = 0, f1 = 0;
      const reveal = () => {
        clearTimeout(safety.current);
        setPhase("reveal");
        // the arriving page settles in under the curtain rather than just
        // being there; the class is what the page-in animation hangs off
        document.documentElement.classList.add("fx-in");
        t = window.setTimeout(() => setPhase("idle"), REVEAL);
        t2 = window.setTimeout(
          () => document.documentElement.classList.remove("fx-in"),
          REVEAL + 420
        );
      };
      /* the curtain lifts once frames are flowing again. A new page's first
         paint can keep a laptop GPU busy for half a second (a hub's LED
         headline, the first time in a session), and frames simply stop
         arriving while it does; lifting then froze the bars halfway. So it
         waits for two quick frames in a row: on a fast machine that is
         immediate, on a slow one the mark holds a moment longer and the
         lift itself always runs smooth. Never more than 1.5s. */
      const t0 = performance.now();
      let last = t0, quick = 0;
      const settle = (now: number) => {
        quick = now - last < 50 ? quick + 1 : 0;
        last = now;
        if (quick >= 2 || now - t0 > 1500)
          lift = window.setTimeout(reveal, Math.max(0, holdUntil.current - performance.now()));
        else f1 = requestAnimationFrame(settle);
      };
      f1 = requestAnimationFrame(settle);
      return () => {
        cancelAnimationFrame(f1);
        clearTimeout(lift); clearTimeout(t); clearTimeout(t2);
      };
    }
  }, [pathname]);

  if (phase === "idle") return null;

  return (
    <div className={`fx fx-sting fx-${phase}`} aria-hidden>
      {/* bars first, then the impact frame, then the mark snapping in */}
      <div className="sting-bars">
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} style={{ ["--i" as string]: i }} />
        ))}
      </div>
      <div className="sting-flash" />
      <div className="sting-core">
        <div className="sting-mark">
          <span className="sting-ghost g1">R//S</span>
          <span className="sting-ghost g2">R//S</span>
          <span className="sting-face">R//S</span>
        </div>
        <div className="sting-tag">Racing Simplified</div>
      </div>
      <div className="sting-scan" />
    </div>
  );
}
