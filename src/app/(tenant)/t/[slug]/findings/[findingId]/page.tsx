import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAppSessionContext } from "@/lib/session";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { getMembership } from "@/lib/identity";
import { canTenantRole } from "@/domain/identity/authz";
import { getFinding } from "@/lib/findings";
import { closeMeasureAction } from "@/app/(tenant)/t/[slug]/findings/actions";
import {
  FINDING_STATUS_LABELS,
  FINDING_TYPE_LABELS,
  MEASURE_KIND_LABELS,
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

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-ink-subtle)]">
            {FINDING_TYPE_LABELS[finding.type as FindingType]} ·{" "}
            {FINDING_STATUS_LABELS[finding.status as FindingStatus]}
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl tracking-tight">
            {finding.title}
          </h1>
          <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
            Detectado {finding.detectedAt.toISOString().slice(0, 10)}
            {finding.source ? ` · ${finding.source}` : ""}
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
        {rca?.steps?.length ? (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium text-[var(--color-accent)]">
              Ver cadena completa
            </summary>
            <ol className="mt-3 space-y-2 border-l border-[var(--color-line)] pl-4">
              {rca.steps.map((step) => (
                <li key={step.order} className="text-sm">
                  <p className="text-[var(--color-ink-subtle)]">
                    {step.order}. {step.question}
                    {step.isRootCause ? " ★" : ""}
                  </p>
                  <p className="text-[var(--color-ink-muted)]">{step.answer}</p>
                </li>
              ))}
            </ol>
          </details>
        ) : null}
      </section>

      <section>
        <h2 className="font-[family-name:var(--font-display)] text-xl">
          Medidas
        </h2>
        <ul className="mt-3 space-y-3">
          {finding.measures.map((measure) => (
            <li
              key={measure.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface-raised)] px-4 py-4"
            >
              <div>
                <p className="font-medium">{measure.title}</p>
                <p className="mt-1 text-xs text-[var(--color-ink-subtle)]">
                  {MEASURE_KIND_LABELS[measure.kind as MeasureKind]} ·{" "}
                  {measure.status}
                  {measure.dueAt
                    ? ` · vence ${measure.dueAt.toISOString().slice(0, 10)}`
                    : ""}
                  {measure.linkedRootCause ? " · ataca causa raíz" : ""}
                </p>
              </div>
              {canWrite && measure.status !== "closed" ? (
                <form
                  action={closeMeasureAction.bind(
                    null,
                    slug,
                    finding.id,
                    measure.id,
                  )}
                >
                  <button
                    type="submit"
                    className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-3 py-1.5 text-xs font-medium"
                  >
                    Cerrar medida
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
