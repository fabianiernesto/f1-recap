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
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!still) root.classList.add("fx-ready");

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

    const par = still ? [] : Array.from(document.querySelectorAll<HTMLElement>("[data-par]"));
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
    // the sideways strips: our own bar instead of the browser's (which the
    // tilt turned into a staircase), and the strip itself can be dragged
    const offs: Array<() => void> = [];
    let dragged = false;
    document.querySelectorAll<HTMLElement>("[data-strip]").forEach((track) => {
      const bar = track.parentElement?.querySelector<HTMLElement>("[data-strip-bar]");
      const sync = () => {
        const max = track.scrollWidth - track.clientWidth;
        bar?.style.setProperty("--w", String(Math.min(1, track.clientWidth / track.scrollWidth)));
        bar?.style.setProperty("--p", String(max > 0 ? track.scrollLeft / max : 0));
      };
      sync();
      track.addEventListener("scroll", sync, { passive: true });
      window.addEventListener("resize", sync);

      // the bar: press anywhere on it and slide
      const seek = (x: number) => {
        if (!bar) return;
        const r = bar.getBoundingClientRect();
        const w = track.clientWidth / track.scrollWidth;
        const f = (x - r.left) / r.width - w / 2;
        track.scrollLeft = Math.max(0, Math.min(1, f / (1 - w || 1))) * (track.scrollWidth - track.clientWidth);
      };
      const onBarDown = (e: PointerEvent) => {
        if (!bar) return;
        bar.setPointerCapture(e.pointerId);
        track.style.scrollSnapType = "none";
        seek(e.clientX);
        const move = (ev: PointerEvent) => seek(ev.clientX);
        const up = () => {
          bar.removeEventListener("pointermove", move);
          bar.removeEventListener("pointerup", up);
          track.style.scrollSnapType = "";
        };
        bar.addEventListener("pointermove", move);
        bar.addEventListener("pointerup", up);
      };
      bar?.addEventListener("pointerdown", onBarDown);

      // the strip: grab and throw it, with the mouse; touch scrolls natively
      const onDown = (e: PointerEvent) => {
        if (e.pointerType !== "mouse" || e.button !== 0) return;
        const x0 = e.clientX, s0 = track.scrollLeft;
        dragged = false;
        track.style.scrollSnapType = "none";
        track.classList.add("is-grab");
        const move = (ev: PointerEvent) => {
          const dx = ev.clientX - x0;
          if (Math.abs(dx) > 5) dragged = true;
          track.scrollLeft = s0 - dx;
        };
        const up = () => {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
          track.style.scrollSnapType = "";
          track.classList.remove("is-grab");
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
      };
      track.addEventListener("pointerdown", onDown);
      track.addEventListener("dragstart", (e) => e.preventDefault());
      offs.push(() => {
        track.removeEventListener("scroll", sync);
        window.removeEventListener("resize", sync);
        track.removeEventListener("pointerdown", onDown);
        bar?.removeEventListener("pointerdown", onBarDown);
      });
    });
    // a drag is not a click: stop it before the page transition sees it
    const eatClick = (e: MouseEvent) => {
      if (!dragged) return;
      dragged = false;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener("click", eatClick, true);

    return () => {
      offs.forEach((f) => f());
      window.removeEventListener("click", eatClick, true);
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
      root.classList.remove("fx-ready");
    };
  }, []);
  return null;
}
