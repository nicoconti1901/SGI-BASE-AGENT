import Link from "next/link";
import { getProgramCoverage, getProgramWithAudits, listExternalAudits } from "@/lib/audits";
import { listTenantMemberOptions } from "@/lib/findings";
import {
  AUDIT_PROGRAM_STATUS_LABELS,
  AUDIT_STANDARD_LABELS,
  AUDIT_STATUS_LABELS,
  type AuditStatus,
} from "@/domain/audits/types";
import { ProgramForm } from "@/app/(tenant)/t/[slug]/audits/AuditForms";
import { formatDate, loadAuditsAccess } from "@/app/(tenant)/t/[slug]/audits/access";
import {
  PageFrame,
  PageHeader,
  StatGrid,
  StatTile,
  StatusChip,
  EmptyState,
  SectionBlock,
  EntityList,
  EntityRow,
} from "@/components/ui";

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
  searchParams: Promise<{ anio?: string; programa?: string }>;
}) {
  const { slug } = await params;
  const { anio, programa } = await searchParams;
  const year = Number(anio) || new Date().getFullYear();
  const { tenant, canPlan, canApprove } = await loadAuditsAccess(slug);

  const [{ program, audits }, members, coverage, externalAudits] = await Promise.all([
    getProgramWithAudits(tenant.id, year),
    listTenantMemberOptions(tenant.id),
    getProgramCoverage(tenant.id, year),
    listExternalAudits(tenant.id, year),
  ]);
  const nameOf = (id?: string) => members.find((m) => m.id === id)?.name ?? "Sin asignar";
  const status = program?.status ?? "draft";
  const programApproved = status === "approved";
  const showProgram = programa === "1";

  return (
    <PageFrame>
      <PageHeader
        eyebrow="ISO 9001 · 14001 · 45001 · §9.2"
        title="Auditorías internas"
        guideHref={`/t/${slug}/audits/guia`}
        guideLabel="Guía de auditoría interna →"
        actions={
          <nav aria-label="Año" className="flex items-center gap-3 text-sm">
            <Link href={`/t/${slug}/audits?anio=${year - 1}`} className="text-[var(--color-accent)]">
              ← {year - 1}
            </Link>
            <span className="font-semibold">{year}</span>
            <Link href={`/t/${slug}/audits?anio=${year + 1}`} className="text-[var(--color-accent)]">
              {year + 1} →
            </Link>
          </nav>
        }
      />

      <section
        aria-label={`Programa ${year}`}
        className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface-raised)] px-5 py-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-[family-name:var(--font-display)] text-lg">Programa {year}</h2>
            <StatusChip
              label={AUDIT_PROGRAM_STATUS_LABELS[status]}
              className={
                programApproved
                  ? "bg-[var(--color-success-soft)] text-[var(--color-success)]"
                  : "bg-[var(--color-warning-soft)] text-[var(--color-warning)]"
              }
            />
            {program?.approvedAt ? (
              <span className="text-xs text-[var(--color-ink-muted)]">
                aprobado el {formatDate(program.approvedAt)}
              </span>
            ) : null}
          </div>
          <Link
            href={
              showProgram
                ? `/t/${slug}/audits?anio=${year}`
                : `/t/${slug}/audits?anio=${year}&programa=1`
            }
            className="text-sm font-medium text-[var(--color-accent)] hover:underline"
          >
            {showProgram ? "Ocultar programa" : canApprove ? "Gestionar programa" : "Ver programa"}
          </Link>
        </div>
        {showProgram ? (
          canApprove ? (
            <>
              {programApproved ? (
                <p className="text-xs text-[var(--color-ink-muted)]">
                  Si lo modificás, vuelve a borrador y hay que aprobarlo de nuevo.
                </p>
              ) : null}
              <ProgramForm
                slug={slug}
                year={year}
                objectives={program?.objectives ?? ""}
                frequencyRationale={program?.frequencyRationale ?? ""}
                canApprove={!programApproved}
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
            <EmptyState what="El administrador de la empresa todavía no definió el programa de este año." />
          )
        ) : null}
      </section>

      {coverage.length > 0 ? (
        <SectionBlock
          id="cobertura"
          title={`Cobertura ${year}`}
          what="Requisitos de la empresa revisados en auditorías internas cerradas del año. El programa debería cubrir el sistema completo en su ciclo."
        >
          <StatGrid cols={3} aria-label={`Cobertura ${year}`}>
            {coverage.map((row) => {
              const pct = row.total ? Math.round((row.covered / row.total) * 100) : 0;
              return (
                <StatTile
                  key={row.standard}
                  label={`${AUDIT_STANDARD_LABELS[row.standard]} · ${row.covered} de ${row.total} requisitos`}
                  value={`${pct}%`}
                />
              );
            })}
          </StatGrid>
        </SectionBlock>
      ) : null}

      <SectionBlock title="Auditorías planificadas">
        {canPlan ? (
          <p>
            <Link
              href={`/t/${slug}/audits/new`}
              className="inline-block rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-on-solid)]"
            >
              Planificar auditoría
            </Link>
          </p>
        ) : null}
        {audits.length === 0 ? (
          <EmptyState what={`No hay auditorías planificadas para ${year}.`} />
        ) : (
          <EntityList aria-label="Auditorías planificadas">
            {audits.map((a) => {
              const dateRange =
                formatDate(a.plannedStart) +
                (a.plannedEnd.getTime() !== a.plannedStart.getTime()
                  ? ` – ${formatDate(a.plannedEnd)}`
                  : "");
              const standards = a.standards.length
                ? a.standards.map((s) => AUDIT_STANDARD_LABELS[s]).join(", ")
                : "Sin normas";
              const meta = [
                dateRange,
                standards,
                `Líder: ${nameOf(a.team[0]?.userId)}`,
                a._count.findings ? `${a._count.findings} hallazgos` : null,
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <EntityRow
                  key={a.id}
                  href={`/t/${slug}/audits/${a.id}`}
                  kind={a.code}
                  title={a.title}
                  meta={meta}
                  chip={
                    <StatusChip
                      label={AUDIT_STATUS_LABELS[a.status]}
                      className={STATUS_TONE[a.status]}
                    />
                  }
                />
              );
            })}
          </EntityList>
        )}
      </SectionBlock>

      <SectionBlock
        id="externas"
        title="Auditorías externas"
        what="Certificadoras, clientes o autoridades. No forman parte del programa ni de la cobertura; sus hallazgos se gestionan en Hallazgos."
      >
        {canPlan ? (
          <p>
            <Link
              href={`/t/${slug}/audits/externas/new`}
              className="inline-block rounded-[var(--radius-md)] border border-[var(--color-line)] px-4 py-2 text-sm font-medium"
            >
              Planificar auditoría externa
            </Link>
          </p>
        ) : null}
        {externalAudits.length === 0 ? (
          <EmptyState what={`No hay auditorías externas planificadas para ${year}.`} />
        ) : (
          <EntityList aria-label="Auditorías externas">
            {externalAudits.map((a) => {
              const dateRange =
                formatDate(a.plannedStart) +
                (a.plannedEnd.getTime() !== a.plannedStart.getTime()
                  ? ` – ${formatDate(a.plannedEnd)}`
                  : "");
              const meta = [
                a.externalBody,
                dateRange,
                a.standards.length
                  ? a.standards.map((s) => AUDIT_STANDARD_LABELS[s]).join(", ")
                  : null,
                a._count.findings ? `${a._count.findings} hallazgos` : null,
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <EntityRow
                  key={a.id}
                  href={`/t/${slug}/audits/${a.id}`}
                  kind={a.code}
                  title={a.title}
                  meta={meta}
                  chip={
                    <StatusChip
                      label={
                        a.status === "closed" ? "Realizada" : AUDIT_STATUS_LABELS[a.status]
                      }
                      className={STATUS_TONE[a.status]}
                    />
                  }
                />
              );
            })}
          </EntityList>
        )}
      </SectionBlock>
    </PageFrame>
  );
}
