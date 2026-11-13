export type CardData = {
  type: "cover" | "prediction" | "moment" | "share" | "decision" | "guess";
  lap?: number;
  kicker?: string;
  title?: string;
  text?: string;
  /** skimmable facts under the lead line, because nobody reads a block */
  bullets?: string[];
  /** the closing thought: a reflection is prose, not an item in a list */
  note?: string;
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
  /** The race in the numbers the home leads with. Null until the race is built. */
  facts?: RaceFacts | null;
  rating: { score: number; verdict: string; spoiler_free: boolean } | null;
  heat: number[];
};

export type RaceFacts = {
  winner: {
    first: string; last: string; team: string; colour: string;
    number: number; start: number | null; headshot: string;
  };
  margin: number | null;
  runnerUp: string | null;
  fastest: { last: string; time: string } | null;
  passes: number;
  stops: number;
  dnfs: number;
  safetyCars: number;
  redFlag: boolean;
  laps: number;
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
  dnfWhy?: string | null;
  pitLane?: boolean;
  dsq?: boolean;
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

/** A driver's afternoon with the name taken off, for the blind test.
 *  Everything after `tell` is for the reveal, never for the sheet. */
export type BlindRound = {
  answer: string;
  options: string[];
  rows: [string, string][];
  tell: string;
  number?: number;
  team?: string;
  colour?: string;
  headshot?: string;
};

export type BlindTest = { session: string; rounds: BlindRound[] };

/** The race, replayable (pipeline/replay.py): when every car crossed the line
 *  at the end of every lap, in seconds from the start, stoppages cut out. */
export type ReplayCar = {
  num: number; code: string; name: string; team: string; colour: string; photo: string;
  grid: number | null; finish: number | null; out: number | null; cross: number[];
  dsq?: boolean;
};
export type RaceCall = {
  /** the lap the tower and the options quote, when it is not `lap` (a neutralisation: the lap before) */
  towerLap?: number;
  /** the cars the answer hangs on: it shows once they have crossed `reveal` */
  cars?: number[];
  kind: string; lap: number; reveal: number; flag?: string;
  q: string; ctx: string; options: { id: string; label: string; sub?: string }[];
  answer: string; why: string;
};
export type Replay = {
  laps: number; lapTime: number; field: ReplayCar[];
  neutral: { kind: "SC" | "VSC"; from: number; to: number }[];
  red: number[]; pits: [number, number][];
  fastest: { num: number; lap: number } | null;
  calls: RaceCall[];
};

/** The ghost (pipeline/muro.py): the strategy calls a driver's garage faced,
 *  each option priced against what they really did. */
export type GhostOption = {
  label: string; lap: number; lost: number; real: boolean; note: string; delta?: number;
  rejoin?: { pos: number; ahead?: [string, number]; behind?: [string, number] };
};
export type GhostCall = {
  lap: number; kicker: string; question: string; facts: [string, string][];
  options: GhostOption[]; reading: string; scored: boolean; moved?: number | null;
};
export type GhostSeat = {
  name: string; number: number; team: string; colour: string; headshot: string;
  start: number | null; finish: number; margin: number; calls: GhostCall[];
  /** the live ghost: every lap of each trusted stop window, priced */
  windows?: GhostWindow[];
  stints?: [string | null, number, number | null][];
};
export type GhostWindow = {
  stop: number; lo: number; hi: number; from: number; comp: string; next: string; deg: number;
  laps: Record<string, { d: number; rejoin?: { pos: number; ahead?: [string, number]; behind?: [string, number] } }>;
};
export type GhostRace = {
  session: string; laps: number;
  economics: { pitLoss: number; tyres: Record<string, { deg: number }> };
  ladder: { pos: number; name: string; team: string; gap: number }[];
  seats: GhostSeat[];
};

/** The mystery driver: one driver per race, the same for everybody, guessed
 *  from clues that go from vague to damning (pipeline/mystery.py). */
export type MysteryDriverRow = {
  name: string; number: number; team: string;
  start: number | null; stops: number; passes: number;
  colour?: string; headshot?: string;
};
export type Mystery = {
  session: string;
  answer: MysteryDriverRow & { colour: string; headshot: string; tell: string };
  /** k: what it is; big: the figure; say: the clue as a sentence about him */
  clues: { k: string; big: string; say: string; kind?: "tyres" | "tell" | "purple" }[];
  field: MysteryDriverRow[];
};

/** One call the pit wall put in front of a garage, and what each answer cost. */
export type PitWallOption = {
  label: string;
  lap: number;
  lost: number;
  real?: boolean;
  note: string;
};

export type PitWallCall = {
  lap: number;
  kicker: string;
  question: string;
  facts: [string, string][];
  options: PitWallOption[];
  reading: string;
};

export type PitWall = {
  session: string;
  laps: number;
  driver: {
    name: string;
    number: number;
    team: string;
    colour: string;
    headshot?: string;
    start: number | null;
    finish: number;
    margin: number;
  };
  economics: {
    pitLoss: number;
    fuelTrend: number;
    tyres: Record<string, { deg: number; base: number; laps: number }>;
    typicalDeg: number;
  };
  calls: PitWallCall[];
  ladder: { pos: number; name: string; team: string; gap: number }[];
};
