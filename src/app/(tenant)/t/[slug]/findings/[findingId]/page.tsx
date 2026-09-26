import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAppSessionContext } from "@/lib/session";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { getMembership } from "@/lib/identity";
import { canTenantRole } from "@/domain/identity/authz";
import { getFinding } from "@/lib/findings";
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
          </p>
        </div>
        <Link
          href={`/t/${slug}/findings`}
          className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-4 py-2 text-sm font-medium"
        >
          Bandeja
        </Link>
      </div>

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
                measure.dueAt.getTime() < Date.now() &&
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
                {canWrite && measure.status !== "closed" ? (
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
      </section>
    </div>
  );
}
