"use client";

import { useEffect, useId, useRef, useState } from "react";
import { lookUp } from "@/lib/glossary";

/**
 * A label that explains itself.
 *
 * Any label with an entry in the glossary picks up a dotted underline and says
 * what it means on hover, on tap or on keyboard focus. Anything without one
 * renders as plain text, so wrapping a label is always safe and a term nobody
 * has written yet simply looks normal.
 *
 * Built on a real button rather than a div with a hover state, so a keyboard
 * reaches it and a screen reader announces it. The panel is a sibling shown by
 * CSS, with one flag of state for the tap and no portal.
 */
export default function Term({
  label,
  className = "",
}: {
  label: string;
  className?: string;
}) {
  // not the label: most have spaces, which aria-describedby reads as two ids
  const id = useId();
  const entry = lookUp(label);
  /* a tap opens and closes it: a phone has no hover to leave, and Safari does
     not focus a button when it is tapped */
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);
  if (!entry) return <>{label}</>;

  return (
    <span ref={box} className={`term${open ? " is-open" : ""} ${className}`}>
      <button type="button" className="term-word" aria-describedby={id} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {label}
      </button>
      <span className="term-pop" id={id} role="tooltip">
        <b>{label}</b>
        <span>{entry.short}</span>
        {entry.why && <em>{entry.why}</em>}
      </span>
    </span>
  );
}
