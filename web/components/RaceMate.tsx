"use client";

import { useEffect, useRef, useState } from "react";
import type { Brain, MateThread } from "@/lib/types";
import { askAlfred, STARTERS } from "@/lib/alfred";
import { SFX_RADIO, loadSfx, playSfx, warmSfx } from "@/lib/sfx";

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

/* The radio click when he comes on. The clip runs eleven seconds and opens on
   over a second of silence, so it is played from its first audible sample and
   cut after a beat: a radio opening is a beat, not a track. */
const SFX_VOLUME = 0.22;
const SFX_MS = 1600;

export default function RaceMate({
  thread,
  lap,
  brain,
  quiet = false,
}: {
  thread: MateThread;
  lap: number;
  brain: Brain | null;
  /** a card asking for an answer is under the button: on a phone it steps aside */
  quiet?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [log, setLog] = useState<Line[]>([]);
  const [queue, setQueue] = useState<string[]>([]);
  const [beatIdx, setBeatIdx] = useState(0);
  const [draft, setDraft] = useState("");
  const [hasAsked, setHasAsked] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const [sound, setSound] = useState(false);
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
    }, 420);
    return () => clearTimeout(t);
  }, [queue]);

  useEffect(() => {
    bodyRef.current?.scrollTo({
      top: bodyRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [log, queue, open]);

  /* only on opening: at every new message it pulled the keyboard user off
     whatever they had tabbed to, and on a phone it threw the keyboard over the panel */
  useEffect(() => {
    if (open && matchMedia("(pointer: fine)").matches) inputRef.current?.focus();
  }, [open]);

  /* the iPhone keyboard covers the bottom of the screen without moving what is
     fixed there, so while the field has focus the panel sits inside what is left
     of the screen. Pinch zoom shrinks the same viewport: that is not a keyboard. */
  useEffect(() => {
    const vv = window.visualViewport;
    const panel = panelRef.current;
    if (!open || !vv || !panel) return;
    const fit = () => {
      const typing = document.activeElement === inputRef.current && Math.abs(vv.scale - 1) < 0.01 && vv.height < innerHeight * 0.85;
      panel.style.setProperty("--mate-bottom", typing ? `${Math.max(0, innerHeight - vv.height - vv.offsetTop) + 6}px` : "");
      panel.style.setProperty("--mate-max", typing ? `${vv.height - 12}px` : "");
    };
    fit();
    vv.addEventListener("resize", fit);
    vv.addEventListener("scroll", fit);
    panel.addEventListener("focusin", fit);
    panel.addEventListener("focusout", fit);
    return () => {
      vv.removeEventListener("resize", fit);
      vv.removeEventListener("scroll", fit);
      panel.removeEventListener("focusin", fit);
      panel.removeEventListener("focusout", fit);
      panel.style.removeProperty("--mate-bottom");
      panel.style.removeProperty("--mate-max");
    };
  }, [open]);

  /* decoded once, so the click lands with the panel rather than after it */
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setSound(true);
    // not on mount: on a phone this fetch was racing the page's own first load
    const load = () => { loadSfx(SFX_RADIO); };
    if ("requestIdleCallback" in window) {
      const id = requestIdleCallback(load, { timeout: 5000 });
      return () => cancelIdleCallback(id);
    }
    const t = setTimeout(load, 3000);
    return () => clearTimeout(t);
  }, []);

  /** He comes on air when the panel opens, and never when it closes. */
  const radioOn = () => {
    if (sound) playSfx(SFX_RADIO, { volume: SFX_VOLUME, maxMs: SFX_MS });
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
    // a starter button is gone after this, and focus must not go with it
    if (matchMedia("(pointer: fine)").matches) inputRef.current?.focus();
  };

  const typing = queue.length > 0;

  return (
    <>
      <button
        ref={fabRef}
        className={`mate-fab${open ? " on" : ""}${quiet ? " is-quiet" : ""}`}
        /* the sound is fired here and not inside the state updater, which
           React is free to call twice and did */
        onClick={() => { if (!open) radioOn(); setOpen((o) => !o); }}
        onPointerEnter={() => { if (sound) warmSfx(); }}
        onPointerDown={() => { if (sound) warmSfx(); }}
        onFocus={() => { if (sound) warmSfx(); }}
        aria-label={open ? "Close the chat" : `Ask ${MATE}`}
        aria-expanded={open}
      >
        <span className="mate-fab-dot" />
        {open ? "Close" : `Ask ${MATE}`}
      </button>

      {/* closed it is only see-through: inert keeps the keyboard out of it */}
      <aside
        ref={panelRef}
        className={`mate${open ? " open" : ""}`}
        aria-hidden={!open}
        inert={!open}
        onKeyDown={(e) => {
          if (e.key === "Escape") { setOpen(false); fabRef.current?.focus(); }
        }}
      >
        <header className="mate-top">
          <span className="mate-av">{MATE[0]}</span>
          <div>
            <b>{MATE}</b>
            <span>watched every lap so you did not have to</span>
          </div>
        </header>

        <div className="mate-body" ref={bodyRef} role="log">
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
