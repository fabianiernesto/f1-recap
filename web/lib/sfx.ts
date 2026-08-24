/**
 * The site's two sounds.
 *
 * Both clips are recordings with dead air at the front: the arrival carries
 * 2.2 seconds of silence before anything happens and the radio 1.3, which is
 * why they seemed to arrive late when the file was simply playing its own
 * quiet opening. Every clip is decoded once, the first audible sample is
 * measured, and playback starts there.
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

export const SFX_ARRIVE = "/sfx/arrive.mp4";
export const SFX_RADIO = "/sfx/radio.mp4";
