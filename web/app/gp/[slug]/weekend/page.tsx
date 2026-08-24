import { redirect } from "next/navigation";
import { listGPs } from "@/lib/data";

export function generateStaticParams() {
  return listGPs().map((slug) => ({ slug }));
}

/**
 * There used to be a page here that asked which activity you wanted, one click
 * after the front door had already asked. Choosing twice made the first choice
 * worthless, so the ways in moved onto the front door and this only exists to
 * keep old links working.
 */
export default async function WeekendPage({
  params,
}: PageProps<"/gp/[slug]/weekend">) {
  const { slug } = await params;
  redirect(`/gp/${slug}#ways-in`);
}
