export type CardData = {
  type: "cover" | "prediction" | "moment" | "share";
  lap?: number;
  kicker?: string;
  title?: string;
  text?: string;
  options?: string[];
  answer?: string;
  reveal?: string;
  dato?: { label: string; rows: [string, number | string][] };
};

export type PodiumDriver = {
  pos?: number;
  number: number;
  first: string;
  last: string;
  team: string;
  colour: string;
  headshot: string;
};

export type Story = {
  gp: string;
  session: string;
  sessionSlug?: string;
  circuit: string;
  laps: number;
  generated: string;
  result?: {
    date: string;
    podium: PodiumDriver[];
    fastest: (PodiumDriver & { time: number }) | null;
  };
  cards: CardData[];
};

export type SessionMeta = {
  slug: string;
  label: string;
  kind: "practice" | "quali" | "race";
  headline: string;
  moments: number;
  laps: number;
};

export type Weekend = {
  slug: string;
  gp: string;
  short: string;
  circuit: string;
  country: string;
  date: string;
  laps: number;
  sessions: SessionMeta[];
  rating: { score: number; verdict: string; spoiler_free: boolean } | null;
  heat: number[];
};

export type Track = {
  circuit: string;
  view: number;
  start: number[];
  points: [number, number][];
  corners: { x: number; y: number; label: string }[];
  /** the same five circuit vitals at every GP, measured from telemetry */
  stats?: { label: string; value: string; short?: string }[];
};
