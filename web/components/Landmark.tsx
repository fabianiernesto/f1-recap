import fs from "node:fs";
import path from "node:path";

/**
 * The landmark that anchors the poster (ref Ogilvy: the Bosphorus bridge).
 * Drops a real photo in when one exists at public/landmarks/<slug>.png,
 * graded and masked so it melts into the night instead of looking pasted on.
 * Falls back to line-art so the page never breaks while art is missing.
 *
 * To add a GP: put a cut-out PNG (transparent background) at
 * web/public/landmarks/<gp-slug>.png — nothing else to wire up.
 */
const LANDMARK_FORMATS = ["png", "webp", "jpg", "jpeg"];

// cwd is web/ for build, but the repo root when the dev server is launched
// from there — same resolution dance as lib/data.ts
const PUBLIC_DIRS = [
  path.join(process.cwd(), "public"),
  path.join(process.cwd(), "Proyecto 6_Ernesto - F1 Recap Interactivo", "web", "public"),
];

function findAsset(folder: string, slug: string): string | null {
  for (const dir of PUBLIC_DIRS) {
    for (const ext of LANDMARK_FORMATS) {
      if (fs.existsSync(path.join(dir, folder, `${slug}.${ext}`)))
        return `/${folder}/${slug}.${ext}`;
    }
  }
  return null;
}

export function landmarkPhoto(slug: string): string | null {
  return findAsset("landmarks", slug);
}

/** Driver artwork for the right flank: public/figures/<slug>.(png|jpg|webp) */
export function figurePhoto(slug: string): string | null {
  return findAsset("figures", slug);
}

/**
 * Right-hand figure. Artwork lit on black blends with `screen`, so the black
 * simply disappears into the night and only the glow and the driver remain —
 * no cut-out needed. Edges are masked so nothing ends in a straight line.
 */
export function FigurePhoto({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="hero-figure">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} />
    </div>
  );
}

export function LandmarkPhoto({ src, alt }: { src: string; alt: string }) {
  // no overlay element here: any box drawn on top would show as a rectangle
  // over the cut-out. All grading happens with filters on the image itself.
  return (
    <div className="hero-landmark-photo">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} />
    </div>
  );
}

/** Line-art fallback while a licensed photo is missing. */
export function BigBen({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 140 900" aria-hidden>
      <defs>
        <linearGradient id="lm-body" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#241013" />
          <stop offset="52%" stopColor="#3a1a1c" />
          <stop offset="100%" stopColor="#150a0c" />
        </linearGradient>
        <linearGradient id="lm-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="70%" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <mask id="lm-mask">
          <rect x="0" y="0" width="140" height="900" fill="url(#lm-fade)" />
        </mask>
      </defs>
      <g mask="url(#lm-mask)" stroke="#ff8a5c" strokeOpacity=".55" strokeWidth="1.2">
        <path d="M70 18 L70 44" />
        <path d="M62 150 L70 44 L78 150 Z" fill="url(#lm-body)" />
        <path d="M26 252 L70 148 L114 252 Z" fill="url(#lm-body)" />
        <path d="M38 252 L70 196 L102 252" fill="none" strokeOpacity=".3" />
        <rect x="28" y="252" width="84" height="58" fill="url(#lm-body)" />
        <path d="M44 310 L44 276 Q52 264 60 276 L60 310" fill="#0d0708" strokeOpacity=".35" />
        <path d="M80 310 L80 276 Q88 264 96 276 L96 310" fill="#0d0708" strokeOpacity=".35" />
        <rect x="20" y="310" width="100" height="104" fill="url(#lm-body)" />
        <circle cx="70" cy="362" r="30" fill="#f6e6c8" fillOpacity=".92" stroke="#ffb98a" />
        <circle cx="70" cy="362" r="24" fill="none" stroke="#8a6a4a" strokeOpacity=".5" />
        <path d="M70 362 L70 344" stroke="#3a2a1c" strokeWidth="2.4" />
        <path d="M70 362 L84 362" stroke="#3a2a1c" strokeWidth="2" />
        <path d="M24 414 L116 414" strokeOpacity=".45" />
        <rect x="26" y="414" width="88" height="486" fill="url(#lm-body)" />
        {[38, 52, 66, 80, 94].map((x) => (
          <path key={x} d={`M${x} 428 L${x} 900`} strokeOpacity=".18" strokeWidth="1" />
        ))}
        {[470, 560, 650, 740].map((y) => (
          <path key={y} d={`M26 ${y} L114 ${y}`} strokeOpacity=".22" strokeWidth="1" />
        ))}
        {[500, 590, 680].map((y) => (
          <g key={y}>
            <path d={`M45 ${y} L45 ${y + 40}`} stroke="#ffb98a" strokeOpacity=".28" strokeWidth="3" />
            <path d={`M70 ${y} L70 ${y + 40}`} stroke="#ffb98a" strokeOpacity=".22" strokeWidth="3" />
            <path d={`M95 ${y} L95 ${y + 40}`} stroke="#ffb98a" strokeOpacity=".28" strokeWidth="3" />
          </g>
        ))}
      </g>
    </svg>
  );
}

/** Low skyline sitting behind the landmark. */
export function Skyline({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 1400 220" preserveAspectRatio="none" aria-hidden>
      <path
        d="M0 220 L0 168 L60 168 L60 150 L120 150 L120 176 L200 176 L200 140 L236 140
           L236 176 L300 176 L300 158 L360 158 L360 130 L392 130 L392 158 L470 158
           L470 180 L560 180 L560 146 L610 146 L610 180 L700 180 L700 120 L730 120
           L730 180 L820 180 L820 162 L890 162 L890 138 L930 138 L930 178 L1010 178
           L1010 152 L1080 152 L1080 176 L1160 176 L1160 132 L1200 132 L1200 176
           L1290 176 L1290 158 L1340 158 L1340 172 L1400 172 L1400 220 Z"
        fill="#120709"
      />
    </svg>
  );
}
