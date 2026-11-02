import { redirect } from "next/navigation";

/** «Explorar una fuente» se reemplazó por el alta directa de riesgo u oportunidad; se conserva el enlace. */
export default async function ExploreContextPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { slug } = await params;
  const query = new URLSearchParams(
    Object.entries(await searchParams).filter((e): e is [string, string] => typeof e[1] === "string"),
  );
  redirect(`/t/${slug}/risks/new${query.size ? `?${query}` : ""}`);
}
