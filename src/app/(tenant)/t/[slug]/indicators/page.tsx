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
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-[var(--color-ink-muted)]">ISO 9001 · 14001 · 45001 · §6.2 · §9.1</p>
          <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">
            Objetivos e indicadores
          </h1>
          <Link
            href={`/t/${slug}/indicators/guia`}
            className="mt-1 inline-block text-sm font-medium text-[var(--color-accent)] hover:underline"
          >
            Guía de objetivos e indicadores →
          </Link>
        </div>
        {canManage ? (
          <Link
            href={`/t/${slug}/indicators/new`}
            className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white"
          >
            Nuevo objetivo
          </Link>
        ) : null}
      </header>

      {objectives.length === 0 ? (
        <p className="text-sm text-[var(--color-ink-muted)]">
          Todavía no hay objetivos.{" "}
          {canManage
            ? "Creá el primero y agregale los indicadores con los que vas a medirlo."
            : "El administrador de la empresa todavía no los definió."}
        </p>
      ) : (
        <>
          <section aria-label="Resumen" className="grid gap-3 sm:grid-cols-5">
            {metrics.map((m) => (
              <div key={m.label} className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-4 py-3">
                <div className="text-2xl font-semibold tabular-nums">{m.value}</div>
                <span className={`mt-1 inline-block rounded px-2 py-0.5 text-xs font-semibold ${m.tone}`}>
                  {m.label}
                </span>
              </div>
            ))}
          </section>
          <p className="-mt-4 text-xs text-[var(--color-ink-muted)]">
            Objetivos vigentes por estado; las cargas vencidas cuentan indicadores.
          </p>

          {groups.map((g) => (
            <section key={g.standard} className="flex flex-col gap-3" aria-labelledby={`norma-${g.standard}`}>
              <h2 id={`norma-${g.standard}`} className="font-[family-name:var(--font-display)] text-xl">
                {AUDIT_STANDARD_LABELS[g.standard]}
              </h2>
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
                          Responsable: {nameOf(r.objective.ownerUserId)} · Hasta {formatDate(r.objective.dueDate)}
                        </p>
                      </div>
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-semibold ${MEASUREMENT_STATUS_TONE[r.status]}`}
                      >
                        {MEASUREMENT_STATUS_LABELS[r.status]}
                      </span>
                    </div>
                    {r.indicators.length === 0 ? (
                      <p className="text-sm text-[var(--color-ink-muted)]">Sin indicadores todavía.</p>
                    ) : (
                      <ul className="divide-y divide-[var(--color-line)]">
                        {r.indicators.map(({ indicator: i, last, status, trend, load }) => (
                          <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                            <div className="min-w-0">
                              <Link
                                href={`/t/${slug}/indicators/${r.objective.id}/${i.id}`}
                                className="text-sm font-medium hover:underline"
                              >
                                {i.name}
                              </Link>
                              <p className="text-xs tabular-nums text-[var(--color-ink-muted)]">
                                {last ? `${last.value} ${i.unit}` : "—"} · Meta {i.target} {i.unit}
                                {" · Próxima carga: "}
                                {load.period.label}
                                {load.overdue ? (
                                  <span className="ml-1 font-semibold text-[var(--color-danger)]">(vencida)</span>
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
                              <span
                                className={`rounded px-2 py-0.5 text-xs font-semibold ${MEASUREMENT_STATUS_TONE[status]}`}
                              >
                                {MEASUREMENT_STATUS_LABELS[status]}
                              </span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}

          {closed.length > 0 ? (
            <section className="flex flex-col gap-3" aria-labelledby="cerrados">
              <h2 id="cerrados" className="font-[family-name:var(--font-display)] text-xl">
                Cerrados
              </h2>
              <ul className="divide-y divide-[var(--color-line)] rounded-md border border-[var(--color-line)]">
                {closed.map((r) => (
                  <li key={r.objective.id}>
                    <Link
                      href={`/t/${slug}/indicators/${r.objective.id}`}
                      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-[var(--color-surface)]"
                    >
                      <span>
                        <span className="mr-2 font-[family-name:var(--font-mono)] text-xs text-[var(--color-ink-muted)]">
                          {r.objective.code}
                        </span>
                        <span className="font-medium">{r.objective.title}</span>
                      </span>
                      <span className="rounded bg-[var(--color-surface)] px-2 py-0.5 text-xs font-semibold text-[var(--color-ink-muted)]">
                        {OBJECTIVE_STATUS_LABELS[r.objective.status]}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
