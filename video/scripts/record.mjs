// Records the real web (running on localhost:3000) into clips for the video.
// Usage: node scripts/record.mjs [clipName ...]   (no args = all clips)
// Each clip writes a 30fps JPEG sequence to public/clips/<name>/ (captured with
// the Chrome screencast at full device resolution; Playwright's own recorder
// only keeps CSS pixels) plus public/clips/index.json: frame list and markers.
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const BASE = "http://localhost:3000";
const GP = "/gp/silverstone-2026";
const OUT = path.resolve("public/clips");
const INDEX = path.join(OUT, "index.json");
const FPS = 30;
const HIDE = "nextjs-portal{display:none!important}";

const PHONE = { viewport: { width: 432, height: 768 }, deviceScaleFactor: 2.5, size: { width: 1080, height: 1920 } };
// the board is shown at full frame height, so it is captured at 3414 x 1920
const WIDE = { viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2.1334, size: { width: 3414, height: 1920 } };

// scrolls the window to y over ms, eased, the way a thumb would
const glide = (page, to, ms) =>
  page.evaluate(
    ([to, ms]) =>
      new Promise((done) => {
        const from = scrollY, dist = (typeof to === "number" ? to : document.documentElement.scrollHeight - innerHeight) - from;
        const t0 = performance.now();
        const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
        const step = (now) => {
          const t = Math.min(1, (now - t0) / ms);
          scrollTo(0, from + dist * ease(t));
          t < 1 ? requestAnimationFrame(step) : done();
        };
        requestAnimationFrame(step);
      }),
    [to, ms],
  );

// y position that puts an element at a given fraction of the viewport
const yOf = (page, sel, at = 0.25) =>
  page.evaluate(([sel, at]) => {
    const el = document.querySelector(sel);
    return el ? scrollY + el.getBoundingClientRect().top - innerHeight * at : null;
  }, [sel, at]);

const CLIPS = {
  // the home, real time: a short hold on the hero, then one glide down to
  // How it works, the browser doing its own scrolling
  async home(page, mark) {
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    mark("ready");
    await page.waitForTimeout(900);
    mark("scroll");
    await glide(page, (await yOf(page, "#how", 0.04)) ?? 1400, 3000);
    await page.waitForTimeout(800);
    mark("end");
  },

  async led(page, mark) {
    await page.goto(BASE + GP, { waitUntil: "networkidle" });
    mark("ready");
    await page.waitForTimeout(4500);
    mark("switch1");
    await page.keyboard.press("1");
    await page.waitForTimeout(3500);
    mark("switch0");
    await page.keyboard.press("0");
    await page.waitForTimeout(3500);
    mark("end");
  },

  async sessions(page, mark) {
    await page.goto(BASE + GP + "/sessions", { waitUntil: "networkidle" });
    mark("ready");
    await page.waitForTimeout(4500);
    mark("end");
  },

  // the race page in real time, timed to the film's beats (110 BPM): one
  // glide from the top to the first call over 11 beats, the right answer
  // clicked on its beat, the reveal eased into view, then Alfred
  async race(page, mark) {
    const B = 60000 / 110;
    await page.goto(BASE + GP + "/race", { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    const call = await page.evaluate(() => {
      const el = document.querySelector(".call");
      const card = el.closest(".card") ?? el;
      return Math.round(scrollY + card.getBoundingClientRect().top - innerHeight * 0.16);
    });
    const story = JSON.parse(fs.readFileSync(path.resolve("../data/silverstone-2026/story_race.json"), "utf8"));
    const answer = story.cards.find((x) => x.type === "prediction")?.answer ?? "";
    mark("ready");
    await page.waitForTimeout(600);
    mark("scroll");
    await glide(page, call, 11 * B);
    await page.waitForTimeout(1.2 * B);
    mark("pick");
    await page.locator(".call .call-opt", { hasText: answer }).first().click().catch(() => {});
    await page.waitForTimeout(1 * B);
    await glide(page, call + 300, 2.6 * B);
    await page.waitForTimeout(1.4 * B);
    mark("mate");
    await page.locator(".mate-fab").click().catch(() => {});
    await page.waitForTimeout(2 * B);
    mark("ask");
    await page.locator(".mate-asks button").first().click().catch(() => {});
    await page.waitForTimeout(5.5 * B);
    mark("end");
  },

  async poster(page, mark) {
    await page.goto(BASE + GP + "/race", { waitUntil: "networkidle" });
    const y = await yOf(page, ".poster", 0.9);
    await page.evaluate((y) => scrollTo(0, y), y ?? 0);
    await page.waitForTimeout(2000);
    mark("ready");
    await glide(page, (await yOf(page, ".poster", 0)) ?? "end", 3500);
    await page.waitForTimeout(3000);
    mark("end");
  },

  async blind(page, mark) {
    await page.goto(BASE + GP + "/race/blind", { waitUntil: "networkidle" });
    mark("ready");
    await page.waitForTimeout(2500);
    mark("start");
    await page.locator(".bt-go").first().click();
    await page.waitForTimeout(3500);
    await glide(page, (await yOf(page, ".bt-opts", 0.35)) ?? 400, 1500);
    mark("pick");
    const median = await page.evaluate(() => {
      const dt = [...document.querySelectorAll("dt")].find((d) => /median lap/i.test(d.textContent));
      return dt?.nextElementSibling?.textContent.trim() ?? null;
    });
    const rounds = JSON.parse(fs.readFileSync(path.resolve("../data/silverstone-2026/blind_race.json"), "utf8")).rounds;
    const round = rounds.find((r) => r.rows.some(([k, v]) => k === "Median lap" && v === median));
    const right = round ? page.locator(".bt-opt", { hasText: round.answer }) : page.locator(".bt-opt").first();
    console.log("blind answer:", round?.answer ?? "unknown");
    await right.first().click();
    await page.waitForTimeout(500);
    // back up to the file: the photograph and team colour land there
    mark("reveal");
    await glide(page, (await yOf(page, ".bt-stage", 0)) ?? 0, 1200);
    await page.waitForTimeout(3800);
    mark("end");
  },

  async pitwall(page, mark) {
    await page.goto(BASE + GP + "/race/pitwall", { waitUntil: "networkidle" });
    mark("ready");
    await page.waitForTimeout(2500);
    mark("start");
    await page.locator(".pw-go").first().click();
    await page.waitForTimeout(600);
    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForTimeout(2400);
    mark("desk");
    await glide(page, (await yOf(page, ".pw-desk", 0.02)) ?? 400, 1600);
    await page.waitForTimeout(1600);
    await glide(page, (await yOf(page, ".pw-opts", 0.22)) ?? 800, 1300);
    mark("pick");
    await page.locator(".pw-opt").first().click();
    await page.waitForTimeout(700);
    mark("out");
    await glide(page, (await yOf(page, ".pw-out", 0.25)) ?? 1200, 1200);
    await page.waitForTimeout(3500);
    mark("end");
  },
};

const want = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(CLIPS);
const index = fs.existsSync(INDEX) ? JSON.parse(fs.readFileSync(INDEX, "utf8")) : {};
fs.mkdirSync(OUT, { recursive: true });

for (const name of want) {
  const fmt = name === "led" ? WIDE : PHONE;
  // headless screencast only delivers device pixels when the scale is real,
  // not emulated, so each clip gets its own browser at its own scale
  const browser = await chromium.launch({ channel: "chrome", args: [`--force-device-scale-factor=${fmt.deviceScaleFactor}`] });
  const dir = path.join(OUT, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir);
  const ctx = await browser.newContext({ viewport: fmt.viewport, deviceScaleFactor: fmt.deviceScaleFactor });
  await ctx.addInitScript((css) => {
    addEventListener("DOMContentLoaded", () => {
      const s = document.createElement("style");
      s.textContent = css;
      document.head.appendChild(s);
    });
  }, HIDE);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  const shots = []; // [seconds, file]
  let t0 = null, n = 0;
  cdp.on("Page.screencastFrame", async ({ data, sessionId, metadata }) => {
    cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
    const t = metadata.timestamp;
    if (t0 === null) t0 = t;
    const file = String(n++).padStart(5, "0") + ".jpg";
    fs.writeFileSync(path.join(dir, file), Buffer.from(data, "base64"));
    shots.push([t - t0, file]);
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 88, maxWidth: fmt.size.width, maxHeight: fmt.size.height, everyNthFrame: 1 });
  const wall0 = Date.now();
  const m = {};
  const mark = (k) => (m[k] = +((Date.now() - wall0) / 1000).toFixed(2));
  await CLIPS[name](page, mark);
  await cdp.send("Page.stopScreencast");
  await ctx.close();
  await browser.close();
  const dur = shots.at(-1)[0];
  const frames = [];
  for (let i = 0, k = 0; i / FPS <= dur; i++) {
    while (k + 1 < shots.length && shots[k + 1][0] <= i / FPS) k++;
    frames.push(shots[k][1]);
  }
  // drop the jpgs no 30fps frame points at
  const used = new Set(frames);
  for (const [, f] of shots) if (!used.has(f)) fs.rmSync(path.join(dir, f));
  index[name] = { w: fmt.size.width, h: fmt.size.height, frames, markers: m };
  console.log(name, frames.length, "frames", JSON.stringify(m));
}
fs.writeFileSync(INDEX, JSON.stringify(index));
