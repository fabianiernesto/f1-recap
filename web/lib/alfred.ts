import type { Brain, BrainDriver } from "./types";

/**
 * What Alfred says back.
 *
 * Everything he answers is looked up in the race pack the pipeline built, so
 * he cannot invent a result, a lap or a penalty. When he has nothing, he says
 * so rather than guessing, which is the whole reason he is worth asking.
 *
 * Order matters: a driver's name beats a keyword, and a lap number beats a
 * topic, because "what happened to hamilton" is a question about Hamilton
 * even though it also contains "happened".
 */

const clean = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function findDriver(q: string, raw: string, brain: Brain): BrainDriver | null {
  for (const [key, d] of Object.entries(brain.drivers)) {
    if (key.length > 2 && q.includes(key)) return d;
    // three letter codes only when typed as codes: VER, HAM, HAD. Lowercased
    // they collide with ordinary words, and "who had the pace" was being
    // answered as a question about Hadjar
    if (d.code && new RegExp(`\\b${d.code.toUpperCase()}\\b`).test(raw))
      return d;
  }
  return null;
}

function driverSay(d: BrainDriver, q: string, brain: Brain): string[] {
  const asks = (...k: string[]) => k.some((x) => q.includes(x));
  const stops = d.stops.length
    ? `${d.stops.length === 1 ? "one stop" : `${d.stops.length} stops`}, lap ${d.stops.join(" and ")}`
    : "never stopped";

  if (asks("pit", "stop", "parada", "boxes", "strategy", "estrategia"))
    return [
      `${d.name}: ${stops}`,
      d.compounds.length
        ? `went ${d.compounds.join(" then ").toLowerCase()} on tyres`
        : "",
    ];

  if (asks("tyre", "tire", "compound", "neumatico", "rueda"))
    return d.compounds.length
      ? [`${d.name} ran ${d.compounds.join(" then ").toLowerCase()}`,
         "softer is quicker and dies faster. that trade is the whole afternoon"]
      : [`no tyre data on ${d.name}, which usually means he barely ran`];

  if (asks("penalty", "sancion", "punished"))
    return d.penalty
      ? [`${d.name} picked up a ${d.penalty} penalty`,
         d.penaltyFor ? `for ${d.penaltyFor}` : ""]
      : [`${d.name} kept his nose clean, no penalty`];

  if (asks("fast", "pace", "ritmo", "quick", "rapido"))
    return d.pace
      ? [`${d.name}'s median clean lap was ${d.pace}`,
         "median rather than best, because one hot lap tells you nothing about "
           + "the afternoon he actually had"]
      : [`not enough clean laps from ${d.name} to call his pace honestly`];

  if (asks("overtak", "adelanta", "passes"))
    return [
      d.overtakes
        ? `${d.name} made ${d.overtakes} on-track pass${d.overtakes === 1 ? "" : "es"}`
        : `${d.name} didn't pass anybody on track`,
      "not counting lap 1 or safety car restarts, those aren't really passes",
    ];

  // the default: his whole afternoon in three lines
  if (d.dnf)
    return [
      `${d.name} didn't finish. the ${d.team} car stopped on lap ${d.dnfLap} of ${brain.laps}`,
      d.start
        ? `he'd started P${d.start}${d.overtakes ? ` and made ${d.overtakes} passes before it went` : ""}`
        : "",
      "zero points. that's how championships quietly bleed out",
    ];

  const moved =
    d.moved && d.moved > 0
      ? `, ${d.moved} places up`
      : d.moved && d.moved < 0
        ? `, ${Math.abs(d.moved)} places the wrong way`
        : "";
  return [
    `${d.name}, ${d.team}`,
    d.start && d.finish
      ? `started P${d.start}, finished P${d.finish}${moved}`
      : d.finish
        ? `finished P${d.finish}`
        : "",
    [stops, d.pace ? `median lap ${d.pace}` : "", d.points ? `${d.points} points` : ""]
      .filter(Boolean)
      .join(" · "),
  ];
}

function lapSay(n: number, brain: Brain): string[] {
  if (n < 1 || n > brain.laps)
    return [`there was no lap ${n}, the race was ${brain.laps} laps`];
  const events = brain.lapEvents[String(n)];
  return events?.length
    ? [`lap ${n}:`, ...events]
    : [`nothing much on lap ${n}`, "one of the quiet ones, and most of them are"];
}

function topicSay(q: string, brain: Brain): string[] | null {
  let best: { score: number; say: string[] } | null = null;
  for (const t of brain.topics) {
    let score = 0;
    for (const k of t.keys) if (q.includes(k)) score = Math.max(score, k.length);
    if (score && (!best || score > best.score)) best = { score, say: t.say };
  }
  return best ? best.say : null;
}

const LOST = [
  "not sure what you're after there",
  "try me on a driver, a lap number, or things like why did he pit, what's "
    + "drs, who had the pace, was it any good",
];

/** One question in, a short burst of messages out. */
export function askAlfred(question: string, brain: Brain): string[] {
  const q = clean(question);
  if (!q) return [];

  const driver = findDriver(q, question, brain);
  if (driver) return driverSay(driver, q, brain).filter(Boolean);

  const lapWord = /\b(?:lap|vuelta)\s*(\d{1,3})\b/.exec(q);
  const bareNumber = /^\s*(\d{1,3})\s*$/.exec(q);
  const n = lapWord?.[1] ?? bareNumber?.[1];
  if (n) return lapSay(Number(n), brain).filter(Boolean);

  const topic = topicSay(q, brain);
  if (topic) return topic.filter(Boolean);

  return LOST;
}

/** Starters, so the box is never a blank stare. */
export const STARTERS = [
  "who won?",
  "what happened to verstappen?",
  "what's an undercut?",
  "was it any good?",
];
