import Link from "next/link";
import { notFound } from "next/navigation";
import { getAudit } from "@/lib/audits";
import { listTenantMemberOptions } from "@/lib/findings";
import { planReadinessIssues, startReadinessIssues } from "@/domain/audits/lifecycle";
import { canExecuteAudit } from "@/domain/audits/checklist";
import { getChecklist, listChecklistCandidates } from "@/lib/audit-checklist";
import {
  AUDIT_MODE_LABELS,
  AUDIT_STANDARD_LABELS,
  AUDIT_STATUS_LABELS,
  FINDING_SEVERITY_LABELS,
  type AuditStatus,
} from "@/domain/audits/types";
import { FINDING_STATUS_LABELS, FINDING_TYPE_LABELS } from "@/domain/findings/types";
import {
  AuditPlanForm,
  CancelAuditForm,
  PrepareButton,
} from "@/app/(tenant)/t/[slug]/audits/AuditForms";
import {
  ChecklistBuilder,
  ChecklistItemCard,
  StartAuditForm,
  type RunnerItem,
} from "@/app/(tenant)/t/[slug]/audits/ChecklistForms";
import { ExternalAuditView } from "@/app/(tenant)/t/[slug]/audits/ExternalAuditView";
import { AuditReportForm,TransitionButton } from "@/app/(tenant)/t/[slug]/audits/ReportForms";
import { summarizeResults } from "@/domain/audits/guide";
import { formatDate, loadAuditsAccess, toDateInput } from "@/app/(tenant)/t/[slug]/audits/access";

const STEPS = [
  { title: "Plan", upTo: ["planned"] },
  { title: "Lista de verificación", upTo: ["prepared", "in_progress"] },
  { title: "Hallazgos", upTo: [] },
  { title: "Informe", upTo: ["reporting", "closed"] },
] as const;

function currentStep(status: AuditStatus): number {
  const idx = STEPS.findIndex((s) => (s.upTo as readonly string[]).includes(status));
  return idx === -1 ? 0 : idx;
}

export default async function AuditDetailPage({
  params,
}: {
  params: Promise<{ slug: string; auditId: string }>;
}) {
  const { slug, auditId } = await params;
  const { ctx, tenant, canPlan, canApprove } = await loadAuditsAccess(slug);
  const [audit, members, checklist] = await Promise.all([
    getAudit(tenant.id, auditId),
    listTenantMemberOptions(tenant.id),
    getChecklist(tenant.id, auditId),
  ]);
  if (!audit) notFound();
  if (audit.kind === "external") {
    return <ExternalAuditView slug={slug} tenantId={tenant.id} audit={audit} canPlan={canPlan} />;
  }
  const candidates =
    canPlan && (audit.status === "planned" || audit.status === "prepared")
      ? await listChecklistCandidates(tenant.id, audit.standards)
      : [];
  const canExecute = canExecuteAudit({
    isTeamMember: audit.team.some((m) => m.userId === ctx.userId),
    isCompanyAdmin: canApprove,
    isPlatformSuperuser: ctx.isPlatformSuperuser,
  });
  const runnerItems: RunnerItem[] = checklist.map((i) => ({
    id: i.id,
    question: i.question,
    standard: i.requirement?.requirement.standard ?? null,
    result: i.result,
    evidence: i.evidence,
    findingId: i.findingId,
    findingStatus: i.finding?.status ?? null,
    attachments: i.attachments.map((a) => ({ id: a.id, fileName: a.fileName })),
  }));
  const answered = checklist.filter((i) => i.result !== "pending").length;
  const summary = summarizeResults(checklist.map((i) => i.result));

  const nameOf = (id: string | null) => members.find((m) => m.id === id)?.name ?? "—";
  const lead = audit.team.find((m) => m.role === "lead");
  const auditors = audit.team.filter((m) => m.role === "auditor");
  const editablePlan = canPlan && (audit.status === "planned" || audit.status === "prepared");
  const step = currentStep(audit.status);

  const issues =
    audit.status === "planned"
      ? planReadinessIssues({
          objective: audit.objective,
          scope: audit.scope,
          standards: audit.standards,
          plannedStart: audit.plannedStart,
          plannedEnd: audit.plannedEnd,
          team: audit.team,
          auditeeUserIds: audit.auditees.map((a) => a.userId),
          checklistCount: audit._count.items,
          impartialityException: audit.impartialityException,
        })
      : [];

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-8">
      <header>
        <Link href={`/t/${slug}/audits`} className="text-sm text-[var(--color-accent)]">
          ← Auditorías internas
        </Link>
        <p className="mt-2 font-[family-name:var(--font-mono)] text-xs text-[var(--color-ink-muted)]">
          {audit.code} · {AUDIT_STATUS_LABELS[audit.status]}
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">{audit.title}</h1>
        {audit.cancelReason ? (
          <p className="mt-2 text-sm text-[var(--color-ink-muted)]">Cancelada: {audit.cancelReason}</p>
        ) : null}
      </header>

      <ol className="grid gap-2 sm:grid-cols-4" aria-label="Pasos de la auditoría">
        {STEPS.map((s, i) => (
          <li
            key={s.title}
            aria-current={i === step ? "step" : undefined}
            className={`rounded-md border px-3 py-2 text-sm ${
              i === step
                ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)] font-semibold text-[var(--color-accent-ink)]"
                : i < step
                  ? "border-[var(--color-line)] text-[var(--color-success)]"
                  : "border-[var(--color-line)] text-[var(--color-ink-subtle)]"
            }`}
          >
            {i + 1} · {s.title}
          </li>
        ))}
      </ol>

      {audit.status === "planned" && issues.length > 0 ? (
        <section className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3 text-sm">
          <p className="font-medium">Para dejarla preparada falta:</p>
          <ul className="mt-1 list-disc pl-5 text-[var(--color-ink-muted)]">
            {issues.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {editablePlan ? (
        <section className="flex flex-col gap-4">
          <h2 className="font-[family-name:var(--font-display)] text-xl">1 · Plan</h2>
          <AuditPlanForm
            slug={slug}
            auditId={audit.id}
            members={members.map((m) => ({ id: m.id, name: m.name }))}
            defaults={{
              title: audit.title,
              objective: audit.objective,
              scope: audit.scope,
              standards: audit.standards,
              plannedStart: toDateInput(audit.plannedStart),
              plannedEnd: toDateInput(audit.plannedEnd),
              mode: audit.mode,
              leadUserId: lead?.userId ?? "",
              auditorUserIds: auditors.map((a) => a.userId),
              auditees: audit.auditees.map((a) => ({ userId: a.userId ?? "", area: a.area })),
              impartialityException: audit.impartialityException ?? "",
            }}
          />
          <div className="flex flex-col gap-4 border-t border-[var(--color-line)] pt-6">
            <h2 className="font-[family-name:var(--font-display)] text-xl">2 · Lista de verificación</h2>
            {audit.standards.length === 0 ? (
              <p className="text-sm text-[var(--color-ink-muted)]">
                Elegí las normas en el plan y guardalo: acá aparecen los requisitos de tu empresa para
                esas normas.
              </p>
            ) : (
              <ChecklistBuilder
                slug={slug}
                auditId={audit.id}
                candidates={candidates}
                selectedIds={[
                  ...new Set(
                    checklist.flatMap((i) => (i.tenantRequirementId ? [i.tenantRequirementId] : [])),
                  ),
                ]}
                customItems={checklist
                  .filter((i) => !i.tenantRequirementId)
                  .map((i) => ({ id: i.id, question: i.question }))}
              />
            )}
          </div>
          <div className="flex flex-col gap-3 border-t border-[var(--color-line)] pt-4">
            {audit.status === "planned" ? <PrepareButton slug={slug} auditId={audit.id} /> : null}
            {audit.status === "prepared" && canExecute ? (
              <StartAuditForm
                slug={slug}
                auditId={audit.id}
                early={
                  startReadinessIssues({
                    plannedStart: audit.plannedStart,
                    now: new Date(),
                    reason: null,
                  }).length > 0
                }
              />
            ) : null}
            <CancelAuditForm slug={slug} auditId={audit.id} />
          </div>
        </section>
      ) : (
        <section className="flex flex-col gap-3">
          <h2 className="font-[family-name:var(--font-display)] text-xl">Plan</h2>
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[10rem_1fr]">
            <dt className="font-medium">Objetivo</dt>
            <dd>{audit.objective || "—"}</dd>
            <dt className="font-medium">Alcance</dt>
            <dd>{audit.scope || "—"}</dd>
            <dt className="font-medium">Normas</dt>
            <dd>{audit.standards.map((s) => AUDIT_STANDARD_LABELS[s]).join(", ") || "—"}</dd>
            <dt className="font-medium">Fechas</dt>
            <dd>
              {formatDate(audit.plannedStart)} – {formatDate(audit.plannedEnd)} ·{" "}
              {AUDIT_MODE_LABELS[audit.mode]}
            </dd>
            <dt className="font-medium">Equipo</dt>
            <dd>
              {lead ? `${nameOf(lead.userId)} (líder)` : "—"}
              {auditors.length ? `, ${auditors.map((a) => nameOf(a.userId)).join(", ")}` : ""}
            </dd>
            <dt className="font-medium">Auditados</dt>
            <dd>
              {audit.auditees.length
                ? audit.auditees
                    .map((a) => (a.userId ? `${a.area} (${nameOf(a.userId)})` : a.area))
                    .join(", ")
                : "—"}
            </dd>
            {audit.impartialityException ? (
              <>
                <dt className="font-medium">Excepción de imparcialidad</dt>
                <dd>{audit.impartialityException}</dd>
              </>
            ) : null}
          </dl>
        </section>
      )}

      {!editablePlan && checklist.length > 0 ? (
        <section className="flex flex-col gap-3 border-t border-[var(--color-line)] pt-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-[family-name:var(--font-display)] text-xl">Lista de verificación</h2>
            <p className="text-sm tabular-nums text-[var(--color-ink-muted)]">
              {answered} de {checklist.length} ítems con resultado
            </p>
          </div>
          {audit.status === "in_progress" && canExecute ? (
            <p className="text-sm">
              <span className="font-medium">Qué hacer:</span> para cada ítem elegí el resultado y
              anotá la evidencia (qué viste, qué registros revisaste, a quién entrevistaste).
            </p>
          ) : null}
          <ul className="divide-y divide-[var(--color-line)] rounded-[var(--radius-md)] border border-[var(--color-line)]">
            {runnerItems.map((item) => (
              <ChecklistItemCard
                key={item.id}
                slug={slug}
                auditId={audit.id}
                item={item}
                editable={audit.status === "in_progress" && canExecute}
              />
            ))}
          </ul>
        </section>
      ) : null}

      {audit.status === "prepared" && !canPlan && canExecute ? (
        <StartAuditForm
          slug={slug}
          auditId={audit.id}
          early={
            startReadinessIssues({ plannedStart: audit.plannedStart, now: new Date(), reason: null })
              .length > 0
          }
        />
      ) : null}

      {checklist.some((i) => i.finding) ? (
        <section className="flex flex-col gap-3 border-t border-[var(--color-line)] pt-6">
          <h2 className="font-[family-name:var(--font-display)] text-xl">3 · Hallazgos</h2>
          <p className="text-sm">
            <span className="font-medium">Qué hacer:</span> cada NC, observación u oportunidad de
            mejora ya está creada en Hallazgos como borrador. Completá la causa y las medidas y
            publicala.
          </p>
          <ul className="divide-y divide-[var(--color-line)] rounded-[var(--radius-md)] border border-[var(--color-line)]">
            {checklist.flatMap((i) =>
              i.finding
                ? [
                    <li key={i.finding.id}>
                      <Link
                        href={`/t/${slug}/findings/${i.finding.id}`}
                        className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-[var(--color-surface)]"
                      >
                        <span className="min-w-0">
                          <span className="mr-2 text-xs uppercase tracking-wide text-[var(--color-ink-muted)]">
                            {i.finding.severity
                              ? FINDING_SEVERITY_LABELS[i.finding.severity]
                              : FINDING_TYPE_LABELS[i.finding.type]}
                          </span>
                          <span className="font-medium">{i.finding.title}</span>
                        </span>
                        <span className="rounded-[var(--radius-sm)] bg-[var(--color-surface)] px-2 py-0.5 text-xs font-semibold text-[var(--color-ink-muted)]">
                          {FINDING_STATUS_LABELS[i.finding.status]}
                        </span>
                      </Link>
                    </li>,
                  ]
                : [],
            )}
          </ul>
        </section>
      ) : null}

      {audit.status === "in_progress" && canExecute ? (
        <div className="border-t border-[var(--color-line)] pt-4">
          <TransitionButton
            slug={slug}
            auditId={audit.id}
            to="reporting"
            label="Pasar al informe"
            primaryStyle
          />
        </div>
      ) : null}

      {audit.status === "reporting" || audit.status === "closed" ? (
        <section className="flex flex-col gap-4 border-t border-[var(--color-line)] pt-6">
          <h2 className="font-[family-name:var(--font-display)] text-xl">4 · Informe</h2>
          <div className="grid gap-3 sm:grid-cols-4">
            {(
              [
                ["Conformes", summary.conforming],
                ["No conformidades", summary.nc_major + summary.nc_minor],
                ["Observaciones", summary.observation],
                ["Oportunidades de mejora", summary.improvement],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-4 py-3">
                <div className="text-2xl font-semibold tabular-nums">{value}</div>
                <div className="text-xs text-[var(--color-ink-muted)]">{label}</div>
              </div>
            ))}
          </div>

          {audit.status === "reporting" && canExecute ? (
            <>
              <AuditReportForm
                slug={slug}
                auditId={audit.id}
                objective={audit.objective}
                conclusion={audit.reportConclusion ?? ""}
                strengths={audit.reportStrengths ?? ""}
                includes45001={audit.standards.includes("ISO45001")}
                workersCommunicated={audit.workersCommunicated}
              />
              <div className="flex flex-wrap items-start gap-3 border-t border-[var(--color-line)] pt-4">
                <TransitionButton
                  slug={slug}
                  auditId={audit.id}
                  to="closed"
                  label="Emitir informe y cerrar"
                  primaryStyle
                />
                <TransitionButton
                  slug={slug}
                  auditId={audit.id}
                  to="in_progress"
                  label="Volver a la lista de verificación"
                />
              </div>
            </>
          ) : (
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[10rem_1fr]">
              <dt className="font-medium">Objetivo</dt>
              <dd>{audit.objective}</dd>
              <dt className="font-medium">Conclusión</dt>
              <dd>{audit.reportConclusion ?? "Pendiente"}</dd>
              {audit.reportStrengths ? (
                <>
                  <dt className="font-medium">Fortalezas</dt>
                  <dd>{audit.reportStrengths}</dd>
                </>
              ) : null}
              {audit.impartialityException ? (
                <>
                  <dt className="font-medium">Excepción de imparcialidad</dt>
                  <dd>{audit.impartialityException}</dd>
                </>
              ) : null}
              {audit.standards.includes("ISO45001") ? (
                <>
                  <dt className="font-medium">Comunicado a trabajadores</dt>
                  <dd>{audit.workersCommunicated ? "Sí" : "No registrado"}</dd>
                </>
              ) : null}
              {audit.reportIssuedAt ? (
                <>
                  <dt className="font-medium">Emitido</dt>
                  <dd className="font-[family-name:var(--font-mono)]">{formatDate(audit.reportIssuedAt)}</dd>
                </>
              ) : null}
            </dl>
          )}
        </section>
      ) : null}
    </div>
  );
}
