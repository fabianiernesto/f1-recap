"use client";

import { useEffect, useRef } from "react";

/**
 * The cursor from Ernesto's portfolio: a dot that inverts what is under it,
 * trails the mouse and opens up over anything you can press. Only with a real
 * mouse: the native cursor is hidden once one has moved, so a phone, or a page
 * whose script never ran, keeps what it had. The loop sleeps when the dot has
 * caught up, so a still mouse costs nothing while a race is playing.
 */
const HOVERABLE = "a, button, label, select, summary, input, [role='button']";

export default function CustomCursor() {
  const dot = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!matchMedia("(hover: hover) and (pointer: fine) and (min-width: 768px)").matches) return;
    const el = dot.current;
    if (!el) return;
    const rate = matchMedia("(prefers-reduced-motion: reduce)").matches ? 1 : 0.16;
    const target = { x: -100, y: -100 }, now = { x: -100, y: -100 };
    let raf = 0, last = 0;

    const paint = () => { el.style.transform = `translate3d(${now.x}px, ${now.y}px, 0) translate(-50%, -50%)`; };
    const step = (t: number) => {
      // the same trail at 60 and at 144 frames a second
      const k = 1 - Math.pow(1 - rate, last ? Math.min(4, (t - last) / (1000 / 60)) : 1);
      last = t;
      now.x += (target.x - now.x) * k;
      now.y += (target.y - now.y) * k;
      paint();
      raf = Math.abs(target.x - now.x) + Math.abs(target.y - now.y) > 0.2 ? requestAnimationFrame(step) : 0;
    };
    const onMove = (e: MouseEvent) => {
      if (now.x === -100) {
        // the first move: the dot starts where the mouse is, and takes over from the native cursor
        now.x = e.clientX;
        now.y = e.clientY;
        document.documentElement.classList.add("has-cursor");
      }
      // 20/11/2026, Ernesto (and his friends): the dot follows the mouse exactly, no trail, so the mouse
      // never feels slower inside the site; the dot and its grow on links stay
      target.x = now.x = e.clientX;
      target.y = now.y = e.clientY;
      paint();
      el.classList.remove("is-away");
      el.classList.toggle("is-hover", !!(e.target as Element | null)?.closest?.(HOVERABLE));
      void raf; void last; void step;
    };
    const onLeave = () => el.classList.add("is-away");

    addEventListener("mousemove", onMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("mousemove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      document.documentElement.classList.remove("has-cursor");
    };
  }, []);

  return <div ref={dot} className="cursor-dot" aria-hidden />;
}
