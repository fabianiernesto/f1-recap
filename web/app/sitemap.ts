import type { MetadataRoute } from "next";
import { listGPs, loadReplay, loadWeekend } from "@/lib/data";
import { SITE } from "@/lib/site";

/** Every page a weekend file can back, and none it cannot: the games are
 *  listed only where the page itself would not 404. */
export default function sitemap(): MetadataRoute.Sitemap {
  const urls: string[] = ["/"];
  for (const slug of listGPs()) {
    const w = loadWeekend(slug);
    urls.push(`/gp/${slug}`, `/gp/${slug}/sessions`, `/gp/${slug}/activities`);
    for (const s of w.sessions) {
      urls.push(`/gp/${slug}/${s.slug}`);
      if (s.kind !== "race") continue;
      const r = loadReplay(slug, s.slug);
      if (r && r.calls.length >= 3) urls.push(`/gp/${slug}/${s.slug}/call`);
      if (r) urls.push(`/gp/${slug}/${s.slug}/exchange`);
    }
  }
  return urls.map((u) => ({ url: `${SITE}${u === "/" ? "" : u}` }));
}
