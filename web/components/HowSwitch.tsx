"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * How it works, as two doors instead of two floors.
 *
 * The page used to explain Scrolled and then Simplified, one under the other,
 * and you scrolled past both. Now the two doors sit side by side at the top
 * of the section, you pick one, and only that explanation opens underneath.
 * The other stays a door. Nothing is hidden from a reader without JavaScript:
 * the server renders Scrolled open.
 */
export default function HowSwitch({
  scrolled,
  simplified,
  doors,
}: {
  scrolled: ReactNode;
  simplified: ReactNode;
  doors: { key: "scrolled" | "simplified"; n: string; name: string; line: string }[];
}) {
  const [open, setOpen] = useState<"scrolled" | "simplified" | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open && panel.current) panel.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [open]);
  return (
    <>
      <div className="how-doors" role="tablist" aria-label="Two ways through a Grand Prix">
        {doors.map((d) => (
          <button
            key={d.key}
            type="button"
            role="tab"
            aria-selected={open === d.key}
            className={`how-door how-door-${d.key}`}
            onClick={() => setOpen((o) => (o === d.key ? null : d.key))}
          >
            <b>{d.n}</b>
            <span>{d.name}</span>
            <em>{d.line}</em>
            <i aria-hidden>{open === d.key ? "Close" : "Open"}</i>
          </button>
        ))}
      </div>
      {open && (
        <div className="how-panel" role="tabpanel" key={open} ref={panel}>
          {open === "scrolled" ? scrolled : simplified}
        </div>
      )}
    </>
  );
}
