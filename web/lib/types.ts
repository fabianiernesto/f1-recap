export type CardData = {
  type: "cover" | "prediction" | "moment" | "share" | "decision" | "guess";
  lap?: number;
  kicker?: string;
  title?: string;
  text?: string;
  options?: string[];
  answer?: string;
  reveal?: string;
  dato?: { label: string; rows: [string, number | string][] };

  /** decision cards: the race frozen at a fork, with the call handed over */
  state?: [string, string][];
  choices?: { id: string; label: string; sub?: string }[];
  /** id of the option the team really took, empty when nobody can know */
  actual?: string;
  /** what each line would have meant, whichever one you pick */
  outcomes?: Record<string, string>;

  /** guess cards: a slider instead of buttons */
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  /** the real number, and how far off still counts as close */
  target?: number;
  close?: number;
};

export type MateBeat = {
  lap: number;
  msgs: string[];
  asks: { q: string; a: string[] }[];
};

export type MateThread = {
  session: string;
  beats: MateBeat[];
};

export type PodiumDriver = {
  pos?: number;
  gap?: number | null;
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

/** What Alfred knows: enough about this race to answer a typed question. */
export type BrainDriver = {
  name: string;
  code: string;
  number: number;
  team: string;
  start: number | null;
  finish: number | null;
  moved: number | null;
  dnf: boolean;
  dnfLap: number | null;
  points: number;
  stops: number[];
  compounds: string[];
  pace: string | null;
  paceRaw: number | null;
  overtakes: number;
  penalty: string | null;
  penaltyFor: string | null;
  led: number;
  swings: { lap: number; lost: number }[];
  fastestLap: boolean;
  gap: number | null;
  vsWinner: number | null;
  extraStops: number;
};

export type Brain = {
  typicalStops: number;
  pitLoss: number | null;
  session: string;
  circuit: string;
  laps: number;
  winner: string | null;
  drivers: Record<string, BrainDriver>;
  lapEvents: Record<string, string[]>;
  topics: { id: string; keys: string[]; say: string[] }[];
};

/** A driver's afternoon with the name taken off, for the blind test. */
export type BlindRound = {
  answer: string;
  options: string[];
  rows: [string, string][];
  tell: string;
};

export type BlindTest = { session: string; rounds: BlindRound[] };
