export type CardData = {
  type: "cover" | "prediction" | "moment" | "share";
  lap?: number;
  kicker?: string;
  title?: string;
  text?: string;
  options?: string[];
  answer?: string;
  dato?: { label: string; rows: [string, number][] };
};

export type Story = {
  gp: string;
  session: string;
  circuit: string;
  laps: number;
  generated: string;
  cards: CardData[];
};

export type Track = {
  circuit: string;
  view: number;
  start: number[];
  points: [number, number][];
  corners: { x: number; y: number; label: string }[];
};
