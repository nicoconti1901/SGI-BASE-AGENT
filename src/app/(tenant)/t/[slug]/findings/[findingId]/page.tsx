import Link from "next/link";
import { FINDING_SEVERITY_LABELS } from "@/domain/audits/types";
import { notFound, redirect } from "next/navigation";
import { getAppSessionContext } from "@/lib/session";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { getMembership } from "@/lib/identity";
import { canTenantRole } from "@/domain/identity/authz";
import { getFinding, listTenantMemberOptions } from "@/lib/findings";
import {
  VERIFICATION_RESULT_LABELS,
  canApplyFindingAction,
  needsNewCorrectiveMeasure,
  pendingSteps,
  requiresEffectivenessVerification,
  verifierIsSoleOwner,
} from "@/domain/findings/lifecycle";
import {
  AddMeasureForm,
  ReasonForm,
  RescheduleForm,
  StartMeasureButton,
  VerifyForm,
} from "@/app/(tenant)/t/[slug]/findings/LifecycleForms";
import {
  CloseMeasureWithEvidenceForm,
  FindingDocUploadForm,
} from "@/app/(tenant)/t/[slug]/findings/FindingAttachments";
import {
  AttachmentCard,
  AttachmentEmptyState,
  MeasureCardShell,
} from "@/app/(tenant)/t/[slug]/findings/FindingPresence";
import {
  FINDING_STATUS_LABELS,
  FINDING_STATUS_TONE,
  FINDING_TYPE_LABELS,
  type FindingStatus,
  type FindingType,
  type MeasureKind,
  type RootCauseAnalysis,
} from "@/domain/findings/types";

type Params = Promise<{ slug: string; findingId: string }>;

function isPast(date: Date): boolean {
  return date.getTime() < Date.now();
}

/** Fuera del componente: el render no llama funciones impuras directamente. */
function currentTime(): Date {
  return new Date();
}

function formatDay(d: Date): string {
  return d.toLocaleDateString("es-AR");
}

export default async function FindingDetailPage({
  params,
}: {
  params: Params;
}) {
  const ctx = await getAppSessionContext();
  if (!ctx) redirect("/login");

  const { slug, findingId } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  const membership = await getMembership(ctx.userId, tenant.id);
  if (!membership && !ctx.isPlatformSuperuser) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="font-[family-name:var(--font-display)] text-3xl">
          Sin acceso
        </h1>
      </div>
    );
  }

  const finding = await getFinding(tenant.id, findingId);
  if (!finding) notFound();
  if (finding.status === "draft") {
    redirect(`/t/${slug}/findings/${findingId}/edit`);
  }

  const canWrite = canTenantRole(membership?.role, "write", {
    isPlatformSuperuser: ctx.isPlatformSuperuser,
  });
  const rca = finding.rcaJson as RootCauseAnalysis | null;
  const docs = finding.attachments.filter((a) => a.kind === "finding_doc");
  const findingStatus = finding.status as FindingStatus;
  const statusTone = FINDING_STATUS_TONE[findingStatus];

  // Ciclo de vida (Task 10d)
  const now = currentTime();
  const opts = { isPlatformSuperuser: ctx.isPlatformSuperuser };
  const canVerify = canTenantRole(membership?.role, "verify_findings", opts);
  const canCancel = canTenantRole(membership?.role, "cancel_findings", opts);
  const workable = findingStatus === "published" || findingStatus === "in_progress";
  const members = await listTenantMemberOptions(tenant.id);
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? "Usuario";
  const needsNew = needsNewCorrectiveMeasure({
    reworkSince: finding.reworkSince,
    measures: finding.measures,
  });
  const lifecycleSteps: FindingStatus[] = requiresEffectivenessVerification(finding.type)
    ? ["published", "in_progress", "verification", "closed"]
    : ["published", "in_progress", "closed"];
  const currentStepIndex = lifecycleSteps.indexOf(findingStatus);
  const steps = pendingSteps({
    status: findingStatus,
    type: finding.type,
    reworkSince: finding.reworkSince,
    measures: finding.measures,
    verificationDueAt: finding.verificationDueAt,
    now,
  });

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-[0.2em] text-[var(--color-ink-subtle)]">
              {FINDING_TYPE_LABELS[finding.type as FindingType]}
            </span>
            <span
              className="inline-flex rounded-[var(--radius-sm)] px-2 py-0.5 text-xs font-semibold"
              style={{ background: statusTone.bg, color: statusTone.fg }}
            >
              {FINDING_STATUS_LABELS[findingStatus]}
            </span>
          </div>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl tracking-tight">
            {finding.title}
          </h1>
          <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
            Detectado {finding.detectedAt.toISOString().slice(0, 10)}
            {finding.source ? ` · ${finding.source}` : ""}
            {finding.location ? ` · ${finding.location}` : ""}
            {finding.severity && FINDING_SEVERITY_LABELS[finding.severity]
              ? ` · ${FINDING_SEVERITY_LABELS[finding.severity]}`
              : ""}
          </p>
          {finding.audit ? (
            <p className="mt-1 text-sm">
              Origen:{" "}
              <Link
                href={`/t/${slug}/audits/${finding.audit.id}`}
                className="text-[var(--color-accent)] underline-offset-2 hover:underline"
              >
                auditoría interna {finding.audit.code} · {finding.audit.title}
              </Link>
            </p>
          ) : null}
        </div>
        <Link
          href={`/t/${slug}/findings`}
          className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-4 py-2 text-sm font-medium"
        >
          Bandeja
        </Link>
      </div>

      {findingStatus === "cancelled" ? (
        <p className="rounded-[var(--radius-md)] border border-[var(--color-danger)]/40 bg-[var(--color-danger-soft)] px-4 py-3 text-sm text-[var(--color-danger)]">
          Anulado
          {finding.cancelledAt ? ` el ${formatDay(finding.cancelledAt)}` : ""}
          {finding.cancelReason ? `: ${finding.cancelReason}` : ""}
        </p>
      ) : (
        <section aria-label="Estado del hallazgo" className="flex flex-col gap-3">
          <ol className="grid gap-2" style={{ gridTemplateColumns: `repeat(${lifecycleSteps.length}, minmax(0, 1fr))` }}>
            {lifecycleSteps.map((s, i) => (
              <li
                key={s}
                aria-current={i === currentStepIndex ? "step" : undefined}
                className={`rounded-[var(--radius-md)] border px-3 py-2 text-sm ${
                  i === currentStepIndex
                    ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)] font-semibold text-[var(--color-accent-ink)]"
                    : i < currentStepIndex
                      ? "border-[var(--color-line)] text-[var(--color-success)]"
                      : "border-[var(--color-line)] text-[var(--color-ink-subtle)]"
                }`}
              >
                {FINDING_STATUS_LABELS[s]}
              </li>
            ))}
          </ol>
          {steps.length > 0 ? (
            <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3 text-sm">
              <p className="font-medium">Qué falta</p>
              <ul className="mt-1 list-disc pl-5 text-[var(--color-ink-muted)]">
                {steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      )}

      {findingStatus === "verification" ? (
        <section className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--color-accent)] bg-[var(--color-surface-raised)] p-5">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-xl">Verificación de eficacia</h2>
            <p className="text-sm text-[var(--color-ink-muted)]">
              ISO §10.2.1 d) · Programada para el{" "}
              <span className="font-[family-name:var(--font-mono)]">
                {finding.verificationDueAt ? formatDay(finding.verificationDueAt) : "—"}
              </span>
            </p>
          </div>
          {canVerify ? (
            <>
              <VerifyForm
                slug={slug}
                findingId={finding.id}
                soleOwner={verifierIsSoleOwner(
                  ctx.userId,
                  finding.measures.map((m) => m.ownerUserId),
                )}
                early={Boolean(finding.verificationDueAt && now < finding.verificationDueAt)}
                dueLabel={finding.verificationDueAt ? formatDay(finding.verificationDueAt) : null}
              />
              {finding.verificationDueAt ? (
                <RescheduleForm
                  slug={slug}
                  findingId={finding.id}
                  current={finding.verificationDueAt.toISOString().slice(0, 10)}
                />
              ) : null}
            </>
          ) : (
            <p className="text-sm text-[var(--color-ink-muted)]">
              La verifica el administrador o un responsable de proceso.
            </p>
          )}
        </section>
      ) : null}

      <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface-raised)] p-5">
        <h2 className="text-xs uppercase tracking-wide text-[var(--color-ink-subtle)]">
          Hecho
        </h2>
        <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
          {finding.description}
        </p>
      </section>

      <section className="rounded-[var(--radius-lg)] border border-[var(--color-accent)] bg-[var(--color-accent-soft)] p-5">
        <h2 className="text-xs uppercase tracking-wide text-[var(--color-ink-subtle)]">
          Causa raíz (5 Porqués)
        </h2>
        <p className="mt-2 font-[family-name:var(--font-display)] text-xl text-[var(--color-ink)]">
          ★ {finding.rootCause ?? "Sin causa raíz"}
        </p>
        {rca?.problemStatement ? (
          <p className="mt-3 text-sm text-[var(--color-ink-muted)]">
            <span className="text-xs uppercase tracking-wide text-[var(--color-ink-subtle)]">
              Hecho de partida ·{" "}
            </span>
            {rca.problemStatement}
          </p>
        ) : null}
        {rca?.steps?.length ? (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium text-[var(--color-accent)]">
              Ver árbol / cadenas
            </summary>
            <div className="mt-3 space-y-4">
              {[
                ...new Map(
                  rca.steps.map((s) => [
                    s.branchId ?? "main",
                    s.branchLabel ?? "Cadena principal",
                  ]),
                ).entries(),
              ].map(([branchId, branchLabel]) => (
                <div key={branchId}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-subtle)]">
                    {branchLabel}
                  </p>
                  <ol className="mt-2 space-y-2 border-l border-[var(--color-line)] pl-4">
                    {rca.steps
                      .filter((s) => (s.branchId ?? "main") === branchId)
                      .sort((a, b) => a.order - b.order)
                      .map((step) => (
                        <li
                          key={step.id ?? `${branchId}-${step.order}`}
                          className="text-sm"
                        >
                          <p className="text-[var(--color-ink-subtle)]">
                            {step.order}. {step.question}
                            {step.isRootCause ? " ★" : ""}
                          </p>
                          <p className="text-[var(--color-ink-muted)]">
                            {step.answer}
                          </p>
                        </li>
                      ))}
                  </ol>
                </div>
              ))}
            </div>
          </details>
        ) : null}
      </section>

      <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface-raised)] p-5 shadow-[var(--shadow-soft)]">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-xl">
              Documentación del hallazgo
            </h2>
            <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
              Fotos, registros y archivos operativos del hecho.
            </p>
          </div>
          <span className="rounded-[var(--radius-sm)] bg-[var(--color-surface)] px-2.5 py-1 text-xs font-semibold text-[var(--color-ink-muted)]">
            {docs.length} archivo{docs.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {docs.map((a) => (
            <AttachmentCard key={a.id} attachment={a} />
          ))}
        </div>
        {docs.length === 0 ? (
          <div className="mt-4">
            <AttachmentEmptyState message="Todavía no hay documentación adjunta." />
          </div>
        ) : null}
        {canWrite ? (
          <div className="mt-5 border-t border-[var(--color-line)] pt-4">
            <FindingDocUploadForm slug={slug} findingId={finding.id} />
          </div>
        ) : null}
      </section>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="font-[family-name:var(--font-display)] text-xl">
            Medidas
          </h2>
          <span className="text-sm text-[var(--color-ink-muted)]">
            {finding.measures.filter((m) => m.status === "closed").length}/
            {finding.measures.length} cerradas
          </span>
        </div>
        <ul className="mt-3 space-y-4">
          {finding.measures.map((measure) => {
            const overdue = Boolean(
              measure.dueAt &&
                isPast(measure.dueAt) &&
                measure.status !== "closed",
            );
            return (
              <MeasureCardShell
                key={measure.id}
                status={measure.status}
                kind={measure.kind as MeasureKind}
                title={measure.title}
                dueAt={measure.dueAt}
                linkedRootCause={measure.linkedRootCause}
                overdue={overdue}
              >
                {measure.evidence.length > 0 ? (
                  <div className="border-t border-[var(--color-line)] px-4 py-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-subtle)]">
                      Evidencia de cierre
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {measure.evidence.map((ev) => (
                        <AttachmentCard
                          key={ev.id}
                          attachment={ev}
                          tone="evidence"
                        />
                      ))}
                    </div>
                  </div>
                ) : measure.status === "closed" ? null : (
                  <div className="border-t border-[var(--color-line)] px-4 py-2">
                    <p className="text-xs text-[var(--color-warning)]">
                      Sin evidencia aún — requerida para cerrar.
                    </p>
                  </div>
                )}
                {workable &&
                measure.status === "open" &&
                (canWrite || measure.ownerUserId === ctx.userId) ? (
                  <StartMeasureButton slug={slug} findingId={finding.id} measureId={measure.id} />
                ) : null}
                {workable && canWrite && measure.status !== "closed" ? (
                  <CloseMeasureWithEvidenceForm
                    slug={slug}
                    findingId={finding.id}
                    measureId={measure.id}
                  />
                ) : null}
              </MeasureCardShell>
            );
          })}
        </ul>
        {workable && canWrite ? (
          <div className="mt-4">
            <AddMeasureForm
              slug={slug}
              findingId={finding.id}
              members={members.map((m) => ({ id: m.id, name: m.name }))}
              highlight={needsNew}
            />
          </div>
        ) : null}
      </section>

      {findingStatus === "closed" ? (
        <p className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3 text-sm">
          <span className="font-medium">¿Cambia algún riesgo?</span> ISO §10.2.1 e) pide actualizar
          riesgos y oportunidades si hace falta.{" "}
          <Link href={`/t/${slug}/risks/explore`} className="text-[var(--color-accent)] hover:underline">
            Explorar riesgos desde este hallazgo →
          </Link>
        </p>
      ) : null}

      {finding.verifications.length > 0 ? (
        <section className="flex flex-col gap-3 border-t border-[var(--color-line)] pt-6">
          <h2 className="font-[family-name:var(--font-display)] text-xl">Verificaciones de eficacia</h2>
          <ul className="divide-y divide-[var(--color-line)] rounded-[var(--radius-md)] border border-[var(--color-line)]">
            {finding.verifications.map((v) => (
              <li key={v.id} className="flex flex-col gap-1 px-4 py-3 text-sm">
                <p>
                  <span
                    className={`mr-2 rounded-[var(--radius-sm)] px-2 py-0.5 text-xs font-semibold ${
                      v.result === "effective"
                        ? "bg-[var(--color-success-soft)] text-[var(--color-success)]"
                        : "bg-[var(--color-danger-soft)] text-[var(--color-danger)]"
                    }`}
                  >
                    {VERIFICATION_RESULT_LABELS[v.result]}
                  </span>
                  <span className="font-[family-name:var(--font-mono)] text-xs text-[var(--color-ink-muted)]">
                    {formatDay(v.verifiedAt)}
                  </span>{" "}
                  · {nameOf(v.verifiedByUserId)}
                </p>
                <p>{v.evidence}</p>
                {v.independenceException ? (
                  <p className="text-xs text-[var(--color-ink-muted)]">
                    Excepción de independencia: {v.independenceException}
                  </p>
                ) : null}
                {v.earlyReason ? (
                  <p className="text-xs text-[var(--color-ink-muted)]">Verificada antes de lo programado: {v.earlyReason}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="flex flex-col gap-3 border-t border-[var(--color-line)] pt-6">
        <details>
          <summary className="cursor-pointer font-[family-name:var(--font-display)] text-xl">
            Historial ({finding.statusEvents.length})
          </summary>
          <ol className="mt-3 flex flex-col gap-2 text-sm">
            {finding.statusEvents.map((e) => (
              <li key={e.id} className="border-l-2 border-[var(--color-line)] pl-3">
                <p>
                  <span className="font-[family-name:var(--font-mono)] text-xs text-[var(--color-ink-muted)]">
                    {formatDay(e.createdAt)}
                  </span>{" "}
                  {e.fromStatus ? `${FINDING_STATUS_LABELS[e.fromStatus]} → ` : ""}
                  <span className="font-medium">{FINDING_STATUS_LABELS[e.toStatus]}</span> ·{" "}
                  {e.actorUserId ? nameOf(e.actorUserId) : "Automático"}
                </p>
                {e.reason ? <p className="text-[var(--color-ink-muted)]">{e.reason}</p> : null}
              </li>
            ))}
            {finding.statusEvents.length === 0 ? (
              <li className="text-[var(--color-ink-muted)]">
                Sin cambios registrados (el historial empezó a guardarse con el ciclo de vida).
              </li>
            ) : null}
          </ol>
        </details>
        {canCancel && canApplyFindingAction("cancel", findingStatus) ? (
          <ReasonForm slug={slug} findingId={finding.id} kind="cancel" />
        ) : null}
        {canCancel && canApplyFindingAction("reopen", findingStatus) ? (
          <ReasonForm slug={slug} findingId={finding.id} kind="reopen" />
        ) : null}
      </section>
    </div>
  );
}
