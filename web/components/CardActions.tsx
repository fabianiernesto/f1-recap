"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { copyText, drawCard, saveCard, shareCard, type CardInput } from "@/lib/shareCard";

/**
 * "Challenge your group" and "Save the card", for both activities.
 *
 * The card is drawn the moment the flag screen appears, so a tap has it ready:
 * Safari only opens the share sheet inside the tap, and drawing takes long
 * enough to lose it. A phone cannot really download (Safari files it away from
 * the photos, an Instagram or TikTok browser does nothing), so it gets the image
 * to press and hold, and whatever fails to open falls back to that same sheet.
 */
export default function CardActions({ card, text, name }: { card: CardInput; text: string; name: string }) {
  const [blob, setBlob] = useState<Blob | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const [copied, setCopied] = useState(false);
  const [sheet, setSheet] = useState<"save" | "failed" | null>(null);
  const cardKey = JSON.stringify(card);

  useEffect(() => {
    let live = true;
    drawCard(JSON.parse(cardKey) as CardInput).then((b) => {
      if (live) { blobRef.current = b; setBlob(b); }
    }).catch(() => {});
    return () => { live = false; };
  }, [cardKey]);

  const share = () => {
    shareCard(blobRef.current, text, window.location.href).then((res) => {
      if (res === "copied") { setCopied(true); setTimeout(() => setCopied(false), 2000); }
      if (res === "none") setSheet("failed");
    });
  };
  const save = () => {
    if (matchMedia("(hover: none)").matches || !blobRef.current) setSheet("save");
    else saveCard(blobRef.current, name);
  };

  return (
    <>
      <button className="bt-go" onClick={share}>{copied ? "Link copied" : "Challenge your group"} <i aria-hidden>→</i></button>
      <button className="myst-link" onClick={save}>Save the card for Stories</button>
      {sheet && <CardSheet blob={blob} text={text} failed={sheet === "failed"} onClose={() => setSheet(null)} />}
    </>
  );
}

function CardSheet({ blob, text, failed, onClose }: { blob: Blob | null; text: string; failed: boolean; onClose: () => void }) {
  const src = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);
  const [copy, setCopy] = useState<"idle" | "done" | "failed">("idle");
  const full = `${text} ${window.location.href}`;

  // kept for a minute after the sheet closes: a save in progress may still be reading it
  useEffect(() => {
    if (!src) return;
    return () => { setTimeout(() => URL.revokeObjectURL(src), 60000); };
  }, [src]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="card-sheet" role="dialog" aria-modal="true" aria-label="Your card">
      <p className="card-sheet-k">
        {failed ? "Sharing did not open here. " : ""}Press and hold the card to save it.
      </p>
      {src
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={src} alt="Your result card" />
        : <div className="card-sheet-wait">Drawing the card</div>}
      <div className="card-sheet-acts">
        <button className="bt-go" onClick={() => { copyText(full).then((ok) => setCopy(ok ? "done" : "failed")); }}>
          {copy === "done" ? "Copied" : "Copy the link"} <i aria-hidden>→</i>
        </button>
        <button className="myst-link" onClick={onClose}>Close</button>
      </div>
      {/* the last resort: selectable by hand when the clipboard says no */}
      {copy === "failed" && <textarea className="card-sheet-text" readOnly value={full} aria-label="Your result and link" onFocus={(e) => e.currentTarget.select()} />}
    </div>,
    document.body
  );
}
