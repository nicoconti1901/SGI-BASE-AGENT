import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import {
  listRecentGapAudits,
  listTenantGapRequirements,
} from "@/lib/assessment-gap";
import {
  DOCUMENT_FATE_LABELS,
  GAP_STATUS_LABELS,
  type DocumentFate,
  type RequirementStatus,
} from "@/domain/assessment/gap";
import { PLATFORM_ROLE_LABEL } from "@/domain/identity/authz";
import { GapAssessmentForm } from "@/app/(platform)/platform/tenants/[slug]/gap/GapAssessmentForm";

type Params = Promise<{ slug: string }>;

export default async function TenantGapPage({ params }: { params: Params }) {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }

  const platformRole = (session.user as { platformRole?: string | null })
    .platformRole;
  if (platformRole !== "platform_superuser") {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="font-[family-name:var(--font-display)] text-3xl">
          Sin acceso
        </h1>
        <p className="mt-3 text-[var(--color-ink-muted)]">
          Solo el {PLATFORM_ROLE_LABEL.toLowerCase()} puede cargar el gap.
        </p>
      </div>
    );
  }

  const { slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) {
    notFound();
  }

  const [requirements, audits] = await Promise.all([
    listTenantGapRequirements(tenant.id),
    listRecentGapAudits(tenant.id, 15),
  ]);

  const formRows = requirements.map((row) => ({
    id: row.id,
    status: row.status as RequirementStatus,
    notes: row.notes,
    hasClientDocument: row.hasClientDocument,
    documentFate: row.documentFate,
    requirement: {
      standard: row.requirement.standard,
      clauseCode: row.requirement.clauseCode,
      title: row.requirement.title,
      essential: row.requirement.essential,
    },
  }));

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-ink-subtle)]">
            Assessment / gap
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl tracking-tight">
            {tenant.name}
          </h1>
          <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
            Cargá el estado por requisito, marcá si el cliente ya tiene
            documento y dejá notas del diagnóstico offline. El destino
            (conservar / reemplazar / crear) se calcula con{" "}
            <code className="font-[family-name:var(--font-mono)] text-xs">
              decideDocumentFate
            </code>
            .
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/platform/tenants/${slug}`}
            className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-4 py-2 text-sm font-medium"
          >
            Ficha del tenant
          </Link>
          <Link
            href={`/t/${slug}`}
            className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-4 py-2 text-sm font-medium"
          >
            Portal cliente
          </Link>
        </div>
      </div>

      <GapAssessmentForm slug={slug} rows={formRows} />

      <section>
        <h2 className="font-[family-name:var(--font-display)] text-xl">
          Auditoría reciente
        </h2>
        {audits.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-ink-muted)]">
            Todavía no hay cambios registrados.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {audits.map((audit) => (
              <li
                key={audit.id}
                className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3 text-sm"
              >
                <p className="text-[var(--color-ink)]">
                  <strong>{audit.user.name}</strong> ·{" "}
                  {audit.tenantRequirement.requirement.standard}{" "}
                  {audit.tenantRequirement.requirement.clauseKey} —{" "}
                  {audit.tenantRequirement.requirement.title}
                </p>
                <p className="mt-1 text-[var(--color-ink-muted)]">
                  {GAP_STATUS_LABELS[audit.previousStatus as RequirementStatus]}{" "}
                  → {GAP_STATUS_LABELS[audit.newStatus as RequirementStatus]}
                  {" · "}
                  {
                    DOCUMENT_FATE_LABELS[
                      audit.previousDocumentFate as DocumentFate
                    ]
                  }{" "}
                  →{" "}
                  {
                    DOCUMENT_FATE_LABELS[
                      audit.newDocumentFate as DocumentFate
                    ]
                  }
                  {" · "}
                  {new Date(audit.createdAt).toLocaleString("es-AR")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
