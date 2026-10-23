import Link from "next/link";
import { loadSafetyAccess } from "@/app/(tenant)/t/[slug]/safety/access";
import { Bars, IndexCard } from "@/app/(tenant)/t/[slug]/safety/stats/parts";
import { defaultAnchorMonth, getSafetyDashboard, SAFETY_METRICS, type SafetyMetric } from "@/lib/safety-dashboard";
import { exposureMonthOptions } from "@/lib/safety-exposure";
import { WINDOW_KINDS, WINDOW_LABELS, type GroupFilter, type WindowKind } from "@/domain/safety-stats/dashboard";
import { monthLabel } from "@/domain/safety-stats/exposure-import";
import { localDay } from "@/domain/safety-stats/period";
import { CLASSIFICATION_LABELS } from "@/domain/safety-stats/types";
import { Button, EmptyState, Field, HintCallout, INPUT_CLASS, SectionBlock, StatusChip, buttonClass } from "@/components/ui";

type Query = { ventana?: string; mes?: string; sede?: string; grupo?: string };

const GROUP_LABELS: Record<GroupFilter, string> = { total: "Propio y contratistas", own: "Personal propio", contractor: "Contratistas" };

const METRIC_CARD: Record<SafetyMetric, { title: string; unit: (base: number) => string; decimals: number; help: string }> = {
  if: { title: "Frecuencia (IF)", unit: () => "casos con baja por millón de horas", decimals: 2, help: "Cuántos accidentes con baja o fatales hubo por cada millón de horas trabajadas." },
  ig: { title: "Gravedad (IG)", unit: (b) => `días perdidos por ${b === 1_000_000 ? "millón" : "mil"} de horas`, decimals: 2, help: "Cuántos días se perdieron, sumando el cargo por fatales, por cada mil horas trabajadas." },
  ii: { title: "Incidencia (II)", unit: () => "casos con baja por mil trabajadores", decimals: 2, help: "Cuántos accidentes con baja o fatales hubo por cada mil personas de la dotación." },
  id: { title: "Duración media (ID)", unit: () => "días por caso con baja", decimals: 1, help: "Cuántos días de baja dura, en promedio, cada accidente con baja (sin contar fatales)." },
};

export default async function SafetyStatsPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Query> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const { tenant, canManage } = await loadSafetyAccess(slug);
  const today = localDay(new Date());

  const kind: WindowKind = (WINDOW_KINDS as readonly string[]).includes(sp.ventana ?? "") ? (sp.ventana as WindowKind) : "month";
  const group: GroupFilter = sp.grupo === "own" || sp.grupo === "contractor" ? sp.grupo : "total";
  const months = exposureMonthOptions(today, 24);
  const fallback = await defaultAnchorMonth(tenant.id, today);
  const anchor = sp.mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.mes) && sp.mes <= today.slice(0, 7) ? sp.mes : fallback;
  if (!months.includes(anchor)) months.push(anchor);

  const dash = await getSafetyDashboard(tenant.id, { kind, anchor, siteId: sp.sede || undefined, group, today });
  const base = `/t/${slug}/safety`;
  const { current, previous, window: w, settings } = dash;
  const statusChip =
    current.status === "ok" ? <StatusChip status="ok" label="Completo" /> : current.status === "partial" ? <StatusChip status="warning" label="Parcial" /> : <StatusChip status="danger" label="Sin datos" />;
  const siteOptions = dash.sites;

  const optional = settings.showOptionalIndices;
  const raw = current.rawCounts;
  const pyramid = [
    { key: "fatal", label: CLASSIFICATION_LABELS.fatal, count: raw.fatal },
    { key: "lost_time", label: CLASSIFICATION_LABELS.lost_time, count: raw.lost_time },
    { key: "no_lost_time", label: CLASSIFICATION_LABELS.no_lost_time, count: raw.no_lost_time },
    { key: "first_aid", label: CLASSIFICATION_LABELS.first_aid, count: raw.first_aid },
    { key: "near_miss", label: CLASSIFICATION_LABELS.near_miss, count: raw.near_miss },
  ];

  return (
    <div className="flex flex-col gap-6">
      <SectionBlock
        title="Índices de siniestralidad"
        what="Se calculan solos con los accidentes registrados y las horas trabajadas de cada mes. Nunca se cargan a mano."
        next={canManage ? "elegí el período; si dice «sin datos», cargá las horas que faltan." : "consultá los índices; las horas las carga el administrador o el responsable de proceso."}
        actions={statusChip}
      >
        <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end" aria-label="Período y filtros">
          <Field label="Período">
            <select name="ventana" defaultValue={kind} className={INPUT_CLASS}>
              {WINDOW_KINDS.map((k) => (
                <option key={k} value={k}>
                  {WINDOW_LABELS[k]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Hasta el mes de" hint="Último mes del período.">
            <select name="mes" defaultValue={anchor} className={INPUT_CLASS}>
              {months.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Sede">
            <select name="sede" defaultValue={sp.sede ?? ""} className={INPUT_CLASS}>
              <option value="">Todas</option>
              {siteOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Personal">
            <select name="grupo" defaultValue={group} className={INPUT_CLASS}>
              {(Object.keys(GROUP_LABELS) as GroupFilter[]).map((g) => (
                <option key={g} value={g}>
                  {GROUP_LABELS[g]}
                </option>
              ))}
            </select>
          </Field>
          <Button type="submit" variant="secondary">
            Ver
          </Button>
        </form>

        <p className="text-sm text-[var(--color-ink-muted)]">
          <span className="font-semibold text-[var(--color-ink)]">{w.label}</span> · {GROUP_LABELS[group]}
          {current.monthsUsed.length > 0 && current.monthsUsed.length < w.months.length
            ? ` · se usaron ${current.monthsUsed.length} de ${w.months.length} meses`
            : ""}
        </p>

        {current.status !== "ok" && dash.gaps.length > 0 ? (
          <section aria-label="Qué falta" className="flex flex-col gap-2 rounded-[var(--radius-lg)] border border-[var(--color-warning-line)] bg-[var(--color-warning-soft)] p-4 text-sm">
            <p className="font-semibold">{current.status === "no_data" ? "Todavía no se puede calcular." : "El cálculo es parcial: no usa los meses incompletos."}</p>
            <ul className="list-disc space-y-1 pl-5">
              {dash.gaps.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
            {canManage ? (
              <p>
                <Link href={`${base}/exposure?mes=${current.monthsExcluded[0]?.month ?? anchor}`} className={buttonClass("secondary")}>
                  Cargar las horas
                </Link>
              </p>
            ) : (
              <p className="text-[var(--color-ink-muted)]">Pedile al administrador o al responsable de proceso que cargue las horas.</p>
            )}
          </section>
        ) : null}
        {current.provisionalMonths.length > 0 ? (
          <HintCallout>
            Hay casos que siguen de baja en {current.provisionalMonths.map(monthLabel).join(", ")}: los días perdidos de esos meses son provisorios y pueden crecer.
          </HintCallout>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" role="group" aria-label="Índices del período">
          {SAFETY_METRICS.map((m) => (
            <IndexCard
              key={m}
              title={METRIC_CARD[m].title}
              help={METRIC_CARD[m].help}
              unit={METRIC_CARD[m].unit(settings.severityBase)}
              value={current.indices[m]}
              decimals={METRIC_CARD[m].decimals}
              noCases={m === "id" && current.indices.idNoCases}
              noData={current.status === "no_data"}
              trend={dash.trends[m]}
              trendAgainst={previous.status === "ok" ? w.previousMonths.length > 1 ? "el período anterior" : monthLabel(w.previousMonths[0]) : null}
              goal={dash.goals[m]}
              extra={m === "ig" && current.indices.igReal !== null ? `Solo días reales: ${current.indices.igReal.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : undefined}
            />
          ))}
        </div>

        {optional ? (
          <div className="grid gap-4 sm:grid-cols-2" role="group" aria-label="Más indicadores">
            <IndexCard title="TRIR" help="Casos registrables por 200.000 horas (norma OSHA)." unit="casos por 200.000 horas" value={current.indices.trir} decimals={2} noData={current.status === "no_data"} trend={null} trendAgainst={null} />
            <IndexCard title="DART" help="Casos con baja o con tareas restringidas por 200.000 horas." unit="casos por 200.000 horas" value={current.indices.dart} decimals={2} noData={current.status === "no_data"} trend={null} trendAgainst={null} />
          </div>
        ) : null}
      </SectionBlock>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionBlock title="Pirámide de eventos" what={`Lo que pasó en ${w.label}, de lo más grave a lo más leve. Solo hechos laborales: no depende de las horas cargadas.`}>
          <Bars rows={pyramid} empty="No hubo eventos en el período." />
          <p className="text-sm text-[var(--color-ink-muted)]">Días de baja de los casos con baja: {raw.lostDays.toLocaleString("es-AR")}.</p>
        </SectionBlock>

        <SectionBlock title="Días sin accidentes con baja" what="Por sede, contando personal propio y contratistas.">
          {dash.daysSince.length === 0 ? (
            <EmptyState what="No hay sedes activas." next="creá las sedes en Datos maestros." />
          ) : (
            <ul className="divide-y divide-[var(--color-line)] rounded-[var(--radius-lg)] border border-[var(--color-line)] text-sm">
              {dash.daysSince.map((d) => (
                <li key={d.siteId} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="font-medium">{d.siteName}</span>
                  <span className="tabular-nums">
                    {d.value.kind === "days"
                      ? `${d.value.days.toLocaleString("es-AR")} día(s)`
                      : d.value.kind === "none_since"
                        ? `Sin accidentes con baja desde ${monthLabel(d.value.since)}`
                        : "Sin datos"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionBlock>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionBlock title="Aparte de los índices" what="Estos casos no entran en IF, IG, II ni ID.">
          <dl className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] p-4">
              <dt className="text-sm text-[var(--color-ink-muted)]">En el trayecto al trabajo (in itinere)</dt>
              <dd className="font-[family-name:var(--font-display)] text-2xl font-semibold tabular-nums">{current.inItinere.cases}</dd>
              <dd className="text-xs text-[var(--color-ink-muted)]">{current.inItinere.lostDays.toLocaleString("es-AR")} día(s) de baja</dd>
            </div>
            <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] p-4">
              <dt className="text-sm text-[var(--color-ink-muted)]">Enfermedades profesionales</dt>
              <dd className="font-[family-name:var(--font-display)] text-2xl font-semibold tabular-nums">{raw.occupational_disease}</dd>
            </div>
          </dl>
        </SectionBlock>

        <SectionBlock title="Cómo ocurren" what="Hechos laborales del período, sin nombres.">
          <div className="flex flex-col gap-4">
            <Bars title="Forma del accidente" rows={dash.distributions.form} empty="Sin eventos." />
            <Bars title="Agente material" rows={dash.distributions.agent} empty="Sin eventos." />
          </div>
        </SectionBlock>
      </div>

      <SectionBlock title="Cuándo y dónde" what="Para ver patrones: parte del cuerpo, día de la semana y hora del hecho.">
        <div className="grid gap-6 lg:grid-cols-3">
          <Bars title="Parte del cuerpo" rows={dash.distributions.bodyPart} empty="Todavía no hay fichas de salud completas." />
          <Bars title="Día de la semana" rows={dash.distributions.weekday} empty="Sin eventos." keepZero />
          <Bars title="Hora del día" rows={dash.distributions.hour} empty="Sin eventos." />
        </div>
      </SectionBlock>
    </div>
  );
}
