import Link from "next/link";
import { Blur, MOOD, Speedlines } from "@/components/Mood";

/** A wrong turn gets the same board as everything else, and a way back. */
export default function NotFound() {
  return (
    <main className="lost">
      <div className="lost-helmet" aria-hidden>
        <Blur src={MOOD.glovesSmoke} className="mood-helmet mood-soft" lazy />
      </div>
      <Speedlines n={6} />
      <div className="lost-copy">
        <span className="lost-k">404</span>
        <h1>
          <span>Off the</span>
          <span className="glow">track</span>
        </h1>
        <p>This page is not on the calendar. Every weekend that has been raced so far is one click away.</p>
        <div className="lost-go">
          <Link href="/" className="home-go">Back home <i aria-hidden>→</i></Link>
          <Link href="/#races" className="lost-alt">All the circuits</Link>
        </div>
      </div>
    </main>
  );
}
