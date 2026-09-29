import Link from "next/link";
import { redirect } from "next/navigation";
import { CreateExternalAuditForm } from "@/app/(tenant)/t/[slug]/audits/ExternalAuditForms";
import { loadAuditsAccess } from "@/app/(tenant)/t/[slug]/audits/access";

export default async function NewExternalAuditPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { canPlan } = await loadAuditsAccess(slug);
  if (!canPlan) redirect(`/t/${slug}/audits`);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-8">
      <div>
        <Link href={`/t/${slug}/audits`} className="text-sm text-[var(--color-accent)]">
          ← Auditorías internas
        </Link>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl">
          Planificar auditoría externa
        </h1>
        <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
          Registrá la auditoría que te hace una entidad externa. No entra en el programa ni en la
          cobertura, pero podés cargar sus hallazgos para tratarlos como cualquier otro.
        </p>
      </div>
      <CreateExternalAuditForm slug={slug} />
    </div>
  );
}
