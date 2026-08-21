"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * Every navigation on this site used to be a cut. This puts a curtain in
 * front of it: the old screen is covered, the route is pushed while nothing
 * is visible, and the new one is uncovered once it has actually arrived.
 *
 * Three curtains, because the right one is a matter of taste:
 *   lights  the start procedure, five reds lit one by one and then blackout
 *   sweep   a car going past at night, one red streak wiping the screen
 *   grid    the dot matrix of the hero flooding in and draining away
 *
 * The cover always finishes before the push, but the reveal waits for the
 * new pathname, so a slow route holds the curtain instead of flashing.
 */

export type FXVariant = "lights" | "sweep" | "grid";
export const FX_KEY = "f1recap:fx";
export const FX_DEFAULT: FXVariant = "lights";

const COVER = { lights: 620, sweep: 430, grid: 470 };
const REVEAL = { lights: 340, sweep: 400, grid: 440 };

export default function PageFX() {
  const router = useRouter();
  const pathname = usePathname();
  const [variant, setVariant] = useState<FXVariant>(FX_DEFAULT);
  const [phase, setPhase] = useState<"idle" | "cover" | "hold" | "reveal">("idle");
  const pending = useRef<string | null>(null);
  const from = useRef(pathname);

  useEffect(() => {
    const saved = localStorage.getItem(FX_KEY) as FXVariant | null;
    if (saved) setVariant(saved);
    const onPick = (e: Event) => setVariant((e as CustomEvent).detail as FXVariant);
    addEventListener("f1recap:fx", onPick);
    return () => removeEventListener("f1recap:fx", onPick);
  }, []);

  /* the curtain comes down, then the route changes behind it */
  const go = useCallback(
    (href: string) => {
      pending.current = href;
      setPhase("cover");
      setTimeout(() => {
        setPhase("hold");
        router.push(href);
      }, COVER[variant]);
    },
    [router, variant]
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
      go(href);
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
      setPhase("reveal");
      const t = setTimeout(() => setPhase("idle"), REVEAL[variant]);
      return () => clearTimeout(t);
    }
  }, [pathname, variant]);

  if (phase === "idle") return null;

  return (
    <div className={`fx fx-${variant} fx-${phase}`} aria-hidden>
      <div className="fx-veil" />
      {variant === "lights" && (
        <div className="fx-bulbs">
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} style={{ ["--i" as string]: i }} />
          ))}
        </div>
      )}
      {variant === "sweep" && <div className="fx-streak" />}
    </div>
  );
}
