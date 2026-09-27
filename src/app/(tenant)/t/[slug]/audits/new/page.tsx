import Link from "next/link";
import { redirect } from "next/navigation";
import { CreateAuditForm } from "@/app/(tenant)/t/[slug]/audits/AuditForms";
import { loadAuditsAccess } from "@/app/(tenant)/t/[slug]/audits/access";

export default async function NewAuditPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { canPlan } = await loadAuditsAccess(slug);
  if (!canPlan) redirect(`/t/${slug}/audits`);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-8">
      <div>
        <Link href={`/t/${slug}/audits`} className="text-sm text-[var(--color-accent)]">
          ← Auditorías internas
        </Link>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl">Planificar auditoría</h1>
        <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
          Empezá con un título y las fechas; en el paso siguiente completás objetivo, alcance y equipo.
        </p>
      </div>
      <CreateAuditForm slug={slug} />
    </div>
  );
}
