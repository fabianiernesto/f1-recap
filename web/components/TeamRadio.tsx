"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { SFX_RADIO, loadSfx, playSfx, warmSfx } from "@/lib/sfx";

/**
 * Team radio (16/11/2026): the site's feedback channel. Ernesto wanted a
 * "méteme caña" button, not a contact form: an open invitation to roast the
 * site, genuine and a little cheeky, in the voice of a driver on the radio.
 *
 * It sends straight from the browser to Web3Forms, which mails it to his inbox.
 * Their free plan only takes browser submissions, and the access key is public
 * by design (docs.web3forms.com: "Access key is public"). Without
 * NEXT_PUBLIC_WEB3FORMS_KEY the button stays out of production builds, so a
 * deploy never ships a radio that cannot transmit; in development it shows,
 * and sending without a key reports the radio as cut.
 *
 * Opening it plays Alfred's radio (16/11, Ernesto: you are calling the pit wall),
 * the same clip, volume and length, loaded and woken the same way (lib/sfx.ts).
 *
 * Not on a circuit's LED hub (that hero is not to be touched) nor inside the
 * two games, which need the whole screen and their own controls at the bottom.
 */
const KEY = process.env.NEXT_PUBLIC_WEB3FORMS_KEY;
const LIVE = !!KEY || process.env.NODE_ENV !== "production";
const HIDDEN = [/^\/gp\/[^/]+\/?$/, /\/(call|exchange)\/?$/];
/** Alfred's radio, as he plays it (components/RaceMate.tsx) */
const SFX_VOLUME = 0.22;
const SFX_MS = 1600;

type State = "idle" | "sending" | "sent" | "error";

export default function TeamRadio() {
  const path = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>("idle");
  const [msg, setMsg] = useState("");
  const [email, setEmail] = useState("");
  const [sound, setSound] = useState(false);
  const text = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    text.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  /* the radio, decoded once while the page is idle, as Alfred does it; not for
     anyone who asked the system for less motion */
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setSound(true);
    const load = () => { loadSfx(SFX_RADIO); };
    if ("requestIdleCallback" in window) {
      const id = requestIdleCallback(load, { timeout: 5000 });
      return () => cancelIdleCallback(id);
    }
    const t = setTimeout(load, 3000);
    return () => clearTimeout(t);
  }, []);

  // a new page closes the panel
  useEffect(() => setOpen(false), [path]);

  if (!LIVE || HIDDEN.some((r) => r.test(path))) return null;

  const send = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!msg.trim() || state === "sending") return;
    // a hidden box only a bot ticks
    if ((e.currentTarget.elements.namedItem("botcheck") as HTMLInputElement | null)?.checked) return;
    if (!KEY) {
      setState("error");
      return;
    }
    setState("sending");
    try {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          access_key: KEY,
          subject: "Team radio · Racing Simplified",
          from_name: "Racing Simplified",
          message: msg.trim(),
          email: email.trim() || undefined,
          page: path,
          screen: `${window.innerWidth}x${window.innerHeight}`,
        }),
      });
      const out = await res.json().catch(() => null);
      if (res.ok && out?.success) {
        setState("sent");
        setMsg("");
        setEmail("");
      } else setState("error");
    } catch {
      setState("error");
    }
  };

  /** On air when the panel opens, never when it closes (fired here, not in a state updater) */
  const toggle = () => {
    if (!open && sound) playSfx(SFX_RADIO, { volume: SFX_VOLUME, maxMs: SFX_MS });
    setOpen(!open);
    if (state !== "sending") setState("idle");
  };
  // the sound card wakes a beat before the click, only for someone about to hear it
  const warm = () => { if (sound) warmSfx(); };

  return (
    <>
      <button type="button" className={`tr-btn${open ? " is-open" : ""}`} onClick={toggle} aria-expanded={open} aria-controls="team-radio"
        onPointerEnter={warm} onPointerDown={warm} onFocus={warm}>
        Roast the site
      </button>
      {open && (
        <div id="team-radio" className="tr-panel" role="dialog" aria-label="Team radio">
          <button type="button" className="tr-x" onClick={() => setOpen(false)}>Close</button>
          <span className="tr-kick">Team radio</span>
          <h2>Be brutal.</h2>
          {state === "sent" ? (
            <p className="tr-done">Copy that. It is on the pit wall now. Thanks for not holding back.</p>
          ) : (
            <form onSubmit={send}>
              <p>Bugs, slow bits, bad calls, things you&apos;d change. No filter, it makes it better.</p>
              <textarea ref={text} name="message" value={msg} onChange={(e) => setMsg(e.target.value)} rows={5} maxLength={3000} required
                placeholder="Box, box: the steward card breaks on my phone…" />
              <input type="email" name="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email"
                placeholder="Your email, only if you want a reply" />
              <input type="checkbox" name="botcheck" className="tr-bot" tabIndex={-1} autoComplete="off" aria-hidden />
              <button type="submit" className="tr-send" disabled={state === "sending" || !msg.trim()}>
                {state === "sending" ? "Transmitting…" : "Send to the pit wall"} <span aria-hidden>→</span>
              </button>
              {state === "error" && <p className="tr-err">The radio cut out. Try again in a minute.</p>}
            </form>
          )}
        </div>
      )}
    </>
  );
}
