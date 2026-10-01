import { redirect } from "next/navigation";

export default async function MasterDataIndex({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/t/${slug}/master-data/people`);
}
