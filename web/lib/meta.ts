import type { Metadata } from "next";
import { hasSession, listGPs, loadWeekend } from "@/lib/data";

/**
 * The tab title and the card a shared link unfurls into, per page. Every line
 * is read off the weekend file, so a page never promises what it does not
 * hold. An unknown slug gets the 404's title and the page's own 404 takes over.
 */
type Part = "hub" | "sessions" | "activities" | "session" | "blind" | "pitwall" | "call" | "ghost" | "exchange";

export function gpMeta(slug: string, part: Part, session?: string): Metadata {
  if (!listGPs().includes(slug)) return { title: "Off the track" };
  if (session && !hasSession(slug, session)) return { title: "Off the track" };
  const w = loadWeekend(slug);
  const s = session ? w.sessions.find((x) => x.slug === session) : undefined;
  const where = `${w.gp} at ${w.circuit}, ${w.date}`;
  // a sprint's games have their own page, so they cannot read as the race's
  const sprint = session === "sprint";
  const race = sprint ? `${w.gp} sprint` : w.gp;
  const tab = sprint ? `${w.gp} · Sprint` : w.gp;
  const pick = (): [string, string] => {
    switch (part) {
      case "hub":
        return [w.gp, `${where}. Every session told as a story you scroll, built from the official timing data.`];
      case "sessions":
        return [`${w.gp} · Sessions`, `${where}. Every session of the weekend, from first practice to the flag.`];
      case "activities":
        return [`${w.gp} · Play it`, `${where}. Games built from the same timing data as the weekend itself.`];
      case "session":
        return [`${w.gp} · ${s?.label ?? ""}`, `${s?.label ?? ""} at ${w.circuit}: ${s?.headline ?? ""}. Told as a story you scroll.`];
      case "blind":
        return [`${w.gp} · The blind test`, `Five drivers from the ${w.gp} with their names taken off. Work out who you are looking at.`];
      case "call":
        return [`${tab} · Call the race`, `The ${race} replayed in three minutes on the real track. Call what happens next before it does.`];
      case "exchange":
        return [`${tab} · Paddock exchange`, `Every driver at the ${race} is a share priced by his place. Buy low, sell high, lap by lap as it really happened.`];
      case "ghost":
        return [`${w.gp} · The ghost`, `Run a driver's strategy your way at the ${w.gp} and race your ghost against the real field.`];
      case "pitwall":
        return [`${w.gp} · The pit wall`, `Take a seat on the pit wall at the ${w.gp} and make the calls the garage made.`];
    }
  };
  const [title, description] = pick();
  // openGraph and twitter replace the layout's whole object, so the site name
  // and the card picture (app/opengraph-image.png) have to ride along
  const images = [{ url: "/opengraph-image.png", width: 1200, height: 630, alt: "Racing Simplified" }];
  const tail = part === "hub" ? "" : part === "sessions" || part === "activities" ? `/${part}` : part === "session" ? `/${session}` : `/${session}/${part}`;
  const url = `/gp/${slug}${tail}`;
  // the retired games stay reachable by old links but out of search
  const retired = part === "blind" || part === "pitwall" || part === "ghost";
  return {
    title,
    description,
    alternates: { canonical: url },
    ...(retired ? { robots: { index: false, follow: false } } : {}),
    openGraph: { siteName: "Racing Simplified", type: "website", url, title, description, images },
    twitter: { card: "summary_large_image", title, description, images },
  };
}
