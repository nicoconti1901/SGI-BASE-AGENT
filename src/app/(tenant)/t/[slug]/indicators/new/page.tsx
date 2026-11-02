import { redirect } from "next/navigation";
import { listTenantMemberOptions } from "@/lib/findings";
import { listOfferedStandards } from "@/lib/ims-catalog";
import { CreateObjectiveForm } from "@/app/(tenant)/t/[slug]/indicators/ObjectiveForms";
import { loadIndicatorsAccess } from "@/app/(tenant)/t/[slug]/indicators/access";
import { PageFrame, PageHeader } from "@/components/ui";

export default async function NewObjectivePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { tenant, canManage } = await loadIndicatorsAccess(slug);
  if (!canManage) redirect(`/t/${slug}/indicators`);
  const [members, standards] = await Promise.all([listTenantMemberOptions(tenant.id), listOfferedStandards(tenant.id)]);

  return (
    <PageFrame>
      <PageHeader
        eyebrow="ISO · §6.2"
        title="Nuevo objetivo"
        purpose="Qué querés lograr, quién responde, para cuándo y cómo. Después agregás el indicador con el que se mide."
      />
      <CreateObjectiveForm slug={slug} members={members.map((m) => ({ id: m.id, name: m.name }))} standards={standards} />
    </PageFrame>
  );
}
