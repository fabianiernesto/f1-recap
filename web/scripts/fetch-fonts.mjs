/**
 * Downloads the project's fonts once, into app/fonts.
 *
 * next/font/google fetches them at dev-server start, and when Google stops
 * serving the exact variant it asked for, every route 500s. Self-hosting
 * removes that dependency: the site builds and runs with no network at all.
 *
 * Run again only to add or update a family:  node scripts/fetch-fonts.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, "..", "app", "fonts");

// a modern browser UA, so Google serves woff2 rather than legacy formats
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const FONTS = [
  { family: "Anton", weights: [400], file: "anton" },
  { family: "Barlow Condensed", weights: [500, 600, 700], file: "barlow-condensed" },
  { family: "Inter", weights: [400, 600], file: "inter" },
  { family: "JetBrains Mono", weights: [500, 700], file: "jetbrains-mono" },
  { family: "Doto", weights: [700, 900], file: "doto" },
  // the editorial voice for the light sections: an italic serif, the one
  // face on the site that is allowed to sound like a magazine
  { family: "Instrument Serif", weights: [400], file: "instrument-serif", italic: true },
  { family: "Instrument Serif", weights: [400], file: "instrument-serif" },
  // Ernesto's brand text face is Agrandir, which is not a Google font. This
  // is the stand-in that reads closest to it: wide, geometric, a little
  // friendly. Drop the real files in public/fonts/ and globals.css picks
  // them up first; see the @font-face at the top of that file.
  { family: "Space Grotesk", weights: [400, 500, 700], file: "space-grotesk" },
];

/** Pick the @font-face block that covers basic latin. */
function latinWoff2(css) {
  const blocks = css.split("@font-face").slice(1);
  const latin = blocks.find(
    (b) => b.includes("U+0000-00FF") && b.includes(".woff2")
  );
  const block = latin ?? blocks.find((b) => b.includes(".woff2"));
  return block?.match(/https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2/)?.[0];
}

await mkdir(OUT, { recursive: true });

for (const { family, weights, file, italic } of FONTS) {
  for (const weight of weights) {
    const url =
      "https://fonts.googleapis.com/css2?family=" +
      encodeURIComponent(family) +
      (italic ? `:ital,wght@1,${weight}` : `:wght@${weight}`) +
      "&display=swap";

    const css = await (await fetch(url, { headers: { "User-Agent": UA } })).text();
    const woff2 = latinWoff2(css);
    if (!woff2) {
      console.error(`[skip] ${family} ${weight}: no woff2 in the stylesheet`);
      continue;
    }

    const bytes = Buffer.from(await (await fetch(woff2)).arrayBuffer());
    const name = `${file}-${weight}${italic ? "-italic" : ""}.woff2`;
    await writeFile(path.join(OUT, name), bytes);
    console.log(`[OK] ${name} · ${Math.round(bytes.length / 1024)} KB`);
  }
}
