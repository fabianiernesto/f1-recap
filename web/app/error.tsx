"use client";

import Link from "next/link";
import { useEffect } from "react";

/** A page that breaks gets the 404's board and a way out, not a blank screen. */
export default function PageError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="lost">
      <div className="lost-copy">
        <span className="lost-k">Error</span>
        <h1>
          <span>Red</span>
          <span className="glow">flag</span>
        </h1>
        <p>This page stopped working. Try it again, or pick another race from the home.</p>
        <div className="lost-go">
          <button type="button" className="home-go" style={{ cursor: "pointer" }} onClick={() => retry()}>Try again <i aria-hidden>→</i></button>
          <Link href="/" className="lost-alt">Back home</Link>
        </div>
      </div>
    </main>
  );
}
