/**
 * The Stories card (1080x1920) both activities hand you at the flag.
 *
 * Drawn on a canvas rather than screenshotted, so it looks the same on every
 * phone. It never names a winner or a result, so it spoils nothing for
 * whoever sees it: the race, your figure, your verdict and the marks.
 */
export type CardInput = {
  kicker: string;      // "ACTIVITY 01 // CALL THE RACE"
  gp: string;          // "British GP · Race"
  title: [string, string]; // two lines, the second lit
  big: string;         // "220" or "P4"
  bigLabel: string;    // "POINTS · 6 OF 8 RIGHT"
  verdict: string;
  marks: ("hit" | "miss" | "flat")[];
  foot: string;
};

export async function drawCard(o: CardInput): Promise<Blob | null> {
  const W = 1080, H = 1920;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const x = cv.getContext("2d");
  if (!x) return null;
  try { await Promise.all([document.fonts.load('800 120px "Anybody"'), document.fonts.ready]); } catch {}
  const wide = (px: number, w = 800) => {
    x.font = `${w} ${px}px "Anybody", sans-serif`;
    (x as unknown as { fontStretch: string }).fontStretch = "extra-expanded";
  };
  const mono = (px: number) => { x.font = `700 ${px}px "JetBrains Mono", monospace`; };

  x.fillStyle = "#0a0a0a"; x.fillRect(0, 0, W, H);
  const g = x.createRadialGradient(W * 0.72, H * 0.8, 40, W * 0.72, H * 0.8, 1150);
  g.addColorStop(0, "#e10600aa"); g.addColorStop(0.45, "#e1060030"); g.addColorStop(1, "#0a0a0a00");
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.save(); x.shadowColor = "#ff2415"; x.shadowBlur = 40; x.strokeStyle = "#ff3b2a"; x.lineWidth = 7;
  x.beginPath(); x.moveTo(W * 0.6, -40); x.lineTo(W * 1.1, H * 0.44); x.stroke(); x.restore();
  x.strokeStyle = "#ffffff14"; x.lineWidth = 2;
  for (let i = 0; i < 9; i++) { const y = 260 + i * 170; x.beginPath(); x.moveTo(0, y); x.lineTo(W * (0.28 + (i % 3) * 0.12), y); x.stroke(); }

  x.textBaseline = "alphabetic";
  mono(30); x.fillStyle = "#e10600"; x.fillText(o.kicker.toUpperCase(), 80, 150);
  x.fillStyle = "#8c8c8c"; x.fillText(o.gp.toUpperCase(), 80, 200);
  wide(112); x.fillStyle = "#fff"; x.fillText(o.title[0].toUpperCase(), 74, 420);
  x.save(); x.shadowColor = "#ff2415"; x.shadowBlur = 36; x.fillStyle = "#ff2415"; x.fillText(o.title[1].toUpperCase(), 74, 545); x.restore();

  wide(250, 900); x.fillStyle = "#fff"; x.fillText(o.big, 70, 900);
  mono(30); x.fillStyle = "#8c8c8c"; x.fillText(o.bigLabel.toUpperCase(), 80, 970);

  const n = o.marks.length, r = Math.min(44, (W - 160) / Math.max(1, n) / 2 - 8);
  o.marks.forEach((m, i) => {
    const cx = 80 + r + i * (r * 2 + 16), cy = 1090;
    const col = m === "hit" ? "#2fd06a" : m === "miss" ? "#ff2415" : "#555";
    x.save(); x.shadowColor = col; x.shadowBlur = m === "flat" ? 0 : 30;
    x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fillStyle = col; x.fill(); x.restore();
  });

  mono(34); x.fillStyle = "#e10600"; x.fillText("VERDICT", 80, 1260);
  wide(92); x.fillStyle = "#fff";
  let line = "", y = 1370;
  for (const w of o.verdict.toUpperCase().split(" ")) {
    const t = line ? `${line} ${w}` : w;
    if (x.measureText(t).width > W - 160 && line) { x.fillText(line, 74, y); y += 104; line = w; } else line = t;
  }
  x.fillText(line, 74, y);
  mono(28); x.fillStyle = "#8c8c8c"; x.fillText(o.foot, 80, H - 140);
  mono(28); x.fillStyle = "#fff"; x.fillText("RACING SIMPLIFIED", 80, H - 90);
  return new Promise((res) => cv.toBlob(res, "image/png"));
}

/** must run inside the tap, like navigator.share */
export async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

/**
 * Share the card as a file where the phone can, the text and link where not.
 * With a mouse the link is copied: a PC's share panel is not where a group chat
 * lives, and the card has its own button there.
 *
 * Nothing is awaited before navigator.share or the clipboard: Safari only
 * allows them inside the tap, so the blob has to be drawn before it. "cancelled"
 * is the person closing the share sheet; "none" means show them another way.
 */
export async function shareCard(blob: Blob | null, text: string, url: string): Promise<"shared" | "cancelled" | "copied" | "none"> {
  let opening: Promise<void> | null = null;
  if (matchMedia("(hover: hover) and (pointer: fine)").matches) return (await copyText(`${text} ${url}`)) ? "copied" : "none";
  try {
    const file = blob ? new File([blob], "racing-simplified.png", { type: "image/png" }) : null;
    if (file && navigator.canShare?.({ files: [file] })) opening = navigator.share({ files: [file], text: `${text} ${url}` });
    else if (navigator.share) opening = navigator.share({ text, url });
  } catch { return "none"; }
  if (opening) {
    try { await opening; return "shared"; }
    catch (e) { return (e as Error).name === "AbortError" ? "cancelled" : "none"; }
  }
  return (await copyText(`${text} ${url}`)) ? "copied" : "none";
}

/** a real download, for a mouse; a phone gets the image to press and hold (CardActions) */
export function saveCard(blob: Blob | null, name: string) {
  if (!blob) return;
  const u = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = u; a.download = name; a.click();
  // Safari asks before it downloads, and the question can stay open a while
  setTimeout(() => URL.revokeObjectURL(u), 60000);
}
