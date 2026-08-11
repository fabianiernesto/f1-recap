/**
 * Country flags, drawn flat so every Grand Prix gets the exact same treatment:
 * same proportions, same thin frame, same night grade. One entry per country.
 */
const FLAGS: Record<string, React.ReactNode> = {
  GB: (
    <>
      <clipPath id="fl-t">
        <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
      </clipPath>
      <rect width="60" height="30" fill="#012169" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#C8102E" strokeWidth="4" clipPath="url(#fl-t)" />
      <path d="M30,0 V30 M0,15 H60" stroke="#fff" strokeWidth="10" />
      <path d="M30,0 V30 M0,15 H60" stroke="#C8102E" strokeWidth="6" />
    </>
  ),
  IT: (
    <>
      <rect width="20" height="30" fill="#008C45" />
      <rect x="20" width="20" height="30" fill="#F4F5F0" />
      <rect x="40" width="20" height="30" fill="#CD212A" />
    </>
  ),
  BE: (
    <>
      <rect width="20" height="30" fill="#000" />
      <rect x="20" width="20" height="30" fill="#FAE042" />
      <rect x="40" width="20" height="30" fill="#ED2939" />
    </>
  ),
  ES: (
    <>
      <rect width="60" height="30" fill="#AA151B" />
      <rect y="7.5" width="60" height="15" fill="#F1BF00" />
    </>
  ),
  NL: (
    <>
      <rect width="60" height="10" fill="#AE1C28" />
      <rect y="10" width="60" height="10" fill="#fff" />
      <rect y="20" width="60" height="10" fill="#21468B" />
    </>
  ),
  JP: (
    <>
      <rect width="60" height="30" fill="#fff" />
      <circle cx="30" cy="15" r="9" fill="#BC002D" />
    </>
  ),
  US: (
    <>
      <rect width="60" height="30" fill="#fff" />
      {[0, 2, 4, 6, 8, 10, 12].map((i) => (
        <rect key={i} y={i * 30 / 13} width="60" height={30 / 13} fill="#B22234" />
      ))}
      <rect width="24" height={30 * 7 / 13} fill="#3C3B6E" />
    </>
  ),
};

/** Circuit slug -> country code. Add a line per Grand Prix. */
export const CIRCUIT_COUNTRY: Record<string, string> = {
  Silverstone: "GB",
  Monza: "IT",
  Imola: "IT",
  Spa: "BE",
  Catalunya: "ES",
  Zandvoort: "NL",
  Suzuka: "JP",
};

/** Waving silhouette + fold shading, identical for every country. */
const WAVE =
  "M0,2.6 C10,-0.4 20,5.2 30,2.6 C40,0 50,5.4 60,2.4 " +
  "L60,27.4 C50,30.4 40,24.8 30,27.4 C20,30 10,24.6 0,27.6 Z";

export default function Flag({ country }: { country: string }) {
  const art = FLAGS[country];
  if (!art) return null;
  return (
    <svg className="hero-flag" viewBox="0 0 60 30" aria-hidden>
      <defs>
        <clipPath id="fl-wave">
          <path d={WAVE} />
        </clipPath>
        {/* light and shadow across the folds */}
        <linearGradient id="fl-shade" x1="0" y1="0" x2="1" y2="0.15">
          <stop offset="0%" stopColor="#000" stopOpacity=".42" />
          <stop offset="14%" stopColor="#fff" stopOpacity=".16" />
          <stop offset="30%" stopColor="#000" stopOpacity=".34" />
          <stop offset="48%" stopColor="#fff" stopOpacity=".12" />
          <stop offset="64%" stopColor="#000" stopOpacity=".3" />
          <stop offset="82%" stopColor="#fff" stopOpacity=".14" />
          <stop offset="100%" stopColor="#000" stopOpacity=".4" />
        </linearGradient>
      </defs>
      <g clipPath="url(#fl-wave)">{art}</g>
      <path d={WAVE} fill="url(#fl-shade)" />
    </svg>
  );
}
