"use client";

import { useEffect, useRef, useState } from "react";
import type { MateThread } from "@/lib/types";

/**
 * The mate who watched the race and is texting you about it.
 *
 * He is tied to the same lap counter as the circuit, so his messages land as
 * you scroll past the moment he is talking about. Everything he says was
 * written from the same data as the cards, which is why he can be casual
 * without making anything up, and why he says so when the data cannot answer.
 */

type Line = { who: "them" | "you"; text: string };

const MATE = "Sam";

export default function RaceMate({
  thread,
  lap,
}: {
  thread: MateThread;
  lap: number;
}) {
  const [open, setOpen] = useState(false);
  const [log, setLog] = useState<Line[]>([]);
  const [queue, setQueue] = useState<string[]>([]);
  const [unread, setUnread] = useState(0);
  const [asked, setAsked] = useState<Record<string, boolean>>({});
  const [beatIdx, setBeatIdx] = useState(0);
  const bodyRef = useRef<HTMLDivElement>(null);
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
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
  }, [log, queue, open]);

  useEffect(() => {
    if (open) setUnread(0);
  }, [open, log]);

  /* a question jumps the queue: he answers you before carrying on with
     whatever he was in the middle of saying, the way anybody would */
  const ask = (q: string, a: string[]) => {
    setAsked((s) => ({ ...s, [q]: true }));
    setLog((l) => [...l, { who: "you", text: q }]);
    setQueue((s) => [...a.filter(Boolean), ...s]);
  };

  const typing = queue.length > 0;

  /* only offer questions about things he has actually said out loud, not
     about beats still sitting in the queue */
  const openAsks = thread.beats
    .slice(0, queue.length ? Math.max(1, beatIdx - 1) : beatIdx)
    .flatMap((b) => b.asks)
    .filter((a) => !asked[a.q])
    .slice(-3);

  return (
    <>
      <button
        className={`mate-fab${open ? " on" : ""}`}
        onClick={() => setOpen((o) => !o)}
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
              He starts talking as you scroll the race. Or just ask him something.
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

        <div className="mate-asks">
          {openAsks.length === 0 ? (
            <span className="mate-hint">keep scrolling, he is watching</span>
          ) : (
            openAsks.map((a) => (
              <button key={a.q} onClick={() => ask(a.q, a.a)}>
                {a.q}
              </button>
            ))
          )}
        </div>
      </aside>
    </>
  );
}
