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

// every driver named in the question, because "leclerc or russell" is a
// comparison and answering about only the first one misses the point
function findDrivers(q: string, raw: string, brain: Brain): BrainDriver[] {
  const found: BrainDriver[] = [];
  for (const [key, d] of Object.entries(brain.drivers)) {
    if (key.length > 2 && q.includes(key)) { found.push(d); continue; }
    // three letter codes only when typed as codes: VER, HAM, HAD. Lowercased
    // they collide with ordinary words, and "who had the pace" was being
    // answered as a question about Hadjar
    if (d.code && new RegExp(`\\b${d.code.toUpperCase()}\\b`).test(raw))
      found.push(d);
  }
  return found.slice(0, 2);
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

/**
 * The reasoning half.
 *
 * "why did antonelli lose it" is not a lookup, it is an argument, and the
 * pieces of that argument are all in the pack: an extra stop against what the
 * field did, a penalty, the lap he dropped a chunk of places, his pace next to
 * the winner's. Alfred lays them out and lets them add up, and he never
 * asserts a cause the data does not carry.
 */
function whySay(d: BrainDriver, brain: Brain): string[] {
  if (d.dnf)
    return [
      `${d.name} didn't lose it, the car did. it stopped on lap ${d.dnfLap} of ${brain.laps}`,
      d.start ? `he'd started P${d.start} and was still running when it went` : "",
      "they never say what broke on the day. teams sit on that for weeks",
    ];

  const causes: string[] = [];
  if (d.extraStops > 0 && brain.pitLoss)
    causes.push(
      `${d.stops.length} stops when the field was doing ${brain.typicalStops}, ` +
        `and the lane costs about ${brain.pitLoss}s a go`
    );
  if (d.penalty)
    causes.push(`a ${d.penalty} penalty${d.penaltyFor ? ` for ${d.penaltyFor}` : ""}`);
  const worst = d.swings[0];
  if (worst && worst.lost >= 2)
    causes.push(`${worst.lost} places gone in one go on lap ${worst.lap}`);
  if (d.vsWinner !== null && d.vsWinner > 0.4)
    causes.push(`and he was ${d.vsWinner.toFixed(2)}s a lap slower than the winner`);

  // won it
  if (d.finish === 1)
    return [
      `${d.name} won it from P${d.start ?? "?"}`,
      d.led ? `led ${d.led} lap${d.led === 1 ? "" : "s"} of ${brain.laps}` : "",
      d.stops.length
        ? `${d.stops.length} stop${d.stops.length === 1 ? "" : "s"}, lap ${d.stops.join(" and ")}, and nothing went wrong. that's usually the whole story up front`
        : "",
    ];

  const lost = d.moved !== null && d.moved < 0;
  const gained = d.moved !== null && d.moved > 0;

  if (lost) {
    const head = `${d.name} started P${d.start} and finished P${d.finish}. ${Math.abs(
      d.moved as number
    )} places gone`;
    const tail: string[] = [];
    if (d.fastestLap)
      tail.push(
        "and he set the fastest lap of the whole race, so it wasn't the car being slow"
      );
    else if (d.vsWinner !== null && d.vsWinner <= 0.4)
      tail.push(
        `his median lap was only ${d.vsWinner.toFixed(2)}s off the winner, so the pace was there`
      );
    if (d.gap !== null && d.gap < 30)
      tail.push(
        `he finished ${d.gap.toFixed(1)}s behind the winner, which tells you how much the safety car bunched everyone up`
      );
    return causes.length
      ? [head, causes.join(", plus "), ...tail]
      : [head, "nothing dramatic in the data, just a slow afternoon", ...tail];
  }

  if (gained)
    return [
      `${d.name} went the right way: P${d.start} to P${d.finish}`,
      d.overtakes ? `${d.overtakes} on-track passes doing it` : "",
      d.stops.length ? `on a ${d.stops.length} stop` : "",
    ];

  // led it and still did not win it: the one afternoon that is never quiet.
  // Russell led 41 of Monza's 53 laps from pole and finished second, and the
  // old answer here was "nothing in the data", which is the data not being
  // read. The laps-led figure is the whole story.
  if (d.led && d.led >= brain.laps * 0.3 && d.finish !== 1) {
    const winner = Object.values(brain.drivers).find((x) => x.finish === 1);
    return [
      `${d.name} led ${d.led} of ${brain.laps} laps and still finished P${d.finish}. that's the one that hurts`,
      winner
        ? `${winner.name} came through${winner.start && winner.start > 3 ? ` from P${winner.start}` : ""}, and by the end ${d.name} had nothing left to answer with`
        : "",
      causes.length ? causes.join(", plus ") : "",
      d.gap !== null ? `${d.gap.toFixed(3)}s behind at the flag, after leading most of the afternoon` : "",
    ];
  }

  return [
    `${d.name} finished where he started, P${d.finish}`,
    causes.length ? causes.join(", plus ") : "quiet afternoon, nothing in the data",
  ];
}

/** Two names in one question is a comparison, so answer it as one. */
function compareSay(a: BrainDriver, b: BrainDriver, brain: Brain): string[] {
  const line = (d: BrainDriver) =>
    d.dnf
      ? `${d.name}: out on lap ${d.dnfLap}`
      : `${d.name}: P${d.start ?? "?"} to P${d.finish}, ${d.stops.length} stop${
          d.stops.length === 1 ? "" : "s"
        }${d.pace ? `, median ${d.pace}` : ""}`;
  const quicker =
    a.paceRaw && b.paceRaw
      ? a.paceRaw < b.paceRaw
        ? `${a.name} had the better pace, by ${(b.paceRaw - a.paceRaw).toFixed(2)}s a lap`
        : `${b.name} had the better pace, by ${(a.paceRaw - b.paceRaw).toFixed(2)}s a lap`
      : "";
  return [line(a), line(b), quicker];
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

  const named = findDrivers(q, question, brain);
  if (named.length === 2)
    return compareSay(named[0], named[1], brain).filter(Boolean);
  if (named.length === 1) {
    const wantsWhy = /\b(why|porque|por que|lost|lose|losing|wrong|happened|paso|perdio|throw|threw|blew)\b/.test(q);
    return (wantsWhy ? whySay(named[0], brain) : driverSay(named[0], q, brain)).filter(Boolean);
  }

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
