import { redirect } from "next/navigation";

type Params = Promise<{ slug: string; ncId: string }>;

export default async function OperationsNcRedirectPage({
  params,
}: {
  params: Params;
}) {
  const { slug } = await params;
  redirect(`/t/${slug}/findings`);
}
