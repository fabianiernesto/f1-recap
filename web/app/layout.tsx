import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import PageFX from "@/components/PageFX";

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

const body = localFont({
  variable: "--font-body",
  src: [
    { path: "./fonts/inter-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/inter-600.woff2", weight: "600", style: "normal" },
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

// pixel face, used on the hero headline only
const pixel = localFont({
  variable: "--font-pixel",
  src: [
    { path: "./fonts/doto-700.woff2", weight: "700", style: "normal" },
    { path: "./fonts/doto-900.woff2", weight: "900", style: "normal" },
  ],
});

export const metadata: Metadata = {
  title: "Racing Simplified",
  description:
    "Every Grand Prix told as a story you scroll: the real track, the real moments, none of the homework.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${mono.variable} ${hero.variable} ${pixel.variable}`}
    >
      <body>
        {children}
        <PageFX />
      </body>
    </html>
  );
}
