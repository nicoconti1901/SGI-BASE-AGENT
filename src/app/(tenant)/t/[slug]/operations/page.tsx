import { redirect } from "next/navigation";

type Params = Promise<{ slug: string }>;

/** Compat: operaciones NC → bandeja de hallazgos. */
export default async function OperationsRedirectPage({
  params,
}: {
  params: Params;
}) {
  const { slug } = await params;
  redirect(`/t/${slug}/findings`);
}
