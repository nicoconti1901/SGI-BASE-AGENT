import { NewRecordView, type NewRecordQuery } from "@/app/(tenant)/t/[slug]/risks/NewRecordView";

export default async function NewOpportunityPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<NewRecordQuery>;
}) {
  const { slug } = await params;
  return <NewRecordView slug={slug} kind="opportunity" query={await searchParams} />;
}
