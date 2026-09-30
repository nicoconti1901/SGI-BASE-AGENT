import Link from "next/link";
import { listObjectives } from "@/lib/objectives";
import { listTenantMemberOptions } from "@/lib/findings";
import { aggregateStatus, dashboardCounts, pendingLoad } from "@/domain/indicators/rules";
import {
  MEASUREMENT_STATUS_LABELS,
  MEASUREMENT_STATUS_TONE,
  OBJECTIVE_STATUS_LABELS,
  type MeasurementStatus,
} from "@/domain/indicators/types";
import { AUDIT_STANDARD_LABELS, type AuditStandard } from "@/domain/audits/types";
import { Sparkline } from "@/app/(tenant)/t/[slug]/indicators/Sparkline";
import { formatDate, loadIndicatorsAccess } from "@/app/(tenant)/t/[slug]/indicators/access";
import {
  PageFrame,
  PageHeader,
  StatTile,
  StatusChip,
  EmptyState,
  SectionBlock,
  EntityList,
  EntityRow,
} from "@/components/ui";

const STANDARD_ORDER: AuditStandard[] = ["ISO9001", "ISO14001", "ISO45001"];

export default async function IndicatorsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { tenant, canManage } = await loadIndicatorsAccess(slug);
  const [objectives, members] = await Promise.all([
    listObjectives(tenant.id),
    listTenantMemberOptions(tenant.id),
  ]);
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? "Sin asignar";
  const now = new Date();

  const rows = objectives.map((o) => {
    const indicators = o.indicators.map((i) => {
      const last = i.measurements[0] ?? null;
      const load = pendingLoad({
        frequency: i.frequency,
        lastLoadedStart: last?.periodStart ?? null,
        createdAt: i.createdAt,
        now,
      });
      return {
        indicator: i,
        last,
        status: (last ? last.status : "no_data") as MeasurementStatus,
        trend: [...i.measurements].reverse().map((m) => m.value),
        load,
      };
    });
    const status = aggregateStatus(indicators.map((i) => i.status));
    return { objective: o, indicators, status, overdue: indicators.filter((i) => i.load.overdue).length };
  });

  const counts = dashboardCounts(
    rows.map((r) => ({
      status: r.objective.status,
      indicatorStatuses: r.indicators.map((i) => i.status),
      overdueLoads: r.overdue,
    })),
  );
  const active = rows.filter((r) => r.objective.status === "active");
  const closed = rows.filter((r) => r.objective.status !== "active");
  const groups = STANDARD_ORDER.map((standard) => ({
    standard,
    rows: active.filter((r) => r.objective.standards.includes(standard)),
  })).filter((g) => g.rows.length > 0);

  const metrics: { label: string; value: number; tone: string }[] = [
    { label: "En meta", value: counts.on_target, tone: MEASUREMENT_STATUS_TONE.on_target },
    { label: "En alerta", value: counts.alert, tone: MEASUREMENT_STATUS_TONE.alert },
    { label: "Fuera de meta", value: counts.off_target, tone: MEASUREMENT_STATUS_TONE.off_target },
    { label: "Sin datos", value: counts.no_data, tone: MEASUREMENT_STATUS_TONE.no_data },
    {
      label: "Cargas vencidas",
      value: counts.overdueLoads,
      tone: counts.overdueLoads > 0 ? MEASUREMENT_STATUS_TONE.off_target : MEASUREMENT_STATUS_TONE.no_data,
    },
  ];

  return (
    <PageFrame>
      <PageHeader
        eyebrow="ISO 9001 · 14001 · 45001 · §6.2 · §9.1"
        title="Objetivos e indicadores"
        guideHref={`/t/${slug}/indicators/guia`}
        guideLabel="Guía de objetivos e indicadores →"
        actions={
          canManage ? (
            <Link
              href={`/t/${slug}/indicators/new`}
              className="rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-on-solid)]"
            >
              Nuevo objetivo
            </Link>
          ) : undefined
        }
      />

      {objectives.length === 0 ? (
        <EmptyState
          what="Todavía no hay objetivos."
          next={
            canManage
              ? "Creá el primero y agregale los indicadores con los que vas a medirlo."
              : "Pedile al administrador de la empresa que los defina."
          }
          action={
            canManage
              ? { href: `/t/${slug}/indicators/new`, label: "Nuevo objetivo" }
              : undefined
          }
        />
      ) : (
        <>
          {/* StatGrid solo llega a 4 cols; el resumen de indicadores son 5 métricas. */}
          <section aria-label="Resumen" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {metrics.map((m) => (
              <StatTile
                key={m.label}
                label={m.label}
                value={m.value}
                chip={<StatusChip label={m.label} className={m.tone} />}
              />
            ))}
          </section>
          <p className="-mt-4 text-xs text-[var(--color-ink-muted)]">
            Objetivos vigentes por estado; las cargas vencidas cuentan indicadores.
          </p>

          {groups.map((g) => (
            <SectionBlock
              key={g.standard}
              id={`norma-${g.standard}`}
              title={AUDIT_STANDARD_LABELS[g.standard]}
            >
              <ul className="flex flex-col gap-4">
                {g.rows.map((r) => (
                  <li
                    key={r.objective.id}
                    className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--color-line)] p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p>
                          <span className="mr-2 font-[family-name:var(--font-mono)] text-xs text-[var(--color-ink-muted)]">
                            {r.objective.code}
                          </span>
                          <Link
                            href={`/t/${slug}/indicators/${r.objective.id}`}
                            className="font-medium hover:underline"
                          >
                            {r.objective.title}
                          </Link>
                        </p>
                        <p className="text-xs text-[var(--color-ink-muted)]">
                          Responsable: {nameOf(r.objective.ownerUserId)} · Hasta{" "}
                          {formatDate(r.objective.dueDate)}
                        </p>
                      </div>
                      <StatusChip
                        label={MEASUREMENT_STATUS_LABELS[r.status]}
                        className={MEASUREMENT_STATUS_TONE[r.status]}
                      />
                    </div>
                    {r.indicators.length === 0 ? (
                      <EmptyState what="Sin indicadores todavía." />
                    ) : (
                      <ul className="divide-y divide-[var(--color-line)]">
                        {r.indicators.map(({ indicator: i, last, status, trend, load }) => (
                          <li
                            key={i.id}
                            className="flex flex-wrap items-center justify-between gap-3 py-2"
                          >
                            <div className="min-w-0">
                              <Link
                                href={`/t/${slug}/indicators/${r.objective.id}/${i.id}`}
                                className="text-sm font-medium hover:underline"
                              >
                                {i.name}
                              </Link>
                              <p className="text-xs tabular-nums text-[var(--color-ink-muted)]">
                                {last ? `${last.value} ${i.unit}` : "—"} · Meta {i.target}{" "}
                                {i.unit}
                                {" · Próxima carga: "}
                                {load.period.label}
                                {load.overdue ? (
                                  <span className="ml-1 font-semibold text-[var(--color-danger)]">
                                    (vencida)
                                  </span>
                                ) : (
                                  ` (hasta ${formatDate(load.dueAt)})`
                                )}
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <Sparkline
                                values={trend}
                                target={i.target}
                                label={`Últimos ${trend.length} períodos de ${i.name}`}
                              />
                              <StatusChip
                                label={MEASUREMENT_STATUS_LABELS[status]}
                                className={MEASUREMENT_STATUS_TONE[status]}
                              />
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </SectionBlock>
          ))}

          {closed.length > 0 ? (
            <SectionBlock id="cerrados" title="Cerrados">
              <EntityList aria-label="Objetivos cerrados">
                {closed.map((r) => (
                  <EntityRow
                    key={r.objective.id}
                    href={`/t/${slug}/indicators/${r.objective.id}`}
                    kind={r.objective.code}
                    title={r.objective.title}
                    chip={
                      <StatusChip
                        label={OBJECTIVE_STATUS_LABELS[r.objective.status]}
                        className="bg-[var(--color-surface)] text-[var(--color-ink-muted)]"
                      />
                    }
                  />
                ))}
              </EntityList>
            </SectionBlock>
          ) : null}
        </>
      )}
    </PageFrame>
  );
}
