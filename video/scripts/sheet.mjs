// Contact sheet: node scripts/sheet.mjs out.png cols cellW cellH img1 img2 ...
import { chromium } from "playwright-core";
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
const [out, cols, w, h, ...imgs] = process.argv.slice(2);
const C = +cols, W = +w, H = +h;
const html = `<body style="margin:0;background:#555;display:grid;grid-template-columns:repeat(${C},${W}px);gap:4px">${imgs
  .map((p) => `<div style="position:relative;width:${W}px;height:${H}px;background:#222"><img src="${pathToFileURL(path.resolve(p))}" style="width:100%;height:100%;object-fit:contain"><span style="position:absolute;left:4px;top:2px;font:11px monospace;color:#0f0;background:#000a">${path.basename(p)}</span></div>`)
  .join("")}</body>`;
const b = await chromium.launch({ channel: "chrome" });
const pg = await b.newPage({ viewport: { width: C * (W + 4), height: Math.ceil(imgs.length / C) * (H + 4) } });
const f = path.join(os.tmpdir(), "sheet.html"); fs.writeFileSync(f, html); await pg.goto(pathToFileURL(f).href, { waitUntil: "load" });
await pg.screenshot({ path: out, fullPage: true });
await b.close();
