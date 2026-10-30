import { continueRender, delayRender, staticFile } from "remotion";

const FACES: [string, string, FontFaceDescriptors][] = [
  ["Anybody", "anybody-variable.woff2", { weight: "100 900", stretch: "50% 150%" }],
  ["Doto", "doto-900.woff2", { weight: "900" }],
  ["Doto", "doto-700.woff2", { weight: "700" }],
  ["JetBrains Mono", "jetbrains-mono-700.woff2", { weight: "700" }],
  ["Space Grotesk", "space-grotesk-500.woff2", { weight: "500" }],
  ["Instrument Serif", "instrument-serif-400-italic.woff2", { style: "italic" }],
  ["Instrument Serif", "instrument-serif-400.woff2", {}],
];

const handle = delayRender("fonts");
Promise.all(
  FACES.map(async ([family, file, desc]) => {
    const f = new FontFace(family, `url(${staticFile(`fonts/${file}`)}) format("woff2")`, desc);
    await f.load();
    document.fonts.add(f);
  }),
).then(() => continueRender(handle));
