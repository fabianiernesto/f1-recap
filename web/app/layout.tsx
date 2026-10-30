import type { Metadata } from "next";
import localFont from "next/font/local";
import { preload } from "react-dom";
import "./globals.css";
import PageFX from "@/components/PageFX";
import { SITE } from "@/lib/site";

/**
 * Fonts are served from app/fonts, fetched once by scripts/fetch-fonts.mjs.
 * next/font/google downloads them at dev-server start instead, and when Google
 * stops serving the exact variant it asks for, every route 500s. Local files
 * mean the site builds and runs with no network at all.
 */
const display = localFont({
  variable: "--font-display",
  src: [
    { path: "./fonts/barlow-condensed-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/barlow-condensed-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/barlow-condensed-700.woff2", weight: "700", style: "normal" },
  ],
});

// Ernesto's brand text face is Agrandir. It is not a Google font, so this is
// the stand-in that reads closest to it, and globals.css declares an
// @font-face for the real thing that takes over the moment its files are
// dropped into public/fonts/. Inter is gone: two body faces is one too many.
const body = localFont({
  variable: "--font-body",
  src: [
    { path: "./fonts/space-grotesk-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/space-grotesk-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/space-grotesk-700.woff2", weight: "700", style: "normal" },
  ],
});

const mono = localFont({
  variable: "--font-mono",
  src: [
    { path: "./fonts/jetbrains-mono-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/jetbrains-mono-700.woff2", weight: "700", style: "normal" },
  ],
});

const hero = localFont({
  variable: "--font-hero",
  src: [{ path: "./fonts/anton-400.woff2", weight: "400", style: "normal" }],
});

// the editorial italic, for the light sections only: the one face on the
// site allowed to sound like a magazine
const serif = localFont({
  variable: "--font-serif",
  src: [
    { path: "./fonts/instrument-serif-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/instrument-serif-400-italic.woff2", weight: "400", style: "italic" },
  ],
  // no page sets it today (25/10/2026), so it is not preloaded on every visit
  preload: false,
});

// pixel face, used on the hero headline only
const pixel = localFont({
  variable: "--font-pixel",
  src: [
    { path: "./fonts/doto-700.woff2", weight: "700", style: "normal" },
    { path: "./fonts/doto-900.woff2", weight: "900", style: "normal" },
  ],
});

// the home's one family: TT Commons Pro when its files are in public/fonts,
// Plus Jakarta Sans until then (see public/fonts/README.md)
const ui = localFont({
  variable: "--font-ui",
  src: [
    { path: "./fonts/plus-jakarta-sans-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/plus-jakarta-sans-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/plus-jakarta-sans-700.woff2", weight: "700", style: "normal" },
  ],
  // only a fallback behind Anybody, so it is fetched if a page ever needs it
  preload: false,
});

const description =
  "Every Grand Prix told as a story you scroll: the real track, the real moments, none of the homework.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: "Racing Simplified", template: "%s · Racing Simplified" },
  description,
  openGraph: { siteName: "Racing Simplified", type: "website", title: "Racing Simplified", description },
  twitter: { card: "summary_large_image", title: "Racing Simplified", description },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  // Anybody sets every title on the site but is declared in globals.css, so
  // the browser only found it once the page had been styled and the titles
  // arrived in a stand-in face first. Asked for up front, it lands with them.
  preload("/fonts/anybody-variable.woff2", { as: "font", type: "font/woff2", crossOrigin: "" });
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${mono.variable} ${hero.variable} ${pixel.variable} ${serif.variable} ${ui.variable}`}
    >
      <body>
        {children}
        <PageFX />
      </body>
    </html>
  );
}
