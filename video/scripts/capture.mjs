// Frame-exact recordings of the real web, for the shots where the site is the
// star. Every output frame is made on purpose: the scroll is set to its exact
// eased position, the page's clock (rAF, timers, Date) is a virtual one that
// moves 1/30 s per frame, and every CSS animation is stepped by the same
// amount through the Web Animations API. So scrolls glide at 30fps without a
// dropped or doubled frame, and the clip plays 1:1 in the film.
//
// Usage: node scripts/capture.mjs [clipName ...]   (no args = all)
// Writes public/clips/<name>/00000.jpg ... and updates public/clips/index.json.
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.WEB ?? "http://localhost:3005";
const GP = "/gp/silverstone-2026";
const OUT = path.resolve("public/clips");
const INDEX = path.join(OUT, "index.json");
const FPS = 60, STEP = 1000 / FPS, BEAT = 60 / 110;
/** frames between two scene beats, on the same grid as src/time.ts */
const span = (a, b) => Math.round((b - 8) * BEAT * FPS) - Math.round((a - 8) * BEAT * FPS);

const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t)); // smoothstep
/** position along a glide whose speed ramps up over a, cruises, and ramps down over d */
const glide = (t, a = 0.22, d = 0.3) => {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const v = 1 / (1 - a / 2 - d / 2);
  if (t < a) return (v * t * t) / (2 * a);
  if (t <= 1 - d) return v * (a / 2 + (t - a));
  return 1 - (v * (1 - t) * (1 - t)) / (2 * d);
};
const smoother = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * t * (t * (t * 6 - 15) + 10));

// installed in the page once it has loaded: a clock we drive
const VIRTUAL = () => {
  const nRAF = window.requestAnimationFrame.bind(window);
  const nST = window.setTimeout.bind(window);
  let now = performance.now();
  const base = Date.now() - now;
  let rafQ = [], timers = [], id = 1;
  window.__native = { nRAF, nST };
  performance.now = () => now;
  Date.now = () => base + now;
  window.requestAnimationFrame = (cb) => { const i = id++; rafQ.push([i, cb]); return i; };
  window.cancelAnimationFrame = (i) => { rafQ = rafQ.filter((r) => r[0] !== i); };
  window.setTimeout = (cb, ms = 0, ...a) => { const i = id++; timers.push({ i, at: now + ms, cb, a }); return i; };
  window.clearTimeout = (i) => { timers = timers.filter((t) => t.i !== i); };
  window.setInterval = (cb, ms = 0, ...a) => { const i = id++; timers.push({ i, at: now + ms, cb, a, every: Math.max(1, ms) }); return i; };
  window.clearInterval = window.clearTimeout;
  // freeze every CSS animation and transition; we move them ourselves
  const seen = new WeakSet();
  const grab = () => {
    for (const an of document.getAnimations()) {
      if (!seen.has(an)) { seen.add(an); an.pause(); }
    }
  };
  grab();
  // a transition or animation the page starts (a card entering, a hover) is
  // frozen the instant it begins, so it can only move with the virtual clock
  const freeze = (e) => { for (const an of e.target.getAnimations?.() ?? []) if (!seen.has(an)) { seen.add(an); an.pause(); } };
  for (const ev of ["transitionrun", "transitionstart", "animationstart"]) document.addEventListener(ev, freeze, true);
  window.__step = (ms) => {
    const end = now + ms;
    // timers due in this step, in order
    for (;;) {
      timers.sort((x, y) => x.at - y.at);
      const t = timers[0];
      if (!t || t.at > end) break;
      now = Math.max(now, t.at);
      if (t.every) t.at += t.every; else timers.shift();
      try { typeof t.cb === "function" ? t.cb(...t.a) : null; } catch (e) { console.error(e); }
    }
    now = end;
    grab();
    for (const an of document.getAnimations()) {
      if (an.playState !== "finished") an.currentTime = (an.currentTime ?? 0) + ms;
    }
    const q = rafQ; rafQ = [];
    for (const [, cb] of q) { try { cb(now); } catch (e) { console.error(e); } }
    grab();
  };
  // let the browser lay out and paint what we just changed
  window.__settle = () => new Promise((r) => nRAF(() => nRAF(r)));
};

const PHONE = { viewport: { width: 432, height: 768 }, scale: 2.5 };

/** y that puts an element's top at a fraction of the viewport */
const yOf = (page, sel, at = 0.25) =>
  page.evaluate(([sel, at]) => {
    const el = document.querySelector(sel);
    return el ? Math.round(scrollY + el.getBoundingClientRect().top - innerHeight * at) : null;
  }, [sel, at]);

/** per frame of the last recording: the rect of its `focus` element */
const FOCUS = [];
/** the guess slider's value on the current frame (sGuess) */
const SLIDE = { v: null };

/** frames a Scrolled clip runs past its shot, so the cut has something to show */
const PAD = 12;

/** y that puts the i-th story card's top at a fraction of the viewport */
const cardY = (page, i, at) =>
  page.evaluate(([i, at]) => {
    const el = document.querySelectorAll(".card")[i];
    return Math.round(scrollY + el.getBoundingClientRect().top - innerHeight * at);
  }, [i, at]);

/** scroll there and let the page settle, so the shot opens on a page at rest */
const seeAt = async (page, y) => {
  await page.evaluate((y) => scrollTo(0, y), y);
  await page.waitForTimeout(1400);
};

async function record(name, url, frames, plan, prep, sub = 1) {
  const dir = path.join(OUT, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch({ channel: "chrome", args: [`--force-device-scale-factor=${PHONE.scale}`] });
  const ctx = await browser.newContext({ viewport: PHONE.viewport, deviceScaleFactor: PHONE.scale });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.error("page:", e.message));
  await page.goto(BASE + url, { waitUntil: "networkidle" });
  await page.addStyleTag({ content: "nextjs-portal{display:none!important} html{scroll-behavior:auto!important}" });
  await page.waitForTimeout(1200);
  const ctl = prep ? await prep(page) : {};
  await page.evaluate(VIRTUAL);
  const cdp = await ctx.newCDPSession(page);
  const list = [], half = [];
  FOCUS.length = 0;
  SLIDE.v = null;
  for (let q = 1; q < sub; q++) half.push([]);
  for (let k = 0; k < frames * sub; k++) {
    const i = Math.floor(k / sub), sIdx = k % sub;
    const act = await plan(i + sIdx / sub, page, ctl);
    if (act?.y !== undefined) await page.evaluate((y) => scrollTo(0, y), act.y);
    if (SLIDE.v !== null) {
      await page.evaluate((v) => {
        const el = document.querySelector(".guess-range");
        if (!el || el.disabled || Math.abs(+el.value - v) < 1e-6) return;
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, String(v));
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }, +SLIDE.v.toFixed(2));
    }
    if (act?.click) await page.evaluate((sel) => document.querySelector(sel)?.click(), act.click);
    if (act?.clickText) {
      await page.evaluate(([sel, txt]) => {
        const el = [...document.querySelectorAll(sel)].find((e) => e.textContent.includes(txt));
        el?.click();
      }, act.clickText);
    }
    await page.evaluate(() => window.__settle());
    await page.evaluate((ms) => window.__step(ms), STEP / sub);
    await page.evaluate(() => window.__settle());
    if (ctl.focus && !sIdx) {
      // where the thing this shot is about sits on this frame, in CSS px
      FOCUS.push(await page.evaluate((src) => {
        const el = new Function(`return (${src})`)();
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return [r.left, r.top, r.width, r.height].map((v) => Math.round(v * 10) / 10);
      }, ctl.focus));
    }
    const { data } = await cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 90 });
    const file = String(i).padStart(5, "0") + (sIdx ? `_${sIdx}` : "") + ".jpg";
    fs.writeFileSync(path.join(dir, file), Buffer.from(data, "base64"));
    (sIdx ? half[sIdx - 1] : list).push(file);
  }
  await browser.close();
  return sub > 1 ? { frames: list, half } : list;
}

/* ---------- the plans: one per shot, in output frames ---------- */

const CLIPS = {
  // the home, beats 20-28: hold on the hero while the camera pulls out,
  // then one long glide down to How it works
  async home() {
    const n = span(20, 28);
    return record("home", "/", n, async (i, page, c) => {
      return { y: c.how * glide((i - 44) / (n - 44 - 8)) };
    }, async (page) => ({ how: (await yOf(page, "#how", 0.04)) ?? 1400 }), 1);
  },

  // how it works 01: the home, down to the circuits, then along them to
  // Silverstone (beats 24-32). The card's final rect goes in the markers so
  // the film can tap it.
  async navhome() {
    const n = span(24, 32);
    const f = (beat) => span(24, 24 + beat);
    let m = {};
    const frames = await record("navhome", "/", n, async (i, page, c) => {
      const act = { y: c.y * glide((i - f(0.3)) / (f(3.3) - f(0.3)), 0.3, 0.35) };
      const sx = c.sx * glide((i - f(3.6)) / (f(6.4) - f(3.6)), 0.3, 0.35);
      await page.evaluate((sx) => { const el = document.querySelector(".home-card")?.parentElement; if (el) el.scrollLeft = sx; }, sx);
      return act;
    }, async (page) => {
      const y = await yOf(page, "#races", 0.06);
      await page.evaluate((y) => scrollTo(0, y), y);
      await page.waitForTimeout(400);
      const r = await page.evaluate(() => {
        const cards = [...document.querySelectorAll(".home-card")];
        const sil = cards.find((c) => /silverstone/i.test(c.textContent));
        const strip = cards[0].parentElement;
        const sx = Math.max(0, sil.offsetLeft - cards[0].offsetLeft);
        strip.scrollLeft = sx;
        const b = sil.getBoundingClientRect();
        const out = { sx: strip.scrollLeft, x: b.left, y: b.top, w: b.width, h: b.height, scrollable: strip.scrollWidth > strip.clientWidth };
        strip.scrollLeft = 0;
        return out;
      });
      await page.evaluate(() => scrollTo(0, 0));
      await page.waitForTimeout(400);
      m = { cardX: r.x, cardY: r.y, cardW: r.w, cardH: r.h, scrollable: r.scrollable ? 1 : 0 };
      return { y, sx: r.sx };
    });
    return { frames, markers: m };
  },

  // how it works 03: the blind test played from the start (beats 40-48)
  async blindplay() {
    const n = span(40, 48);
    const f = (beat) => span(40, 40 + beat);
    const rounds = JSON.parse(fs.readFileSync(path.resolve("../data/silverstone-2026/blind_race.json"), "utf8")).rounds;
    return record("blindplay", GP + "/race/blind", n, async (i, page, c) => {
      const act = {};
      if (i === f(0.8)) act.click = ".bt-go";
      if (i === f(2.4)) {
        c.answer = await page.evaluate((rounds) => {
          const dt = [...document.querySelectorAll("dt")].find((d) => /median lap/i.test(d.textContent));
          const med = dt?.nextElementSibling?.textContent.trim();
          return rounds.find((x) => x.rows.some(([k, v]) => k === "Median lap" && v === med))?.answer ?? "";
        }, rounds);
        c.opts = (await yOf(page, ".bt-opts", 0.35)) ?? 500;
      }
      if (i >= f(2.6) && i <= f(4.4)) act.y = (c.opts ?? 0) * glide((i - f(2.6)) / (f(4.4) - f(2.6)));
      if (i === f(5)) act.clickText = [".bt-opt", c.answer];
      if (i >= f(5.4)) act.y = (c.opts ?? 0) * (1 - glide((i - f(5.4)) / (f(6.6) - f(5.4))));
      return act;
    }, async () => ({}));
  },

  // the race page through the whole Scrolled act, beats 50.5-75, in one take,
  // read the way a person reads it: a glide to each moment, a short hold on
  // it, the next; the third glide lands on the first call ("where does he
  // finish?"), clicked on beat 63 with the right answer; the reveal eased
  // into view; then Alfred opened and asked
  async race() {
    // since 08/10/2026 the take starts at beat 32, when How it works hands
    // the phone over: one long, steady glide to the first call
    const n = span(32, 75);
    const f = (beat) => span(32, beat);
    // one continuous glide from the top to the first call: the cards pass
    // under a steady speed instead of stopping and starting
    const G0 = f(32.8), G1 = f(61.8);
    const PICK = f(63), OUT0 = f(64), OUT1 = f(66.6), MATE = f(68), ASK = f(70);
    return record("race", GP + "/race", n, async (i, page, c) => {
      const act = {};
      if (i < OUT0) act.y = c.stops[2] * glide((i - G0) / (G1 - G0), 0.12, 0.2);
      else if (i <= OUT1) act.y = c.stops[2] + (c.out - c.stops[2]) * glide((i - OUT0) / (OUT1 - OUT0), 0.35, 0.45);
      if (i === PICK) act.clickText = [".call .call-opt", c.answer];
      if (i === MATE) act.click = ".mate-fab";
      if (i === ASK) act.click = ".mate-asks button";
      return act;
    }, async (page) => {
      const stops = await page.evaluate(() => {
        const at = (el, k) => Math.round(scrollY + el.getBoundingClientRect().top - innerHeight * k);
        const cards = [...document.querySelectorAll(".card")];
        const call = document.querySelector(".call");
        return [at(cards[1], 0.2), at(cards[2], 0.2), at(call.closest(".card") ?? call, 0.16)];
      });
      const story = JSON.parse(fs.readFileSync(path.resolve("../data/silverstone-2026/story_race.json"), "utf8"));
      const first = story.cards.find((x) => x.type === "prediction");
      return { stops, out: stops[2] + 300, answer: first?.answer ?? "" };
    }, 1);
  },

  /* ---- since 13/10/2026 the Scrolled act is cut in short shots, one per
     thing the page does (beats 32-75). Each clip starts on its shot's first
     beat and runs PAD frames past its last, for the cut. ---- */

  // the weekend: the five sessions, down to the race (beats 32-36.5)
  async weekend() {
    const [a, z] = [32, 36.5];
    const f = (beat) => span(a, beat);
    let m = {};
    const frames = await record("weekend", GP + "/sessions", f(z) + PAD, async (i, page, c) => ({
      y: c.y * glide((i - f(32.5)) / (f(35) - f(32.5)), 0.3, 0.35),
    }), async (page) => {
      const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
      await page.evaluate((y) => scrollTo(0, y), max);
      await page.waitForTimeout(500);
      const r = await page.evaluate(() => {
        const b = document.querySelector(".hub-session-race").getBoundingClientRect();
        return { x: b.left, y: b.top, w: b.width, h: b.height };
      });
      await page.evaluate(() => scrollTo(0, 0));
      await page.waitForTimeout(600);
      m = { raceX: r.x, raceY: r.y, raceW: r.w, raceH: r.h };
      return { y: max };
    });
    return { frames, markers: m };
  },

  // the story from the top: the car sets off, the first moments (36.5-43)
  async rA() {
    const [a, z] = [36.5, 43];
    const f = (beat) => span(a, beat);
    return record("rA", GP + "/race", f(z) + PAD, async (i, page, c) => ({
      y: c.to * glide((i - f(36.8)) / (f(42.8) - f(36.8)), 0.25, 0.3),
    }), async (page) => ({ to: await cardY(page, 5, 0.2) }));
  },

  // the colours: retirement, the purple fastest lap, the striped VSC, the
  // yellow flags (43-49)
  async rFlags() {
    const [a, z] = [43, 49];
    const f = (beat) => span(a, beat);
    // a hold on each colour: the purple fastest lap, then the striped VSC,
    // then the yellow flags, with a short glide between
    const seg = (i, y0, y1, b0, b1, ac = 0.35, de = 0.4) => y0 + (y1 - y0) * glide((i - f(b0)) / (f(b1) - f(b0)), ac, de);
    return record("rFlags", GP + "/race", f(z) + PAD, async (i, page, c) => {
      if (i < f(45)) return { y: seg(i, c.y20 - 60, c.y20, 43, 45, 0.1, 0.6) };
      if (i < f(47.3)) return { y: seg(i, c.y20, c.y22, 45, 46.1) };
      return { y: seg(i, c.y22, c.y23, 47.3, 48.4) };
    }, async (page) => {
      const y20 = await cardY(page, 20, 0.14), y22 = await cardY(page, 22, 0.14), y23 = await cardY(page, 23, 0.14);
      await seeAt(page, y20 - 60);
      return { y20, y22, y23 };
    });
  },

  // call it: Colapinto from P19, the right answer picked, the reveal (49-54)
  async rPred() {
    const [a, z] = [49, 54];
    const f = (beat) => span(a, beat);
    const story = JSON.parse(fs.readFileSync(path.resolve("../data/silverstone-2026/story_race.json"), "utf8"));
    return record("rPred", GP + "/race", f(z) + PAD, async (i, page, c) => {
      const act = { y: c.from + 140 * glide((i - f(51.2)) / (f(53.4) - f(51.2)), 0.35, 0.45) };
      if (i === f(50.6)) act.clickText = [".call .call-opt", story.cards[3].answer];
      return act;
    }, async (page) => {
      const from = await cardY(page, 3, 0.12);
      await seeAt(page, from);
      return { from };
    });
  },

  // the calls: what if, the pit wall, the steward, and the steward's call
  // made (54-63)
  async rCalls() {
    const [a, z] = [54, 63];
    const f = (beat) => span(a, beat);
    return record("rCalls", GP + "/race", f(z) + PAD, async (i, page, c) => {
      const act = {};
      if (i < f(55.6)) act.y = c.y28;
      else if (i < f(57.2)) act.y = c.y12;
      else act.y = c.y17 + 300 * glide((i - f(59)) / (f(61.6) - f(59)), 0.35, 0.45);
      if (i === f(58.4)) act.clickText = [".call .call-opt", "No further action"];
      return act;
    }, async (page) => {
      const y28 = await cardY(page, 28, 0.1), y12 = await cardY(page, 12, 0.1), y17 = await cardY(page, 17, 0.1);
      for (const y of [y12, y17, y28]) await seeAt(page, y);
      return { y28, y12, y17 };
    });
  },

  // guess it: the slider pulled to the gap, locked, the verdict (63-67)
  async rGuess() {
    const [a, z] = [63, 67];
    const f = (beat) => span(a, beat);
    return record("rGuess", GP + "/race", f(z) + PAD, async (i, page, c) => {
      const act = { y: c.from + 40 * glide((i - f(65.5)) / (f(66.8) - f(65.5)), 0.35, 0.45) };
      const p = glide((i - f(63.3)) / (f(64.7) - f(63.3)), 0.3, 0.4);
      const v = Math.round((1 + (0.45 - 1) * p) / 0.05) * 0.05;
      if (i >= f(63.3) && i <= f(64.8)) {
        await page.evaluate((v) => {
          const el = document.querySelector(".guess-range");
          if (!el || +el.value === v) return;
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, String(v));
          el.dispatchEvent(new Event("input", { bubbles: true }));
        }, +v.toFixed(2));
      }
      if (i === f(65.1)) act.click = ".guess .lock";
      return act;
    }, async (page) => {
      const from = await cardY(page, 33, 0.1);
      await seeAt(page, from);
      return { from };
    });
  },

  // Alfred at the flag: opened, asked (67-75)
  async rMate() {
    const [a, z] = [67, 75];
    const f = (beat) => span(a, beat);
    return record("rMate", GP + "/race", f(z) + PAD, async (i) => {
      const act = {};
      if (i === f(68)) act.click = ".mate-fab";
      if (i === f(70)) act.click = ".mate-asks button";
      return act;
    }, async (page) => {
      const y = await cardY(page, 32, 0.2);
      await seeAt(page, y);
      return {};
    });
  },

  /* ---- the Scrolled act as scripted on 13/10/2026 (GUION_INICIO.md): one
     idea per shot, held still long enough to read, with the rect of the
     thing it is about recorded on every frame so the film can zoom to it
     and dim the rest. Beats are film beats; each clip starts on its shot. */

  // pick any session: the five sessions, then down to the race (32-38)
  async sWeek() {
    const [a, z] = [32, 38];
    const f = (beat) => span(a, beat);
    let m = {};
    const frames = await record("sWeek", GP + "/sessions", f(z) + PAD, async (i, page, c) => ({
      y: c.y * glide((i - f(32.6)) / (f(34.4) - f(32.6)), 0.3, 0.35),
    }), async (page) => {
      const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
      await page.evaluate((y) => scrollTo(0, y), max);
      await page.waitForTimeout(500);
      const r = await page.evaluate(() => {
        const b = document.querySelector(".hub-session-race").getBoundingClientRect();
        return { x: b.left, y: b.top, w: b.width, h: b.height };
      });
      await page.evaluate(() => scrollTo(0, 0));
      await page.waitForTimeout(600);
      m = { raceX: r.x, raceY: r.y, raceW: r.w, raceH: r.h };
      return { y: max, focus: `document.querySelector(".hub-sessions")` };
    });
    return { frames, markers: { ...m, focus: FOCUS.slice() } };
  },

  // the car drives the real track: from the top, a steady scroll to lap 22 (38-44.5)
  async sTrack() {
    const [a, z] = [38, 44.5];
    const f = (beat) => span(a, beat);
    const frames = await record("sTrack", GP + "/race", f(z) + PAD, async (i, page, c) => ({
      y: c.to * glide((i - f(38.6)) / (f(44.2) - f(38.6)), 0.25, 0.3),
    }), async (page) => {
      // the shot is about the car on the track: the cards stay, but faint, and
      // the track at full strength (on a phone the site draws it at 55 %)
      await page.addStyleTag({ content: ".flow{opacity:.22} .trackwrap{opacity:1!important}" });
      return { to: await cardY(page, 10, 0.3), focus: `document.querySelector(".trackwrap svg")` };
    });
    return { frames, markers: { focus: FOCUS.slice() } };
  },

  /** a card held still, with a short drift onto it; `act` adds clicks */
  async hold(name, a, z, card, k, act = () => ({}), more = () => 0, css = "") {
    const f = (beat) => span(a, beat);
    const frames = await record(name, GP + "/race", f(z) + PAD, async (i, page, c) => {
      const y = c.y - 40 * (1 - glide((i - f(a + 0.1)) / (f(a + 1.4) - f(a + 0.1)), 0.1, 0.6)) + more(i, f);
      return { y, ...act(i, f) };
    }, async (page) => {
      if (css) await page.addStyleTag({ content: css });
      const y = await cardY(page, card, k);
      await seeAt(page, y - 40);
      return { y, focus: `document.querySelectorAll(".card")[${card}]` };
    });
    return { frames, markers: { focus: FOCUS.slice() } };
  },

  // every moment explained: lap 1, 27 places changed hands (44.5-51)
  async sMoment() { return CLIPS.hold("sMoment", 44.5, 51, 1, 0.24); },
  // purple: the fastest lap (51-55)
  async sPurple() { return CLIPS.hold("sPurple", 51, 55, 20, 0.24); },
  // yellow: the virtual safety car (55-59.5)
  async sYellow() { return CLIPS.hold("sYellow", 55, 59.5, 22, 0.2); },
  // guess what happens next: Colapinto from P19, the right answer (59.5-67.5)
  async sPred() {
    const story = JSON.parse(fs.readFileSync(path.resolve("../data/silverstone-2026/story_race.json"), "utf8"));
    return CLIPS.hold("sPred", 59.5, 67.5, 3, 0.16, (i, f) => (i === f(62.6) ? { clickText: [".call .call-opt", story.cards[3].answer] } : {}));
  },
  // make the call: the steward's card, no further action, what they did (72-77.5)
  async sSteward() {
    return CLIPS.hold("sSteward", 72, 77.5, 17, 0.06,
      (i, f) => (i === f(73.4) ? { clickText: [".call .call-opt", "No further action"] } : {}),
      (i, f) => 330 * glide((i - f(74)) / (f(75.6) - f(74)), 0.35, 0.45));
  },
  // guess the number: the slider pulled to 0.45, locked, spot on (77.5-83.5)
  async sGuess() {
    const r = await CLIPS.hold("sGuess", 77.5, 83.5, 33, 0.1, (i, f) => (i === f(80.6) ? { click: ".guess .lock" } : {}),
      (i, f) => { SLIDE.v = Math.round((1 + (0.45 - 1) * glide((i - f(78.2)) / (f(79.9) - f(78.2)), 0.3, 0.4)) / 0.05) * 0.05; return 0; },
      // the race poster under the last card is a white block that pulls the eye
      ".poster{visibility:hidden}");
    return r;
  },
  // ask Alfred: at the flag, opened, asked (83.5-91)
  async sMate() {
    const [a, z] = [83.5, 91];
    const f = (beat) => span(a, beat);
    const frames = await record("sMate", GP + "/race", f(z) + PAD, async (i) => {
      const act = {};
      if (i === f(84.2)) act.click = ".mate-fab";
      if (i === f(86.2)) act.click = ".mate-asks button";
      return act;
    }, async (page) => {
      const y = await cardY(page, 32, 0.2);
      await seeAt(page, y);
      return { focus: `document.querySelector(".mate.open") ?? document.querySelector(".mate-fab")` };
    });
    return { frames, markers: { focus: FOCUS.slice() } };
  },

  // the three kinds of call, as strips: each card's kicker and question, at
  // full resolution (stills, not a clip)
  async strips() {
    const dir = path.join(OUT, "strips");
    fs.mkdirSync(dir, { recursive: true });
    const browser = await chromium.launch({ channel: "chrome" });
    const ctx = await browser.newContext({ viewport: PHONE.viewport, deviceScaleFactor: PHONE.scale });
    const page = await ctx.newPage();
    await page.goto(BASE + GP + "/race", { waitUntil: "networkidle" });
    await page.addStyleTag({ content: "nextjs-portal{display:none!important} html{scroll-behavior:auto!important}" });
    const out = {};
    for (const [name, i] of [["pit", 12], ["steward", 17], ["whatif", 28]]) {
      await seeAt(page, await cardY(page, i, 0.2));
      const r = await page.evaluate((i) => {
        const c = document.querySelectorAll(".card")[i], h = c.querySelector("h2");
        const a = c.getBoundingClientRect(), b = h.getBoundingClientRect();
        return { x: a.left, y: a.top, w: a.width, h: b.bottom - a.top + 8 };
      }, i);
      await page.screenshot({ path: path.join(dir, name + ".png"), clip: { x: r.x, y: r.y, width: r.w, height: r.h } });
      out[name] = { w: Math.round(r.w * PHONE.scale), h: Math.round(r.h * PHONE.scale) };
    }
    await browser.close();
    fs.writeFileSync(path.join(dir, "strips.json"), JSON.stringify(out));
    return { frames: [], markers: out };
  },

  // the blind test, one second on the site: the sheet, the right name
  // clicked, then up to the file where the photograph lands
  async blind() {
    const n = span(96, 98) + 4;
    const rounds = JSON.parse(fs.readFileSync(path.resolve("../data/silverstone-2026/blind_race.json"), "utf8")).rounds;
    return record("blind", GP + "/race/blind", n, async (i, page, c) => {
      const act = {};
      if (i === 0) act.y = c.opts;
      if (i === 6) act.clickText = [".bt-opt", c.answer];
      if (i >= 9) act.y = Math.round(c.opts * (1 - smoother((i - 9) / 18)));
      return act;
    }, async (page) => {
      await page.locator(".bt-go").first().click();
      await page.waitForSelector(".bt-opt", { timeout: 15000 });
      await page.waitForTimeout(1500);
      const median = await page.evaluate(() => {
        const dt = [...document.querySelectorAll("dt")].find((d) => /median lap/i.test(d.textContent));
        return dt?.nextElementSibling?.textContent.trim() ?? null;
      });
      const r = rounds.find((x) => x.rows.some(([k, v]) => k === "Median lap" && v === median));
      return { opts: (await yOf(page, ".bt-opts", 0.3)) ?? 500, answer: r?.answer ?? "" };
    });
  },

  // the pit wall, one second on the site: the options, the call, the verdict
  async pitwall() {
    const n = span(110, 112) + 4;
    return record("pitwall", GP + "/race/pitwall", n, async (i, page, c) => {
      const act = {};
      if (i === 0) act.y = c.opts;
      if (i === 5) act.click = ".pw-opt";
      if (i >= 8) act.y = Math.round(c.opts + (c.out - c.opts) * smoother((i - 8) / 20));
      return act;
    }, async (page) => {
      await page.locator(".pw-go").first().click();
      await page.waitForSelector(".pw-opts", { timeout: 15000 });
      await page.waitForTimeout(1500);
      const opts = (await yOf(page, ".pw-opts", 0.2)) ?? 600;
      return { opts, out: opts + 700 };
    });
  },
};

const want = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(CLIPS);
const index = fs.existsSync(INDEX) ? JSON.parse(fs.readFileSync(INDEX, "utf8")) : {};
for (const name of want) {
  const t0 = Date.now();
  const got = await CLIPS[name]();
  const frames = Array.isArray(got) ? got : got.frames;
  index[name] = { w: 1080, h: 1920, fps: FPS, frames, ...(Array.isArray(got) || !got.half ? {} : { half: got.half }), markers: (!Array.isArray(got) && got.markers) || { frameExact: 1 } };
  fs.writeFileSync(INDEX, JSON.stringify(index));
  console.log(name, frames.length, "frames in", ((Date.now() - t0) / 1000).toFixed(0), "s");
}
