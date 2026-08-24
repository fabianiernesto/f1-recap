"use client";

import { useEffect, useRef, useState } from "react";
import type { Brain, MateThread } from "@/lib/types";
import { askAlfred, STARTERS } from "@/lib/alfred";

/**
 * The mate who watched the race and is texting you about it.
 *
 * Two things are going on. He narrates on his own as you scroll, tied to the
 * same lap counter as the circuit, and you can type him anything at any point
 * and he will answer from the race pack. Nothing he says is generated: every
 * number is looked up, so he is casual without being wrong, and he admits it
 * plainly when a question is beyond what the data holds.
 */

type Line = { who: "them" | "you"; text: string };

const MATE = "Alfred";

/* The radio click when he comes on. The clip runs eleven seconds, which is a
   lot of chatter for opening a panel, so it plays the front of it and fades
   out: a radio opening is a beat, not a track. */
const SFX = "/sfx/radio.mp4";
const SFX_VOLUME = 0.22;
const SFX_MS = 1800;
const FADE_MS = 260;

export default function RaceMate({
  thread,
  lap,
  brain,
}: {
  thread: MateThread;
  lap: number;
  brain: Brain | null;
}) {
  const [open, setOpen] = useState(false);
  const [log, setLog] = useState<Line[]>([]);
  const [queue, setQueue] = useState<string[]>([]);
  const [unread, setUnread] = useState(0);
  const [beatIdx, setBeatIdx] = useState(0);
  const [draft, setDraft] = useState("");
  const [hasAsked, setHasAsked] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sfx = useRef<HTMLAudioElement | null>(null);
  /* effects run twice in dev, and a beat must never be said twice */
  const saidRef = useRef(-1);

  /* he talks when the scroll reaches the lap he is talking about */
  useEffect(() => {
    const next = thread.beats[beatIdx];
    if (!next || lap < next.lap || saidRef.current >= beatIdx) return;
    saidRef.current = beatIdx;
    setBeatIdx((i) => i + 1);
    setQueue((q) => [...q, ...next.msgs.filter(Boolean)]);
  }, [lap, beatIdx, thread.beats]);

  /* one message at a time, always in order: jumping to the end of the race
     should read as him catching you up, not as everything arriving at once */
  useEffect(() => {
    if (queue.length === 0) return;
    const t = setTimeout(() => {
      setLog((l) => [...l, { who: "them", text: queue[0] }]);
      setQueue((q) => q.slice(1));
      if (!open) setUnread((u) => u + 1);
    }, 420);
    return () => clearTimeout(t);
  }, [queue, open]);

  useEffect(() => {
    bodyRef.current?.scrollTo({
      top: bodyRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [log, queue, open]);

  useEffect(() => {
    if (open) {
      setUnread(0);
      inputRef.current?.focus();
    }
  }, [open, log]);

  /* loaded once, so the click lands with the panel rather than after it */
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const a = new Audio(SFX);
    a.preload = "auto";
    a.volume = SFX_VOLUME;
    sfx.current = a;
    return () => { a.pause(); sfx.current = null; };
  }, []);

  /** He comes on air when the panel opens, and never when it closes. */
  const radioOn = () => {
    const a = sfx.current;
    if (!a) return;
    a.currentTime = 0;
    a.volume = SFX_VOLUME;
    a.play().catch(() => {});
    setTimeout(() => {
      const steps = 8;
      let n = 0;
      const fade = setInterval(() => {
        n += 1;
        a.volume = Math.max(0, SFX_VOLUME * (1 - n / steps));
        if (n >= steps) { clearInterval(fade); a.pause(); }
      }, FADE_MS / steps);
    }, SFX_MS - FADE_MS);
  };

  /* your question jumps the queue: he answers you before carrying on with
     whatever he was in the middle of saying, the way anybody would */
  const send = (text: string) => {
    const q = text.trim();
    if (!q) return;
    setHasAsked(true);
    setDraft("");
    setLog((l) => [...l, { who: "you", text: q }]);
    const reply = brain
      ? askAlfred(q, brain)
      : ["no data pack for this session, so I would only be guessing"];
    setQueue((s) => [...reply, ...s]);
  };

  const typing = queue.length > 0;

  return (
    <>
      <button
        className={`mate-fab${open ? " on" : ""}`}
        /* the sound is fired here and not inside the state updater, which
           React is free to call twice and did */
        onClick={() => { if (!open) radioOn(); setOpen((o) => !o); }}
        aria-label={open ? "Close the chat" : `Chat with ${MATE}`}
      >
        <span className="mate-fab-dot" />
        {open ? "Close" : `Ask ${MATE}`}
        {!open && unread > 0 && <b className="mate-badge">{unread}</b>}
      </button>

      <aside className={`mate${open ? " open" : ""}`} aria-hidden={!open}>
        <header className="mate-top">
          <span className="mate-av">{MATE[0]}</span>
          <div>
            <b>{MATE}</b>
            <span>watched every lap so you did not have to</span>
          </div>
        </header>

        <div className="mate-body" ref={bodyRef}>
          {log.length === 0 && (
            <p className="mate-empty">
              He talks as you scroll the race. Ask him anything about it and he
              answers from the timing data.
            </p>
          )}
          {log.map((l, i) => (
            <div key={i} className={`bub ${l.who}`}>
              {l.text}
            </div>
          ))}
          {typing && (
            <div className="bub them typing">
              <i />
              <i />
              <i />
            </div>
          )}
        </div>

        {/* starters until you have typed once, then they get out of the way */}
        {!hasAsked && (
          <div className="mate-asks">
            {STARTERS.slice(0, 3).map((s) => (
              <button key={s} onClick={() => send(s)}>
                {s}
              </button>
            ))}
          </div>
        )}

        <form
          className="mate-ask"
          onSubmit={(e) => {
            e.preventDefault();
            send(draft);
          }}
        >
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`Ask ${MATE} anything about the race`}
            aria-label="Your question"
            autoComplete="off"
          />
          <button type="submit" disabled={!draft.trim()} aria-label="Send">
            →
          </button>
        </form>
      </aside>
    </>
  );
}
