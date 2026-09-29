import Link from "next/link";
import { getAudit } from "@/lib/audits";
import { prisma } from "@/lib/db";
import {
  AUDIT_STANDARD_LABELS,
  AUDIT_STATUS_LABELS,
  EXTERNAL_AUDIT_TYPE_LABELS,
  FINDING_SEVERITY_LABELS,
} from "@/domain/audits/types";
import { FINDING_STATUS_LABELS, FINDING_TYPE_LABELS } from "@/domain/findings/types";
import {
  CancelExternalAuditForm,
  CompleteExternalAuditButton,
  ExternalAuditPlanForm,
  ExternalFindingForm,
  ExternalReportUpload,
} from "@/app/(tenant)/t/[slug]/audits/ExternalAuditForms";
import { formatDate, toDateInput } from "@/app/(tenant)/t/[slug]/audits/access";

type ExternalAudit = NonNullable<Awaited<ReturnType<typeof getAudit>>>;

export async function ExternalAuditView({
  slug,
  tenantId,
  audit,
  canPlan,
}: {
  slug: string;
  tenantId: string;
  audit: ExternalAudit;
  canPlan: boolean;
}) {
  const findings = await prisma.finding.findMany({
    where: { tenantId, auditId: audit.id },
    select: { id: true, title: true, type: true, severity: true, status: true },
    orderBy: { createdAt: "asc" },
  });
  const reports = await prisma.auditReportAttachment.findMany({
    where: { tenantId, auditId: audit.id },
    select: { id: true, fileName: true },
    orderBy: { createdAt: "asc" },
  });
  const pending = audit.status === "planned";

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-8">
      <header>
        <Link href={`/t/${slug}/audits`} className="text-sm text-[var(--color-accent)]">
          ← Auditorías internas
        </Link>
        <p className="mt-2 font-[family-name:var(--font-mono)] text-xs text-[var(--color-ink-muted)]">
          {audit.code} · Auditoría externa ·{" "}
          {audit.status === "closed" ? "Realizada" : AUDIT_STATUS_LABELS[audit.status]}
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">{audit.title}</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          No entra en el programa anual, la cobertura ni los indicadores; sus hallazgos sí se gestionan
          en Hallazgos.
        </p>
        {audit.cancelReason ? (
          <p className="mt-2 text-sm text-[var(--color-ink-muted)]">Cancelada: {audit.cancelReason}</p>
        ) : null}
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="font-[family-name:var(--font-display)] text-xl">Plan</h2>
        {pending && canPlan ? (
          <ExternalAuditPlanForm
            slug={slug}
            auditId={audit.id}
            defaults={{
              title: audit.title,
              externalBody: audit.externalBody ?? "",
              externalType: audit.externalType ?? "",
              externalAuditor: audit.externalAuditor ?? "",
              externalResult: audit.externalResult ?? "",
              responseDueAt: audit.responseDueAt ? toDateInput(audit.responseDueAt) : "",
              scope: audit.scope,
              standards: audit.standards,
              plannedStart: toDateInput(audit.plannedStart),
              plannedEnd: toDateInput(audit.plannedEnd),
            }}
          />
        ) : (
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[10rem_1fr]">
            <dt className="font-medium">Entidad que audita</dt>
            <dd>{audit.externalBody}</dd>
            <dt className="font-medium">Tipo</dt>
            <dd>{audit.externalType ? EXTERNAL_AUDIT_TYPE_LABELS[audit.externalType] : "—"}</dd>
            <dt className="font-medium">Auditor líder</dt>
            <dd>{audit.externalAuditor || "—"}</dd>
            <dt className="font-medium">Resultado</dt>
            <dd>{audit.externalResult || "—"}</dd>
            <dt className="font-medium">Plazo para responder NC</dt>
            <dd>{audit.responseDueAt ? formatDate(audit.responseDueAt) : "—"}</dd>
            <dt className="font-medium">Fechas</dt>
            <dd>
              {formatDate(audit.plannedStart)} – {formatDate(audit.plannedEnd)}
            </dd>
            <dt className="font-medium">Normas</dt>
            <dd>{audit.standards.map((s) => AUDIT_STANDARD_LABELS[s]).join(", ") || "—"}</dd>
            <dt className="font-medium">Alcance</dt>
            <dd>{audit.scope || "—"}</dd>
          </dl>
        )}
      </section>

      <section className="flex flex-col gap-3 border-t border-[var(--color-line)] pt-6">
        <h2 className="font-[family-name:var(--font-display)] text-xl">Informe del auditor externo</h2>
        <ExternalReportUpload
          slug={slug}
          auditId={audit.id}
          files={reports}
          canUpload={canPlan && audit.status !== "cancelled"}
        />
      </section>

      <section className="flex flex-col gap-3 border-t border-[var(--color-line)] pt-6">
        <h2 className="font-[family-name:var(--font-display)] text-xl">Hallazgos</h2>
        {findings.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-muted)]">Todavía no se cargaron hallazgos.</p>
        ) : (
          <ul className="divide-y divide-[var(--color-line)] rounded-[var(--radius-md)] border border-[var(--color-line)]">
            {findings.map((f) => (
              <li key={f.id}>
                <Link
                  href={`/t/${slug}/findings/${f.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-[var(--color-surface)]"
                >
                  <span className="min-w-0">
                    <span className="mr-2 text-xs uppercase tracking-wide text-[var(--color-ink-muted)]">
                      {f.severity ? FINDING_SEVERITY_LABELS[f.severity] : FINDING_TYPE_LABELS[f.type]}
                    </span>
                    <span className="font-medium">{f.title}</span>
                  </span>
                  <span className="rounded-[var(--radius-sm)] bg-[var(--color-surface)] px-2 py-0.5 text-xs font-semibold text-[var(--color-ink-muted)]">
                    {FINDING_STATUS_LABELS[f.status]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {canPlan && audit.status !== "cancelled" ? (
          <div className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--color-line)] p-4">
            <h3 className="text-sm font-semibold">Registrar hallazgo</h3>
            <p className="text-xs text-[var(--color-ink-muted)]">
              Se crea como borrador en Hallazgos: completá la causa y las medidas y publicalo.
            </p>
            <ExternalFindingForm slug={slug} auditId={audit.id} />
          </div>
        ) : null}
      </section>

      {pending && canPlan ? (
        <div className="flex flex-col gap-3 border-t border-[var(--color-line)] pt-4">
          <CompleteExternalAuditButton slug={slug} auditId={audit.id} />
          <CancelExternalAuditForm slug={slug} auditId={audit.id} />
        </div>
      ) : null}
    </div>
  );
}
