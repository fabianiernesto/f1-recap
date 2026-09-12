"use client";

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
 * CSS: no state, no portal, nothing to hydrate, which matters on a page that
 * may hold thirty of these.
 */
export default function Term({
  label,
  className = "",
}: {
  label: string;
  className?: string;
}) {
  const entry = lookUp(label);
  if (!entry) return <>{label}</>;

  return (
    <span className={`term ${className}`}>
      <button type="button" className="term-word" aria-describedby={`gl-${label}`}>
        {label}
      </button>
      <span className="term-pop" id={`gl-${label}`} role="tooltip">
        <b>{label}</b>
        <span>{entry.short}</span>
        {entry.why && <em>{entry.why}</em>}
      </span>
    </span>
  );
}
