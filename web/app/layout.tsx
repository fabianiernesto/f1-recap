import type { Metadata } from "next";
import {
  Anton,
  Barlow_Condensed,
  Doto,
  Inter,
  JetBrains_Mono,
} from "next/font/google";
import "./globals.css";

const display = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
});
const body = Inter({ subsets: ["latin"], variable: "--font-body" });
const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-mono",
});
const hero = Anton({ subsets: ["latin"], weight: "400", variable: "--font-hero" });
// pixel face, used on one line only: the GP + country strapline
const pixel = Doto({ subsets: ["latin"], weight: ["700", "900"], variable: "--font-pixel" });

export const metadata: Metadata = {
  title: "F1 Recap — scroll the race",
  description:
    "Every Grand Prix told as a story you scroll: the real track, the real moments, none of the homework.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${mono.variable} ${hero.variable} ${pixel.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
