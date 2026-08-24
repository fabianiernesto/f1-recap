import { redirect } from "next/navigation";
import { listGPs } from "@/lib/data";

export function generateStaticParams() {
  return listGPs().map((slug) => ({ slug }));
}

/** The chooser used to live here under a name that belonged to the scroll.
 *  Kept so old links land somewhere sensible. */
export default async function WeekendPage({
  params,
}: PageProps<"/gp/[slug]/weekend">) {
  const { slug } = await params;
  redirect(`/gp/${slug}/activities`);
}
