/**
 * The site's sound.
 *
 * Alfred's radio is a recording with dead air at the front: 1.3 seconds of
 * silence before anything happens, which is why it seemed to arrive late when
 * the file was simply playing its own quiet opening. A clip is decoded once,
 * the span that actually makes a noise is measured, and playback starts there.
 *
 * Web Audio rather than an audio element, because a buffer source starts on
 * the sample you ask for with none of the latency play() carries, and because
 * a gain node can fade a clip out without touching the element's volume.
 */

type Clip = { buffer: AudioBuffer; offset: number; audible: number };

const clips = new Map<string, Promise<Clip>>();
let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as {
      webkitAudioContext?: typeof AudioContext;
    }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  return ctx;
}

/**
 * The span of the recording that actually contains sound.
 *
 * Measured on a short RMS window rather than on single samples, because one
 * stray peak in a rip is not an onset. Both ends matter: the arrival clip is
 * five and a half seconds long and only 0.84 of that makes a noise, so playing
 * to the end of the file left two and a half seconds of silence running under
 * a curtain that was waiting for it.
 */
function audibleSpan(buffer: AudioBuffer): { offset: number; audible: number } {
  const ch = buffer.getChannelData(0);
  const sr = buffer.sampleRate;
  const win = Math.round(sr * 0.01);
  const env: number[] = [];
  for (let i = 0; i + win < ch.length; i += win) {
    let s = 0;
    for (let j = 0; j < win; j++) s += ch[i + j] * ch[i + j];
    env.push(Math.sqrt(s / win));
  }
  const peak = env.reduce((m, v) => Math.max(m, v), 0);
  if (peak === 0) return { offset: 0, audible: buffer.duration };
  const gate = peak * 0.05;
  let first = env.findIndex((v) => v > gate);
  let last = env.length - 1;
  while (last > first && env[last] <= gate) last--;
  if (first < 0) return { offset: 0, audible: buffer.duration };
  // a breath before the attack, and the tail of the decay
  const offset = Math.max(0, (first * win) / sr - 0.03);
  const end = Math.min(buffer.duration, ((last + 1) * win) / sr + 0.06);
  return { offset, audible: Math.max(0.05, end - offset) };
}

/** Fetches and decodes once. Safe to call on mount; it needs no gesture. */
export function loadSfx(url: string): Promise<Clip> | null {
  const ac = context();
  if (!ac) return null;
  let clip = clips.get(url);
  if (!clip) {
    clip = fetch(url)
      .then((r) => r.arrayBuffer())
      .then((b) => ac.decodeAudioData(b))
      .then((buffer) => ({ buffer, ...audibleSpan(buffer) }));
    clips.set(url, clip);
  }
  return clip;
}

/**
 * Plays a clip from its first audible sample.
 *
 * Called inside a click, so the context is allowed to start. A refusal is
 * swallowed: a silent transition is not a failure worth breaking anything for.
 */
export function playSfx(
  url: string,
  { volume = 0.22, maxMs = 0, fadeMs = 260 }: {
    volume?: number; maxMs?: number; fadeMs?: number;
  } = {}
): void {
  const ac = context();
  const clip = clips.get(url) ?? loadSfx(url);
  if (!ac || !clip) return;

  clip.then(({ buffer, offset, audible }) => {
    if (ac.state === "suspended") ac.resume().catch(() => {});
    const src = ac.createBufferSource();
    const gain = ac.createGain();
    src.buffer = buffer;
    gain.gain.value = volume;
    src.connect(gain).connect(ac.destination);

    const now = ac.currentTime;
    // by default a clip runs exactly as long as it makes a noise
    const room = audible;
    const runFor = maxMs > 0 ? Math.min(maxMs / 1000, room) : room;
    src.start(now, offset, runFor);

    // fade the tail rather than cutting it, when the clip is longer than the
    // moment it is decorating
    if (maxMs > 0 && room > runFor) {
      const fade = Math.min(fadeMs / 1000, runFor);
      gain.gain.setValueAtTime(volume, now + runFor - fade);
      gain.gain.linearRampToValueAtTime(0.0001, now + runFor);
    }
  }).catch(() => {});
}

export const SFX_RADIO = "/sfx/radio.mp4";

/* ---------------------------------------------------------------- the UI
   Generated rather than recorded: nobody's clip is borrowed, it weighs
   nothing, and a transient can be twelve milliseconds long on purpose.

   The first attempt was sine pips at two kilohertz and it sounded like a
   handheld game, because a pure tone up there is a beep and a beep is a toy.
   Nothing in a garage makes that noise. A switch, a relay, a paddle behind a
   steering wheel: every one of them is a broadband transient with a low body
   under it and no pitch you could hum. So that is what these are, built from
   filtered noise over a short low thud, kept under 900Hz where equipment
   lives, and with no interval between two sounds that could be mistaken for a
   tune. */

let noise: AudioBuffer | null = null;

/** One second of white noise, made once and reused for every transient. */
function noiseBuffer(ac: AudioContext): AudioBuffer {
  if (!noise) {
    noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noise;
}

/** The transient: the sound of contact, before anything resonates. */
function snap(
  ac: AudioContext,
  { at = 0, ms = 14, hz = 1200, q = 1.1, gain = 0.05 }
): void {
  const t = ac.currentTime + at / 1000;
  const src = ac.createBufferSource();
  const band = ac.createBiquadFilter();
  const amp = ac.createGain();
  src.buffer = noiseBuffer(ac);
  src.loop = true;
  band.type = "bandpass";
  band.frequency.value = hz;
  band.Q.value = q;
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(gain, t + 0.0015);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
  src.connect(band).connect(amp).connect(ac.destination);
  src.start(t);
  src.stop(t + ms / 1000 + 0.02);
}

/** The body: what the housing does after the contact. No melody in it. */
function body(
  ac: AudioContext,
  { at = 0, ms = 60, hz = 140, to = 0, gain = 0.04 }
): void {
  const t = ac.currentTime + at / 1000;
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(hz, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + ms / 1000);
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(gain, t + 0.004);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
  osc.connect(amp).connect(ac.destination);
  osc.start(t);
  osc.stop(t + ms / 1000 + 0.02);
}

function withCtx(fn: (ac: AudioContext) => void): void {
  const ac = context();
  if (!ac) return;
  if (ac.state === "suspended") ac.resume().catch(() => {});
  fn(ac);
}

/** A switch closing. Anything you can click gets this one. */
export const uiTick = () =>
  withCtx((ac) => {
    snap(ac, { ms: 11, hz: 1500, q: 1.4, gain: 0.045 });
    body(ac, { ms: 34, hz: 165, to: 120, gain: 0.03 });
  });

/** Heavier contact, and a housing with more in it: a way in taken. */
export const uiConfirm = () =>
  withCtx((ac) => {
    snap(ac, { ms: 16, hz: 900, q: 0.9, gain: 0.055 });
    body(ac, { ms: 95, hz: 104, to: 74, gain: 0.055 });
  });

/** The same latch let go of, drier and further down. */
export const uiBack = () =>
  withCtx((ac) => {
    snap(ac, { ms: 9, hz: 700, q: 1.2, gain: 0.03 });
    body(ac, { ms: 70, hz: 96, to: 72, gain: 0.04 });
  });

/** Two dry pulses off a timing gantry. Flat on purpose: a rising figure is a
 *  reward noise, and this is a confirmation. */
export const uiRight = () =>
  withCtx((ac) => {
    snap(ac, { ms: 10, hz: 1100, q: 1.6, gain: 0.035 });
    body(ac, { ms: 46, hz: 620, gain: 0.03 });
    snap(ac, { at: 108, ms: 10, hz: 1100, q: 1.6, gain: 0.035 });
    body(ac, { at: 108, ms: 52, hz: 620, gain: 0.03 });
  });

/** A dead knock. Nothing resonates and nothing bends: it simply stops. */
export const uiWrong = () =>
  withCtx((ac) => {
    snap(ac, { ms: 22, hz: 320, q: 0.7, gain: 0.05 });
    body(ac, { ms: 130, hz: 78, to: 58, gain: 0.06 });
  });

/** Nothing makes a noise for somebody who asked for less of it. */
export function soundAllowed(): boolean {
  return typeof window !== "undefined"
    && !matchMedia("(prefers-reduced-motion: reduce)").matches;
}
