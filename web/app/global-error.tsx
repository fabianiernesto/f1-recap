"use client";

/**
 * The last resort, when the root layout itself breaks: it replaces the whole
 * document, so nothing from globals.css or the fonts can be counted on.
 */
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", padding: "12vh 6vw", boxSizing: "border-box", background: "#0a0a0a", color: "#fff", fontFamily: "system-ui, sans-serif" }}>
        <title>Red flag · Racing Simplified</title>
        <h1 style={{ margin: "0 0 16px", fontSize: 40, fontWeight: 800 }}>Red flag</h1>
        <p style={{ margin: "0 0 28px", maxWidth: "46ch", fontSize: 18, lineHeight: 1.6, color: "#cfcfcf" }}>
          The site stopped working. Try it again, or come back to the home.
        </p>
        <button type="button" onClick={() => retry()} style={{ padding: "12px 22px", marginRight: 24, border: 0, background: "#e10600", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
          Try again
        </button>
        {/* a real page load on purpose: the router may be what broke */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" style={{ color: "#fff", fontSize: 15 }}>Back home</a>
      </body>
    </html>
  );
}
