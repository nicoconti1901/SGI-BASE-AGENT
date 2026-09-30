import Link from "next/link";
import { redirect } from "next/navigation";
import { listTenantMemberOptions } from "@/lib/findings";
import { CreateObjectiveForm } from "@/app/(tenant)/t/[slug]/indicators/ObjectiveForms";
import { loadIndicatorsAccess } from "@/app/(tenant)/t/[slug]/indicators/access";

export default async function NewObjectivePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { tenant, canManage } = await loadIndicatorsAccess(slug);
  if (!canManage) redirect(`/t/${slug}/indicators`);
  const members = await listTenantMemberOptions(tenant.id);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-8">
      <div>
        <Link href={`/t/${slug}/indicators`} className="text-sm text-[var(--color-accent)]">
          ← Objetivos e indicadores
        </Link>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl">Nuevo objetivo</h1>
        <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
          Definí qué querés lograr, quién responde y para cuándo. En el paso siguiente agregás los
          indicadores con los que se mide.
        </p>
      </div>
      <CreateObjectiveForm slug={slug} members={members.map((m) => ({ id: m.id, name: m.name }))} />
    </div>
  );
}
