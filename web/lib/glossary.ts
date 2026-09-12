/**
 * The words this sport uses without ever explaining them.
 *
 * Every screen here is built out of real timing data, which means every screen
 * is full of terms a casual fan has heard on a broadcast and never had defined:
 * median lap, undercut, stint, deleted lap. The whole promise of the project
 * falls apart if the numbers are honest and the labels are impenetrable.
 *
 * So the labels explain themselves. A term in this list gets a dotted
 * underline wherever it appears, and hovering or tapping it says what it means
 * in one line. Nothing here is a dictionary entry: each one says what the thing
 * is AND why it is worth looking at, because "median lap: the middle lap time"
 * teaches nobody anything.
 *
 * Keys are matched case-insensitively against the label as it appears on
 * screen, so a new label with no entry simply renders plain. Adding a term is
 * adding a line.
 */

export type Term = { short: string; why?: string };

export const GLOSSARY: Record<string, Term> = {
  // ---- where you were, where you ended up
  started: {
    short: "The slot on the grid he lined up in, decided by qualifying on Saturday.",
    why: "Everything a driver does on Sunday is measured against this number.",
  },
  grid: { short: "The starting order, set by qualifying." },
  pole: {
    short: "First on the grid. The fastest single lap in qualifying takes it.",
    why: "Around half of all races are won from here, which tells you how much Saturday matters.",
  },
  finished: { short: "Where he was classified at the chequered flag." },
  classified: {
    short: "Officially ranked at the finish. You need to complete 90% of the winner's distance.",
    why: "Miss that and you get no position at all, even if you were still driving.",
  },
  "laps completed": { short: "How many times he crossed the line." },
  "laps led": {
    short: "Laps he crossed the line in first place.",
    why: "Leading and winning are different things, and the gap between them is usually strategy.",
  },
  "points scored": {
    short: "Top ten score, 25 down to 1. Nothing for eleventh.",
    why: "This is the only number that decides the championship.",
  },
  "top ten": { short: "The points-scoring positions." },

  // ---- the stops
  stops: {
    short: "Pit stops. The tyres are the only part of the car a team can change mid-race.",
    why: "When you take them decides most races that are not decided by pace.",
  },
  "a stop cost": {
    short: "The time a pit stop threw away here, against a car that stayed on track.",
    why: "It is the price of every strategy call, and it changes from circuit to circuit.",
  },
  "pit loss": { short: "Time lost coming in, stopping and rejoining, against staying out." },
  undercut: {
    short: "Stopping before the car you are chasing, so your fresh tyres eat into his lead while he is still on old ones.",
    why: "The most common way one car gets past another without ever passing it.",
  },
  overcut: {
    short: "Staying out longer than the car you are chasing, banking quick laps in clear air while he is in the pit lane.",
    why: "Works when the track is quick and the tyres are not falling apart.",
  },
  "pit window": { short: "The stretch of laps where stopping makes sense." },

  // ---- the rubber
  tyres: {
    short: "Which compounds he ran, in order.",
    why: "The rules make you use two different ones, so every race has at least one stop built into it.",
  },
  tyre: { short: "What is on the car now, and how many laps it has done." },
  compound: {
    short: "How soft the rubber is. Soft is quicker and dies sooner; hard lasts and is slower.",
    why: "Picking one is picking how much of the race you want to spend fast.",
  },
  stint: { short: "One run between two pit stops." },
  "stints by compound": { short: "How long each set of tyres lasted him." },
  wear: {
    short: "How much slower a tyre gets with every lap it does.",
    why: "Measured here in milliseconds a lap: 60ms over twenty laps is more than a second.",
  },
  "hard wear": { short: "How much time the hard tyre lost per lap of age, in this race." },
  "medium wear": { short: "How much time the medium tyre lost per lap of age, in this race." },
  "soft wear": { short: "How much time the soft tyre lost per lap of age, in this race." },

  // ---- pace
  "median lap": {
    short: "His middle lap time: half his laps were quicker, half slower.",
    why: "A fairer read of pace than the fastest lap, which is often one clean shot with the right tyres.",
  },
  "median clean lap": {
    short: "The middle lap time once traffic, safety cars and pit laps are stripped out.",
    why: "As close as the data gets to how quick the car actually was.",
  },
  "average clean lap": { short: "The mean lap once the messy laps are taken out." },
  "fastest lap": {
    short: "The quickest single lap of the race.",
    why: "Worth a point if you finish in the top ten, which is why you see late stops just to take it.",
  },
  sector: {
    short: "Each lap is split into three timed sections.",
    why: "Comparing them shows where a car is quick, not just that it is.",
  },
  "best sector times": { short: "The quickest each driver went in each third of the lap." },
  "fastest sectors": { short: "Who owned each third of the lap." },
  "speed trap": { short: "One fixed point on the straight where top speed is measured." },
  drs: {
    short: "A flap in the rear wing that opens on the straights to cut drag.",
    why: "Only allowed within a second of the car ahead, which is the sport openly helping overtaking happen.",
  },

  // ---- fighting
  "on-track passes": {
    short: "Positions taken on the circuit, not in the pit lane.",
    why: "The number that separates a real drive from a good strategy.",
  },
  "most overtakes": { short: "Who did the most passing on track." },
  running: { short: "Where he sits in the order right now." },
  ahead: { short: "The car in front, and how far up the road he is." },
  behind: { short: "The car chasing him." },
  "dirty air": {
    short: "The churned-up air behind another car, which robs your own of grip.",
    why: "Why following closely is so much harder than it looks from the sofa.",
  },
  tow: { short: "The slipstream of the car ahead, worth speed on a straight." },
  backmarker: { short: "A car about to be lapped by the leaders." },
  lapped: { short: "A full lap behind the leader." },

  // ---- the flags and the rules
  "safety car": {
    short: "A road car leads the field slowly while something is cleared.",
    why: "It wipes out every gap on track, so a twenty-second lead can vanish through no fault of yours.",
  },
  "yellow flag": { short: "Danger ahead. Slow down, no overtaking." },
  "blue flag": { short: "Shown to a lapped car: let the leaders through." },
  "red flag": { short: "The session is stopped. Everyone back to the pit lane." },
  chequered: { short: "The flag at the finish." },
  steward: {
    short: "The officials who decide whether something was somebody's fault.",
    why: "They can add seconds to a driver's race hours after it ends.",
  },
  penalty: { short: "Time or a grid drop, handed out by the stewards." },
  "deleted laps": {
    short: "Lap times thrown out for running wide of the white lines.",
    why: "In qualifying it can be the difference between pole and tenth.",
  },
  "knocked out in q1": { short: "Out in the first part of qualifying: the slowest five." },
  "knocked out in q2": { short: "Out in the second part of qualifying, so no shot at the top ten." },
};

/** Normalised lookup, so "Median lap" and "MEDIAN LAP" find the same entry. */
export function lookUp(label: string): Term | null {
  const key = label.trim().toLowerCase().replace(/\s+/g, " ");
  return GLOSSARY[key] ?? null;
}
