import { redirect } from "next/navigation";
import { NewRecordView, type NewRecordQuery } from "@/app/(tenant)/t/[slug]/risks/NewRecordView";

export default async function NewRiskPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<NewRecordQuery & { tipo?: string }>;
}) {
  const { slug } = await params;
  const { tipo, ...query } = await searchParams;
  // Enlaces anteriores: ?tipo=oportunidad ahora tiene su propia pantalla.
  if (tipo === "oportunidad") redirect(`/t/${slug}/risks/opportunities/new`);
  return <NewRecordView slug={slug} kind="risk" query={query} />;
}
