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
  window.__step = (ms, anim = ms) => {
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
      if (an.playState !== "finished") an.currentTime = (an.currentTime ?? 0) + anim;
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
  // the film's caption is the only header above Scroll it; the site's nav and footnote stay out
  if (PHONE.viewport === READ_VIEW || PHONE.viewport === PC_VIEW) await page.addStyleTag({ content: ".hub-top,.trackcap{display:none!important}" });
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
    // act.ms: how far the page's clock moves on this frame (a race in fast
    // forward, or standing still); act.anim: how far its CSS animations move
    if (act?.foc) await page.evaluate((src) => { window.__foc = new Function(`return (${src})`); }, act.foc);
    const ms = act?.ms ?? STEP / sub;
    await page.evaluate(([ms, anim]) => {
      const n = Math.max(1, Math.ceil(ms / 40));
      for (let q = 0; q < n; q++) window.__step(ms / n, anim / n);
    }, [ms, act?.anim ?? ms]);
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

/* ---------- the two games, played on camera (02/11/2026): the screen under
   the film's caption, no nav, the race in fast forward where nothing happens ---------- */

const GAME_VIEW = { width: 432, height: 580 };
const GAME_CSS = `.hub-top{display:none!important} .px-left{top:0!important} .px-coach,.px-feed{display:none!important}
  .px-row.is-out{opacity:1!important;background:#3a0806}
  .cr-game{padding-top:14px!important} .cr-sheet{max-height:none!important}
  .cr-ctx,.cr-opt small,.cr-skip{display:none!important}
  .cr-marks,.cr-review,.cr-share span,.myst-link{display:none!important}
  .px-row:not(.is-mine) .px-buy:not(:disabled){background:transparent!important;color:#9a9a9a!important;box-shadow:inset 0 0 0 1px #3a3a3a}
  .px-cashline{display:none!important} .px-row.is-mine .px-who{align-self:center!important;padding-top:0!important}
  .px-row.is-mine .px-hold{display:flex!important;flex-direction:column;align-items:center;justify-content:center;position:absolute;left:auto;bottom:auto;right:63.6px;top:5.6px;width:82.4px;height:42px;background:#160403;border-radius:3px;box-shadow:inset 0 0 0 1px #5a1a14;text-align:center;font-size:10px;color:#c8c8c8;white-space:nowrap}
  .px-row.is-mine .px-hold b{display:block;font-size:18px;line-height:1.15}`;
/** Scroll it and Pick a race fill the width of the frame under the caption */
const READ_VIEW = { width: 432, height: 580 };
/** the film in PC format (scenes in src/pc): the site's desktop layout, 1400x1080 at the right of a 1920x1080 frame */
const PC_VIEW = { width: 1040, height: 802 };
const PC_CLIPS = new Set(["pNav", "pWeek", "pRaceCard", "pWall", "pSteward", "pGuess", "pPlayCall", "pPlayExchange"]);
/** the cards, big enough to read in a film */
const PC_CARD = `.card{zoom:1.3}`;
const PC_CALL_CSS = `.card>p,.call-cost{display:none!important}`;
const PC_CALL_GAME = `.hub-top{display:none!important} .cr-skip,.cr-marks,.cr-review,.cr-share span,.myst-link{display:none!important} .cr-sheet{max-height:none!important}`;
const PC_EXCHANGE_GAME = `.hub-top{display:none!important} .px-left{top:0!important} .px-coach,.px-feed{display:none!important}
  .px-row.is-out{opacity:1!important;background:#3a0806}
  .cr-share span,.myst-link{display:none!important}
  .px-row:not(.is-mine) .px-buy:not(:disabled){background:transparent!important;color:#9a9a9a!important;box-shadow:inset 0 0 0 1px #3a3a3a}`;
const READ_CLIPS = new Set(["navhome", "sWeek", "sRaceCard", "boxes", "pBoxes", "sSteward", "sWall", "sGuess", "sMate"]);
/** a card's top, as a fraction of the screen: under the lap counter (measured before its 20px rise) */
const CARD_K = 0.15;
/** the boxes say one thing each on film: the lap counter up top, the small print out */
const CARD_CSS = `.hud{top:10px!important} .mate-fab{display:none!important} .card .pts,.card .note{display:none!important}
  .v-sc{border-color:#f5c400b0!important;background:linear-gradient(#f5c40024,#111 80%)!important} .v-sc::before{height:10px!important}`;
/** a session's page in a few seconds: its boxes one under the other, all lit, the track behind them */
const FEED_CSS = `.spacer{height:16px!important} .biglap{display:none!important} .trackwrap{opacity:.22!important}
  .card{opacity:1!important;transform:none!important;filter:none!important}`;
/** a decision on film: the question, the options and what happened */
const CALL_CSS = `.card>p,.call-state,.call-opt span,.call-cost{display:none!important}
  .call-opt{padding:17px 16px!important} .call-opt b{font-size:18px!important}
  .call-opt em{font-size:11px!important;top:50%!important;transform:translateY(-50%)}
  .call-verdict{font-size:14px!important;letter-spacing:.1em!important} .call-reveal{font-size:16px!important}`;
/** a card on the page, by what it says: its position changes when the data is rebuilt */
const CARD_EL = (kick, title = ".") => `[...document.querySelectorAll(".card")].find((c) => /${kick}/i.test(c.querySelector(".kicker")?.textContent ?? "") && /${title}/i.test(c.querySelector("h2")?.textContent ?? ""))`;
const STEWARD = CARD_EL("you are the steward");
const WALL = CARD_EL("pit wall", "^safety car");
const GUESS = CARD_EL("guess it");
/** a decision's option, by the start of its label */
const OPT = (card, label) => `[...(${card}).querySelectorAll(".call-opt")].find((o) => o.querySelector("b").textContent.startsWith("${label}"))`;
const ROW = (c) => `[...document.querySelectorAll(".px-row")].find((r) => r.querySelector(".px-who b")?.textContent === "${c}")`;

/** clicks what `src` finds and notes where, so the film can draw the finger */
const press = async (page, src, i, taps) => {
  const at = await page.evaluate((src) => {
    const el = new Function(`return (${src})`)();
    if (!el) return null;
    const b = el.getBoundingClientRect();
    el.click();
    return [b.left + b.width / 2, b.top + b.height / 2];
  }, src);
  if (!at) throw new Error(`press: nothing at ${src}`);
  taps.push([i, ...at.map((v) => Math.round(v * 10) / 10)]);
};
/** the moment the leader finishes a (fractional) lap, in race seconds */
const lapClock = (r) => (lap) => {
  const whole = (l) => Math.min(...r.field.map((c) => c.cross[l] ?? Infinity));
  const l = Math.floor(lap), a = whole(l);
  return lap > l ? a + (lap - l) * (whole(l + 1) - a) : a;
};
/** the page's clock on a film beat: straight lines between the keys */
const onKeys = (keys, beat) => {
  if (beat <= keys[0][0]) return keys[0][1];
  for (let k = 1; k < keys.length; k++) {
    if (beat <= keys[k][0]) return keys[k - 1][1] + ((beat - keys[k - 1][0]) / (keys[k][0] - keys[k - 1][0])) * (keys[k][1] - keys[k - 1][1]);
  }
  return keys[keys.length - 1][1];
};
const onScreen = async (fn) => {
  if (PHONE.viewport === PC_VIEW) return fn();
  const keep = PHONE.viewport;
  PHONE.viewport = GAME_VIEW;
  try { return await fn(); } finally { PHONE.viewport = keep; }
};

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
  async navhome(name = "navhome") {
    const n = span(24, 32);
    const f = (beat) => span(24, 24 + beat);
    let m = {};
    const frames = await record(name, "/", n, async (i, page, c) => {
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

  // every part of the weekend: the five sessions on screen; the film walks down them (32-36.5)
  async sWeek(name = "sWeek", pan = false) {
    const [a, z] = [32, 36.5];
    const f = (beat) => span(a, beat);
    let rows = [];
    const frames = await record(name, GP + "/sessions", f(z) + PAD, async (i, page, c) => ({ y: pan ? c.y * glide((i - f(32.3)) / (f(33.3) - f(32.3)), 0.25, 0.4) : c.y }), async (page) => {
      const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
      await page.evaluate((y) => scrollTo(0, y), max);
      await page.waitForTimeout(500);
      rows = await page.evaluate(() => [...document.querySelectorAll(".hub-session")].map((r) => { const b = r.getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; }));
      return { y: max };
    });
    return { frames, markers: { rows } };
  },

  // the race, from the first screen of its page: a finger scrolls down to two of its cards,
  // and each one stays long enough to read (36.5-47)
  async sRaceCard(name = "sRaceCard", css = CARD_CSS + FEED_CSS, k = CARD_K) {
    const [a, z] = [36.5, 47];
    const f = (beat) => span(a, beat);
    const LAP1 = CARD_EL("lights out"), LIMITS = CARD_EL("track limits");
    const frames = await record(name, GP + "/race", f(z) + PAD, async (i, page, c) => {
      const act = { y: c.to[0] * glide((i - f(37.4)) / (f(38.4) - f(37.4)), 0.25, 0.45) };
      if (i >= f(42)) act.y = c.to[0] + (c.to[1] - c.to[0]) * glide((i - f(42)) / (f(43) - f(42)), 0.25, 0.45);
      if (i === 0) act.foc = LAP1;
      if (i === f(42.5)) act.foc = LIMITS;
      return act;
    }, async (page) => {
      await page.addStyleTag({ content: css });
      const to = await page.evaluate(([list, k]) => list.map((src) => Math.round(scrollY + new Function(`return (${src})`)().getBoundingClientRect().top - innerHeight * k)), [[LAP1, LIMITS], k]);
      return { to, focus: `window.__foc ? window.__foc() : null` };
    });
    return { frames, markers: { focus: FOCUS.slice() } };
  },

  /** a card held still, with a short drift onto it; `act` adds clicks and taps */
  async hold(name, a, z, card, k, act = () => ({}), more = () => 0, css = "", url = GP + "/race") {
    const f = (beat) => span(a, beat);
    const taps = [];
    const frames = await record(name, url, f(z) + PAD, async (i, page, c) => {
      const y = c.y - 40 * (1 - glide((i - f(a + 0.1)) / (f(a + 1.4) - f(a + 0.1)), 0.1, 0.6)) + more(i, f);
      return { y, ...(await act(i, f, page, taps)) };
    }, async (page) => {
      if (css) await page.addStyleTag({ content: css });
      const el = typeof card === "number" ? `document.querySelectorAll(".card")[${card}]` : card;
      const y = await page.evaluate(([src, k]) => {
        const b = new Function(`return (${src})`)().getBoundingClientRect();
        return Math.round(scrollY + b.top - innerHeight * k);
      }, [el, k]);
      await seeAt(page, y - 40 + more(0, f));
      return { y, focus: el };
    });
    return { frames, markers: { focus: FOCUS.slice(), taps } };
  },

  // how a box looks depends on what happened: real cards, stills, Silverstone's
  // and Monaco's red (Silverstone had no red flag). The film stacks them (47-49.5)
  async boxes(name = "boxes", css = "") {
    const dir = path.join(OUT, name);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    const browser = await chromium.launch({ channel: "chrome" });
    const ctx = await browser.newContext({ viewport: PHONE.viewport, deviceScaleFactor: PHONE.scale });
    const page = await ctx.newPage();
    const out = {};
    for (const [gp, list] of [[GP, [["fast", CARD_EL("fastest lap")], ["car", CARD_EL("(?<!virtual )safety car")]]], ["/gp/monaco-2026", [["red", CARD_EL("\\bred flag")]]]]) {
      await page.goto(BASE + gp + "/race", { waitUntil: "networkidle" });
      await page.addStyleTag({ content: `nextjs-portal{display:none!important} html{scroll-behavior:auto!important}
        .hub-top,.trackcap,.hud,.biglap,.mate-fab,.card .pts,.card .note,.card .dato{display:none!important}
        .v-sc{border-color:#f5c400b0!important;background:linear-gradient(#f5c40024,#111 80%)!important} .v-sc::before{height:10px!important}` + css });
      for (const [box, el] of list) {
        await page.evaluate((src) => { const c = new Function(`return (${src})`)(); scrollTo(0, scrollY + c.getBoundingClientRect().top - innerHeight * 0.2); }, el);
        await page.waitForTimeout(1500);
        // it comes from another race: the card says so
        if (box === "red") await page.evaluate((src) => { const k = new Function(`return (${src})`)().querySelector(".kicker"); k.textContent = `Monaco · ${k.textContent}`; }, el);
        let r = await page.evaluate((src) => { const b = new Function(`return (${src})`)().getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; }, el);
        // pBoxes: the crop snaps inside the card, or a sliver of the page above rounds into it
        if (name !== "boxes") { const x = Math.ceil(r.x), y = Math.ceil(r.y); r = { x, y, w: Math.floor(r.x + r.w) - x, h: Math.floor(r.y + r.h) - y }; }
        await page.screenshot({ path: path.join(dir, box + ".png"), clip: { x: r.x, y: r.y, width: r.w, height: r.h } });
        out[box] = { w: Math.round(r.w * PHONE.scale), h: Math.round(r.h * PHONE.scale) };
      }
    }
    await browser.close();
    return { frames: [], markers: out };
  },

  // the decisions, played. You are the steward: no further action, what they did (57.5-64)
  async sSteward(name = "sSteward", css = CARD_CSS + CALL_CSS, k = CARD_K) {
    return CLIPS.hold(name, 57.5, 64, STEWARD, k, async (i, f, page, taps) => {
      if (i === f(60.6)) await press(page, OPT(STEWARD, "No further action"), i, taps);
      return {};
    }, () => 0, css);
  },
  // your call on the pit wall: you stay out, they boxed (51.5-57.5)
  async sWall(name = "sWall", css = CARD_CSS + CALL_CSS, k = CARD_K, a = 51.5, more = () => 0) {
    return CLIPS.hold(name, a, 57.5, WALL, k, async (i, f, page, taps) => {
      if (i === f(54.3)) await press(page, OPT(WALL, "Stay out"), i, taps);
      return {};
    }, more, css);
  },
  // guess it: the slider pulled to 0.45, locked, the real 0.427 (64-69)
  async sGuess(name = "sGuess", css = CARD_CSS + CALL_CSS, k = CARD_K) {
    const thumbs = [];
    const r = await CLIPS.hold(name, 64, 69, GUESS, k, async (i, f, page, taps) => {
      if (i === f(66.2)) await press(page, `document.querySelector(".guess .lock")`, i, taps);
      // where the thumb is on this frame, for the film's finger
      thumbs.push(await page.evaluate(() => {
        const el = document.querySelector(".guess-range");
        if (!el) return null;
        const b = el.getBoundingClientRect(), v = (+el.value - +el.min) / (+el.max - +el.min);
        return [Math.round((b.left + 22 + v * (b.width - 44)) * 10) / 10, Math.round((b.top + b.height / 2) * 10) / 10];
      }));
      return {};
    }, (i, f) => {
      SLIDE.v = Math.round((1 + (0.45 - 1) * glide((i - f(64.4)) / (f(65.7) - f(64.4)), 0.3, 0.4)) / 0.05) * 0.05;
      return 0;
    }, css + ".poster{visibility:hidden} .guess .call-reveal{display:none!important}");
    r.markers.thumbs = thumbs;
    return r;
  },
  // ask Alfred: at the flag, opened, asked (59-64)
  async sMate() {
    const [a, z] = [59, 64];
    const f = (beat) => span(a, beat);
    const frames = await record("sMate", GP + "/race", f(z) + PAD, async (i) => {
      const act = {};
      if (i === f(59.8)) act.click = ".mate-asks button";
      return act;
    }, async (page) => {
      // with Alfred open, nothing of the page shows round his panel
      await page.addStyleTag({ content: "body:has(.mate.open) .flow{opacity:0!important}" });
      const y = await cardY(page, 32, 0.2);
      await seeAt(page, y);
      // he has said his piece before the shot opens: the only thing he says on
      // camera is the answer to the question
      await page.locator(".mate-fab").click();
      await page.waitForTimeout(800);
      await page.waitForFunction(() => !document.querySelector(".bub.typing"), null, { timeout: 90000 });
      await page.waitForTimeout(600);
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

  // game 1, played on camera, 70-96: the race runs, stops on lap 24 as Leclerc pits from
  // the lead and asks if he comes out ahead of Norris; yes, certain; the race runs on to
  // lap 26 and answers, the one call whose answer lands alone and before the next question.
  // The film dives into its last beats on the way to the drop
  async playCall(name = "playCall", css = GAME_CSS) {
    const [a, z] = [70, 96];
    const f = (beat) => span(a, beat);
    const r = JSON.parse(fs.readFileSync(path.resolve("../data/silverstone-2026/replay_race.json"), "utf8"));
    const lap = lapClock(r);
    const speed = (lap(r.laps) + 6) / 150; // the game's own: three minutes a race
    // the calls before it, answered off camera: right at 50, wrong at 25, wrong at 25, right at 10, wrong at 10,
    // and they come to 0 on lap 24, so the shot's only change to the points after that is its own +50
    const call = r.calls[7];
    const BEFORE = [[true, 3], [false, 2], [false, 2], [true, 1], [false, 1], [false, 1]];
    const answered = Math.max(...call.cars.map((n) => r.field.find((c) => c.num === n).cross[call.reveal])) + 0.3;
    // to the stop, plus the last off-camera answer read (4.2 s on the game's clock) before the question comes up
    const run = lap(call.lap) - lap(r.calls[6].lap) + speed * 4.4, back = answered - lap(call.lap);
    const KEYS = [[70.2, 0], [73, run], [84.9, run], [88.6, run + back], [96, run + back + speed * 4]];
    const wrongOf = (c) => c.options.find((o) => o.id !== c.answer && o.id !== "other");
    const wrong = wrongOf(r.calls[6]);
    const taps = [];
    const frames = await onScreen(() => record(name, GP + "/race/call", f(z) + PAD, async (i, page, c) => {
      if (i === 0) await page.evaluate((txt) => [...document.querySelectorAll(".cr-opt")].find((e) => e.textContent.includes(txt))?.click(), wrong.label);
      if (i === 1) await page.evaluate(() => document.querySelector(".cr-stake button:first-child")?.click());
      if (i === 2) await page.evaluate(() => document.querySelector(".cr-lock")?.click());
      if (i === f(79.5)) c.foc = `document.querySelector(".cr-opts")`;
      if (i === f(81.5)) c.foc = `document.querySelector(".cr-stake")`;
      if (i === f(83.4)) c.foc = `document.querySelector(".cr-lock")`;
      if (i === f(80.3)) await press(page, `[...document.querySelectorAll(".cr-opt")].find((e) => e.textContent.includes("Yes,"))`, i, taps);
      if (i === f(82.2)) await press(page, `document.querySelector(".cr-stake button:last-child")`, i, taps);
      if (i === f(84.2)) await press(page, `document.querySelector(".cr-lock")`, i, taps);
      // only the answer this shot is about shows its result
      if (i >= f(88.2)) await page.evaluate(() => document.querySelector(".cr-toast")?.classList.add("film"));
      // the answer has been read: the film dives into the track behind it
      if (i === f(92.1)) await page.addStyleTag({ content: ".cr-toast{transition:opacity .3s;opacity:0!important}" });
      const beat = a + (i * STEP) / 1000 / BEAT;
      const dt = onKeys(KEYS, beat) - onKeys(KEYS, a + ((i - 1) * STEP) / 1000 / BEAT);
      const foc = i >= f(85) ? null : c.foc;
      if (foc !== c.was) { c.was = foc; await page.evaluate((src) => { window.__foc = src ? new Function(`return (${src})`) : null; }, foc ?? null); }
      return dt > 0 && i > 2 ? { ms: (dt / speed) * 1000 } : {};
    }, async (page) => {
      await page.addStyleTag({ content: css });
      await page.locator(".bt-go").first().click();
      await page.addStyleTag({ content: ".cr-toast{visibility:hidden} .cr-toast.film{visibility:visible}" });
      // the race up to lap 22, on the page's own clock and its own skip button; the seventh call goes on the first frames
      for (let n = 0; n <= BEFORE.length; n++) {
        const open = async () => (await page.locator(".cr-sheet:not(.is-closing)").count()) > 0;
        for (let g = 0; g < 200 && !(await open()); g++) {
          await page.evaluate(() => document.querySelector(".cr-skip")?.click());
          await page.waitForTimeout(400);
        }
        if (!(await open())) throw new Error(`playCall: call ${n} never came up`);
        if (n === BEFORE.length) break;
        await page.waitForTimeout(400);
        const c = r.calls[n], [right, stake] = BEFORE[n];
        const opt = right ? c.options.find((o) => o.id === c.answer) : wrongOf(c);
        await page.locator(".cr-opt", { hasText: opt.label }).first().click();
        await page.locator(`.cr-stake button:nth-child(${stake})`).click();
        await page.locator(".cr-lock").click();
        await page.waitForTimeout(600);
      }
      return { focus: `window.__foc ? window.__foc() : null` };
    }));
    return { frames, markers: { focus: FOCUS.slice(), taps } };
  },

  // (02/11/2026) game 2, played on camera, 97.5-128. 1,000 to spend: 100 on
  // Verstappen at 80, 200 on Colapinto at 20. Colapinto climbs and is sold at 60
  // (600); Verstappen, worth 125 by then, retires on lap 47. 700 + 600 = 1,300.
  async playExchange(name = "playExchange", css = GAME_CSS, Y_SELL = 130, Y_OUT = 70) {
    const [a, z] = [97.5, 128];
    const f = (beat) => span(a, beat);
    const r = JSON.parse(fs.readFileSync(path.resolve("../data/silverstone-2026/replay_race.json"), "utf8"));
    const lap = lapClock(r);
    const speed = lap(r.laps) / (r.laps * Math.min(3.2, Math.max(1.6, 120 / r.laps))); // the game's own
    const KEYS = [[105.5, 0], [108.7, lap(6.5)], [111, lap(44)], [111.6, lap(44.3)], [114.5, lap(45.2)], [115.8, lap(46)], [119, lap(47)], [120.85, lap(r.laps) + 0.2]];
    // Y_SELL: Colapinto in P11 on screen; Y_OUT: Verstappen in P3 on screen
    const taps = [];
    let hud = 0;
    const frames = await onScreen(() => record(name, GP + "/race/exchange", f(z) + PAD, async (i, page, c) => {
      const act = {};
      if (i === 0) { act.click = ".px-cover .bt-go"; act.foc = ROW("VER"); }
      if (i === f(102.8)) act.foc = ROW("COL");
      if (i === f(114.5)) act.foc = ROW("VER");
      if (i === f(102.2)) await press(page, `${ROW("VER")}.querySelector(".px-buy")`, i, taps);
      if (i === f(104) || i === f(104.6)) await press(page, `${ROW("COL")}.querySelector(".px-buy")`, i, taps);
      if (i === f(113.3)) await press(page, `${ROW("COL")}.querySelector(".px-sell")`, i, taps);
      const beat = a + (i * STEP) / 1000 / BEAT;
      // the camera: down to Colapinto, up the order with him, then to Verstappen
      if (beat >= 102.8 && beat < 110) {
        const target = await page.evaluate((src) => {
          const b = new Function(`return (${src})`)()?.getBoundingClientRect();
          return b ? Math.max(0, scrollY + b.top - innerHeight * 0.58) : 0;
        }, ROW("COL"));
        if (beat < 103.8) c.y = target * glide(beat - 102.8, 0.3, 0.35);
        else c.y += (target - c.y) * 0.3;
        act.y = c.y;
      } else if (beat >= 110 && beat < 111.5) {
        c.from ??= c.y;
        act.y = c.from + (Y_SELL - c.from) * glide((beat - 110) / 1.5, 0.3, 0.35);
      } else if (beat >= 111.5 && beat < 114.5) act.y = Y_SELL;
      else if (beat >= 114.5 && beat < 115.5) act.y = Y_SELL + (Y_OUT - Y_SELL) * glide(beat - 114.5, 0.3, 0.35);
      else if (beat >= 115.5 && beat < 122) act.y = Y_OUT;
      // the clock: stopped on the grid while you buy, then the keys
      if (beat < 105.5) { act.ms = 0; act.anim = STEP; } else if (beat >= 115.8 && beat < 119) {
        // up to the line on lap 47, and the screen holds still where Verstappen goes out
        // (the rows are pinned where they were, or his row is gone before anyone can read it)
        if (!c.pinned) {
          c.pinned = true;
          await page.evaluate(() => {
            const rows = [...document.querySelectorAll(".px-row")];
            const css = rows.map((r, n) => `.px-row:nth-child(${n + 1}){--i:${r.style.getPropertyValue("--i")}!important}`).join("");
            document.head.insertAdjacentHTML("beforeend", `<style id="pin">${css}</style>`);
          });
        }
        const now = await page.evaluate(() => parseInt(document.querySelector(".px-lap b")?.textContent ?? "0"));
        if (now >= 47) { act.ms = 0; act.anim = STEP; } else { act.ms = STEP * 6; act.anim = STEP; }
      } else if (beat <= 120.85) {
        if (c.pinned && !c.freed) { c.freed = true; await page.evaluate(() => document.getElementById("pin")?.remove()); }
        const dt = onKeys(KEYS, beat) - onKeys(KEYS, a + ((i - 1) * STEP) / 1000 / BEAT);
        act.ms = Math.max(0, (dt / speed) * 1000);
        act.anim = Math.max(STEP, Math.min(act.ms, STEP * 3));
      }
      return act;
    }, async (page) => {
      await page.addStyleTag({ content: css });
      return { focus: `window.__foc ? window.__foc() : null` };
    }));
    hud = await onScreen(async () => {
      const browser = await chromium.launch({ channel: "chrome" });
      const ctx = await browser.newContext({ viewport: GAME_VIEW, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      await page.goto(BASE + GP + "/race/exchange", { waitUntil: "networkidle" });
      await page.addStyleTag({ content: GAME_CSS });
      await page.locator(".px-cover .bt-go").click();
      await page.waitForSelector(".px-left");
      const h = await page.evaluate(() => document.querySelector(".px-left").getBoundingClientRect().height);
      await browser.close();
      return h;
    });
    return { frames, markers: { focus: FOCUS.slice(), taps, hud } };
  },

  // (30/10/2026) Call the race, on the site: the first question frozen on the
  // grid, Leclerc picked, all in. The film uses its frames as screens.
  async call() {
    const n = span(96, 98) + 4;
    return record("call", GP + "/race/call", n, async (i) => {
      const act = {};
      if (i === 10) act.clickText = [".cr-opt", "Leclerc"];
      if (i === 26) act.click = ".cr-stake button:last-child";
      return act;
    }, async (page) => {
      await page.locator(".bt-go").first().click();
      await page.waitForSelector(".cr-sheet", { timeout: 20000 });
      await page.waitForTimeout(1200);
      return {};
    });
  },

  // Paddock exchange, on the site: the market twenty seconds in, two drivers
  // bought on the grid, one cashed out on camera
  async exchange() {
    const n = span(110, 112) + 4;
    return record("exchange", GP + "/race/exchange", n, async (i) => {
      const act = {};
      if (i === 30) act.click = ".px-row.is-mine .px-sell";
      return act;
    }, async (page) => {
      await page.locator(".px-cover .bt-go").click();
      await page.waitForSelector(".px-row");
      for (const code of ["COL", "LEC"]) await page.locator(`.px-row:has(b:text-is("${code}")) .px-buy`).click();
      await page.waitForTimeout(20000);
      return {};
    });
  },

  /* ---- the film in PC format: the same shots on the desktop layout ---- */
  async pNav() { return CLIPS.navhome("pNav"); },
  async pWeek() { return CLIPS.sWeek("pWeek", true); },
  async pRaceCard() { return CLIPS.sRaceCard("pRaceCard", CARD_CSS + PC_CARD, 0.18); },
  // (10/11) the film deals the coloured cards onto a stack (ScrolledPC, 47-49.5): taken
  // standing still, so nothing from the page above slips into the shot, and no word alone on a line
  async pBoxes() { return CLIPS.boxes("pBoxes", `.card{transition:none!important;animation:none!important;transform:none!important;opacity:1!important;outline:4px solid #0a0a0a!important} .card p{text-wrap:pretty} .trackwrap{visibility:hidden!important}`); },
  // (10/11) the page scrolls down into the decision: "as you scroll, the race asks you"
  async pWall() { return CLIPS.sWall("pWall", CARD_CSS + PC_CARD + PC_CALL_CSS, 0.15, 49.5, (i, f) => -900 * (1 - glide((i - f(49.7)) / (f(51.3) - f(49.7)), 0.3, 0.4))); },
  async pSteward() { return CLIPS.sSteward("pSteward", CARD_CSS + PC_CARD + PC_CALL_CSS + ".call-state{display:none!important}", 0.15); },
  async pGuess() { return CLIPS.sGuess("pGuess", CARD_CSS + PC_CARD + PC_CALL_CSS, 0.15); },
  async pPlayCall() { return CLIPS.playCall("pPlayCall", PC_CALL_GAME); },
  async pPlayExchange() { return CLIPS.playExchange("pPlayExchange", PC_EXCHANGE_GAME, 0, 0); },
};

const want = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(CLIPS);
const index = fs.existsSync(INDEX) ? JSON.parse(fs.readFileSync(INDEX, "utf8")) : {};
for (const name of want) {
  const t0 = Date.now();
  const pc = PC_CLIPS.has(name);
  PHONE.viewport = pc ? PC_VIEW : READ_CLIPS.has(name) ? READ_VIEW : { width: 432, height: 768 };
  PHONE.scale = pc ? 1400 / PC_VIEW.width : 2.5;
  const got = await CLIPS[name]();
  const frames = Array.isArray(got) ? got : got.frames;
  index[name] = { w: pc ? 1400 : 1080, h: pc ? 1080 : 1920, fps: FPS, frames, ...(Array.isArray(got) || !got.half ? {} : { half: got.half }), markers: (!Array.isArray(got) && got.markers) || { frameExact: 1 } };
  fs.writeFileSync(INDEX, JSON.stringify(index));
  console.log(name, frames.length, "frames in", ((Date.now() - t0) / 1000).toFixed(0), "s");
}
