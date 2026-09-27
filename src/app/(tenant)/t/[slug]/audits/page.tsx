import Link from "next/link";
import { getProgramWithAudits } from "@/lib/audits";
import { listTenantMemberOptions } from "@/lib/findings";
import {
  AUDIT_PROGRAM_STATUS_LABELS,
  AUDIT_STANDARD_LABELS,
  AUDIT_STATUS_LABELS,
  type AuditStatus,
} from "@/domain/audits/types";
import { ProgramForm } from "@/app/(tenant)/t/[slug]/audits/AuditForms";
import { formatDate, loadAuditsAccess } from "@/app/(tenant)/t/[slug]/audits/access";

const STATUS_TONE: Record<AuditStatus, string> = {
  planned: "bg-[var(--color-surface)] text-[var(--color-ink-muted)]",
  prepared: "bg-[var(--color-accent-soft)] text-[var(--color-accent)]",
  in_progress: "bg-[var(--color-warning-soft)] text-[var(--color-warning)]",
  reporting: "bg-[var(--color-warning-soft)] text-[var(--color-warning)]",
  closed: "bg-[var(--color-success-soft)] text-[var(--color-success)]",
  cancelled: "bg-[var(--color-surface)] text-[var(--color-ink-subtle)] line-through",
};

export default async function AuditsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ anio?: string }>;
}) {
  const { slug } = await params;
  const { anio } = await searchParams;
  const year = Number(anio) || new Date().getFullYear();
  const { tenant, canPlan, canApprove } = await loadAuditsAccess(slug);

  const [{ program, audits }, members] = await Promise.all([
    getProgramWithAudits(tenant.id, year),
    listTenantMemberOptions(tenant.id),
  ]);
  const nameOf = (id?: string) => members.find((m) => m.id === id)?.name ?? "Sin asignar";
  const status = program?.status ?? "draft";

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-[var(--color-ink-muted)]">ISO 9001 · 14001 · 45001 · §9.2</p>
          <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">
            Auditorías internas
          </h1>
        </div>
        <nav aria-label="Año" className="flex items-center gap-3 text-sm">
          <Link href={`/t/${slug}/audits?anio=${year - 1}`} className="text-[var(--color-accent)]">
            ← {year - 1}
          </Link>
          <span className="font-semibold">{year}</span>
          <Link href={`/t/${slug}/audits?anio=${year + 1}`} className="text-[var(--color-accent)]">
            {year + 1} →
          </Link>
        </nav>
      </header>

      <section className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface-raised)] p-5">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-[family-name:var(--font-display)] text-xl">Programa {year}</h2>
          <span
            className={`rounded px-2 py-0.5 text-xs font-semibold ${
              status === "approved"
                ? "bg-[var(--color-success-soft)] text-[var(--color-success)]"
                : "bg-[var(--color-warning-soft)] text-[var(--color-warning)]"
            }`}
          >
            {AUDIT_PROGRAM_STATUS_LABELS[status]}
          </span>
          {program?.approvedAt ? (
            <span className="text-xs text-[var(--color-ink-muted)]">
              aprobado el {formatDate(program.approvedAt)}
            </span>
          ) : null}
        </div>
        {canApprove ? (
          <>
            {status === "approved" ? (
              <p className="text-xs text-[var(--color-ink-muted)]">
                Si lo modificás, vuelve a borrador y hay que aprobarlo de nuevo.
              </p>
            ) : null}
            <ProgramForm
              slug={slug}
              year={year}
              objectives={program?.objectives ?? ""}
              frequencyRationale={program?.frequencyRationale ?? ""}
              canApprove={status !== "approved"}
            />
          </>
        ) : program?.objectives ? (
          <dl className="text-sm">
            <dt className="font-medium">Objetivos</dt>
            <dd className="text-[var(--color-ink-muted)]">{program.objectives}</dd>
            {program.frequencyRationale ? (
              <>
                <dt className="mt-2 font-medium">Criterio de frecuencia</dt>
                <dd className="text-[var(--color-ink-muted)]">{program.frequencyRationale}</dd>
              </>
            ) : null}
          </dl>
        ) : (
          <p className="text-sm text-[var(--color-ink-muted)]">
            El administrador de la empresa todavía no definió el programa de este año.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-[family-name:var(--font-display)] text-xl">Auditorías del año</h2>
          {canPlan ? (
            <Link
              href={`/t/${slug}/audits/new`}
              className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white"
            >
              Planificar auditoría
            </Link>
          ) : null}
        </div>
        {audits.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-muted)]">
            No hay auditorías planificadas para {year}.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--color-line)] rounded-md border border-[var(--color-line)]">
            {audits.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/t/${slug}/audits/${a.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-[var(--color-surface)]"
                >
                  <div className="min-w-0">
                    <p>
                      <span className="mr-2 font-[family-name:var(--font-mono)] text-xs text-[var(--color-ink-muted)]">
                        {a.code}
                      </span>
                      <span className="font-medium">{a.title}</span>
                    </p>
                    <p className="text-xs text-[var(--color-ink-muted)]">
                      {formatDate(a.plannedStart)}
                      {a.plannedEnd.getTime() !== a.plannedStart.getTime()
                        ? ` – ${formatDate(a.plannedEnd)}`
                        : ""}
                      {" · "}
                      {a.standards.length
                        ? a.standards.map((s) => AUDIT_STANDARD_LABELS[s]).join(", ")
                        : "Sin normas"}
                      {" · Líder: "}
                      {nameOf(a.team[0]?.userId)}
                      {a._count.findings ? ` · ${a._count.findings} hallazgos` : ""}
                    </p>
                  </div>
                  <span className={`rounded px-2 py-0.5 text-xs font-semibold ${STATUS_TONE[a.status]}`}>
                    {AUDIT_STATUS_LABELS[a.status]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
