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
   The interface sounds are generated rather than recorded. Nobody's clip is
   being borrowed, they weigh nothing, and a pip built from an oscillator can
   be forty milliseconds long on purpose instead of by trimming.
   
   The vocabulary is the sport's own: the pip of a timing screen, the two-tone
   of a confirmation, the dry low knock of going back. Everything sits around
   five per cent gain, because a sound you notice on the second click is a
   sound you will hate on the twentieth. */

type Pip = { hz: number; ms: number; at?: number; type?: OscillatorType; gain?: number };

function pips(parts: Pip[], master = 1): void {
  const ac = context();
  if (!ac) return;
  if (ac.state === "suspended") ac.resume().catch(() => {});
  const t0 = ac.currentTime;
  for (const p of parts) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    const start = t0 + (p.at ?? 0) / 1000;
    const dur = p.ms / 1000;
    const peak = (p.gain ?? 0.05) * master;
    osc.type = p.type ?? "sine";
    osc.frequency.setValueAtTime(p.hz, start);
    // a couple of milliseconds of attack, then an exponential tail: a square
    // gate on an oscillator is a click, and not the good kind
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(gain).connect(ac.destination);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }
}

/** The timing screen pip. Anything you can click gets this one. */
export const uiTick = () => pips([{ hz: 2050, ms: 0.032 * 1000, gain: 0.035 }]);

/** Two tones rising: something committed, a way in taken. */
export const uiConfirm = () =>
  pips([
    { hz: 1480, ms: 34, gain: 0.045 },
    { hz: 2220, ms: 46, at: 46, gain: 0.04 },
  ]);

/** Lower and drier: a step back out of somewhere. */
export const uiBack = () => pips([{ hz: 880, ms: 40, gain: 0.035 }]);

/** Three rising pips, the sound of a lap time going green. */
export const uiRight = () =>
  pips([
    { hz: 1320, ms: 30, gain: 0.04 },
    { hz: 1760, ms: 30, at: 34, gain: 0.04 },
    { hz: 2640, ms: 56, at: 68, gain: 0.038 },
  ]);

/** One flat low tone that bends down, and no second chance about it. */
export function uiWrong(): void {
  const ac = context();
  if (!ac) return;
  if (ac.state === "suspended") ac.resume().catch(() => {});
  const t = ac.currentTime;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(300, t);
  osc.frequency.exponentialRampToValueAtTime(190, t + 0.13);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.05, t + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
  osc.connect(gain).connect(ac.destination);
  osc.start(t);
  osc.stop(t + 0.17);
}

/** Nothing makes a noise for somebody who asked for less of it. */
export function soundAllowed(): boolean {
  return typeof window !== "undefined"
    && !matchMedia("(prefers-reduced-motion: reduce)").matches;
}
