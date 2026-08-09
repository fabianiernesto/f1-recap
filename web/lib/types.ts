export type CardData = {
  type: "cover" | "prediction" | "moment" | "share";
  lap?: number;
  kicker?: string;
  title?: string;
  text?: string;
  options?: string[];
  answer?: string;
  reveal?: string;
  dato?: { label: string; rows: [string, number][] };
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
  circuit: string;
  laps: number;
  generated: string;
  result?: {
    date: string;
    podium: PodiumDriver[];
    fastest: PodiumDriver & { time: number };
  };
  cards: CardData[];
};

export type Track = {
  circuit: string;
  view: number;
  start: number[];
  points: [number, number][];
  corners: { x: number; y: number; label: string }[];
};
