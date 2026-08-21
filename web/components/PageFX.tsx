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

const COVER = 640;
const REVEAL = 420;

export default function PageFX() {
  const router = useRouter();
  const pathname = usePathname();
  const [phase, setPhase] = useState<"idle" | "cover" | "hold" | "reveal">("idle");
  const pending = useRef<string | null>(null);
  const from = useRef(pathname);

  /* the curtain comes down, then the route changes behind it */
  const go = useCallback(
    (href: string) => {
      pending.current = href;
      setPhase("cover");
      setTimeout(() => {
        setPhase("hold");
        router.push(href);
      }, COVER);
    },
    [router]
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
      // the arriving page settles in under the curtain rather than just being
      // there; the class is what the page-in animation hangs off
      document.documentElement.classList.add("fx-in");
      const t = setTimeout(() => setPhase("idle"), REVEAL);
      const t2 = setTimeout(
        () => document.documentElement.classList.remove("fx-in"),
        REVEAL + 420
      );
      return () => { clearTimeout(t); clearTimeout(t2); };
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
