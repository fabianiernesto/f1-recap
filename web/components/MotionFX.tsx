"use client";

import { useEffect } from "react";

/**
 * Speed on scroll. Anything marked data-fx arrives the way the horse in the
 * moodboard does: dragged in from the side, smeared, and then sharp. Anything
 * marked data-par drifts against the scroll at its own rate, so the pictures
 * and the type never move as one flat sheet.
 *
 * The page renders complete without this: the hidden starting state only
 * applies once <html> carries .fx-ready, which this component adds.
 */
export default function MotionFX() {
  useEffect(() => {
    const root = document.documentElement;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    root.classList.add("fx-ready");

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.18, rootMargin: "0px 0px -6% 0px" }
    );
    document.querySelectorAll("[data-fx]").forEach((el) => io.observe(el));

    const par = Array.from(document.querySelectorAll<HTMLElement>("[data-par]"));
    let raf = 0;
    const tick = () => {
      raf = 0;
      const vh = window.innerHeight;
      for (const el of par) {
        const r = el.getBoundingClientRect();
        if (r.bottom < -vh || r.top > vh * 2) continue;
        const k = Number(el.dataset.par) || 0.15;
        // distance of the element's centre from the middle of the screen
        const off = (r.top + r.height / 2 - vh / 2) * -k;
        el.style.setProperty("--par", `${off.toFixed(1)}px`);
      }
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(tick); };
    tick();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
      root.classList.remove("fx-ready");
    };
  }, []);
  return null;
}
