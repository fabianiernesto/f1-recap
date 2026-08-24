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

type Clip = { buffer: AudioBuffer; offset: number };

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

/** Where the recording stops being silent, in seconds. */
function firstAudible(buffer: AudioBuffer): number {
  const ch = buffer.getChannelData(0);
  // a real onset, not the noise floor of a rip
  for (let i = 0; i < ch.length; i++)
    if (Math.abs(ch[i]) > 0.02) return Math.max(0, i / buffer.sampleRate - 0.02);
  return 0;
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
      .then((buffer) => ({ buffer, offset: firstAudible(buffer) }));
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

  clip.then(({ buffer, offset }) => {
    if (ac.state === "suspended") ac.resume().catch(() => {});
    const src = ac.createBufferSource();
    const gain = ac.createGain();
    src.buffer = buffer;
    gain.gain.value = volume;
    src.connect(gain).connect(ac.destination);

    const now = ac.currentTime;
    const room = buffer.duration - offset;
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
