import Link from "next/link";
import { notFound } from "next/navigation";
import { getIndicatorDetail, canLoadIndicator } from "@/lib/measurements";
import { listTenantMemberOptions } from "@/lib/findings";
import { periodOf } from "@/domain/indicators/rules";
import {
  DIRECTION_LABELS,
  FREQUENCY_LABELS,
  KIND_LABELS,
  MEASUREMENT_STATUS_LABELS,
  MEASUREMENT_STATUS_TONE,
} from "@/domain/indicators/types";
import {
  CorrectMeasurementForm,
  CreateFindingButton,
  RecordMeasurementForm,
} from "@/app/(tenant)/t/[slug]/indicators/MeasurementForms";
import { TrendChart } from "@/app/(tenant)/t/[slug]/indicators/TrendChart";
import { formatDate, loadIndicatorsAccess } from "@/app/(tenant)/t/[slug]/indicators/access";

export default async function IndicatorPage({
  params,
}: {
  params: Promise<{ slug: string; objectiveId: string; indicatorId: string }>;
}) {
  const { slug, objectiveId, indicatorId } = await params;
  const { ctx, tenant, canManage } = await loadIndicatorsAccess(slug);
  const [detail, members] = await Promise.all([
    getIndicatorDetail(tenant.id, indicatorId),
    listTenantMemberOptions(tenant.id),
  ]);
  if (!detail || detail.indicator.objectiveId !== objectiveId) notFound();

  const { indicator, pendingPeriod } = detail;
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? "Sin asignar";
  const open = indicator.objective.status === "active" && indicator.active;
  const canLoad =
    open && canLoadIndicator({ userId: ctx.userId, ownerUserId: indicator.ownerUserId, canManage });
  const ascending = [...indicator.measurements].reverse().slice(-12);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-8">
      <header>
        <Link href={`/t/${slug}/indicators/${objectiveId}`} className="text-sm text-[var(--color-accent)]">
          ← {indicator.objective.code} · {indicator.objective.title}
        </Link>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl tracking-tight">{indicator.name}</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          {DIRECTION_LABELS[indicator.direction]} · Meta {indicator.target} {indicator.unit}
          {indicator.alertThreshold !== null ? ` · Alerta ${indicator.alertThreshold}` : ""}
          {" · "}
          {FREQUENCY_LABELS[indicator.frequency]} · {KIND_LABELS[indicator.kind]}
          {" · Carga: "}
          {nameOf(indicator.ownerUserId)}
        </p>
        {indicator.formula ? (
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">Fórmula: {indicator.formula}</p>
        ) : null}
      </header>

      {ascending.length > 0 ? (
        <section className="flex flex-col gap-2" aria-labelledby="tendencia">
          <h2 id="tendencia" className="font-[family-name:var(--font-display)] text-xl">
            Tendencia
          </h2>
          <TrendChart
            points={ascending.map((m) => ({
              label: periodOf(indicator.frequency, m.periodStart).label,
              value: m.value,
            }))}
            target={indicator.target}
            alertThreshold={indicator.alertThreshold}
            unit={indicator.unit}
          />
        </section>
      ) : null}

      {canLoad ? (
        <section className="rounded-[var(--radius-md)] border border-[var(--color-line)] p-4">
          <RecordMeasurementForm
            slug={slug}
            objectiveId={objectiveId}
            indicatorId={indicator.id}
            periodLabel={pendingPeriod.label}
            unit={indicator.unit}
          />
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="font-[family-name:var(--font-display)] text-xl">Mediciones</h2>
        {indicator.measurements.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-muted)]">Todavía no se cargó ningún período.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {indicator.measurements.map((m) => (
              <li
                key={m.id}
                className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--color-line)] p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-medium">
                    {periodOf(indicator.frequency, m.periodStart).label}
                    <span className="ml-3 tabular-nums">
                      {m.value} {indicator.unit}
                    </span>
                  </p>
                  <span className={`rounded px-2 py-0.5 text-xs font-semibold ${MEASUREMENT_STATUS_TONE[m.status]}`}>
                    {MEASUREMENT_STATUS_LABELS[m.status]}
                  </span>
                </div>
                {m.analysis ? (
                  <p className="text-sm">
                    <span className="font-medium">Análisis:</span> {m.analysis}
                  </p>
                ) : null}
                <p className="text-xs text-[var(--color-ink-muted)]">
                  Cargado por {nameOf(m.recordedByUserId)} el {formatDate(m.recordedAt)}
                </p>
                {m.corrections.length > 0 ? (
                  <ul className="text-xs text-[var(--color-ink-muted)]">
                    {m.corrections.map((c) => (
                      <li key={c.id}>
                        Corregido de {c.previousValue} a {c.newValue} por {nameOf(c.byUserId)} ({formatDate(c.createdAt)}):{" "}
                        {c.reason}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {m.status === "off_target" ? (
                  <div className="flex flex-wrap items-start gap-4">
                    {m.findingId ? (
                      <Link
                        href={`/t/${slug}/findings/${m.findingId}`}
                        className="text-sm font-medium text-[var(--color-accent)] hover:underline"
                      >
                        Ver hallazgo
                      </Link>
                    ) : canLoad ? (
                      <CreateFindingButton
                        slug={slug}
                        objectiveId={objectiveId}
                        indicatorId={indicator.id}
                        measurementId={m.id}
                      />
                    ) : null}
                    <Link
                      href={`/t/${slug}/risks/explore?kind=indicator&label=${encodeURIComponent(indicator.name)}${m.findingId ? `&finding=${m.findingId}` : ""}`}
                      className="self-center text-sm font-medium text-[var(--color-accent)] hover:underline"
                    >
                      Explorar riesgo
                    </Link>
                  </div>
                ) : null}
                {canLoad ? (
                  <CorrectMeasurementForm
                    slug={slug}
                    objectiveId={objectiveId}
                    indicatorId={indicator.id}
                    measurementId={m.id}
                    currentValue={m.value}
                    currentAnalysis={m.analysis ?? ""}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
