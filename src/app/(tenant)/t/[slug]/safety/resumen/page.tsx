import Link from "next/link";
import { loadSafetyAccess } from "@/app/(tenant)/t/[slug]/safety/access";
import { parseSafetyFilter, safetyFilterQuery, type SafetyQuery } from "@/app/(tenant)/t/[slug]/safety/filters";
import { PrintButton } from "@/app/(tenant)/t/[slug]/safety/PrintButton";
import { getSafetySummary } from "@/lib/safety-export";
import { SAFETY_METRICS, type SafetyMetric } from "@/lib/safety-dashboard";
import { monthLabel } from "@/domain/safety-stats/exposure-import";
import { localDay } from "@/domain/safety-stats/period";
import { describeGaps, type GroupFilter } from "@/domain/safety-stats/dashboard";
import { CLASSIFICATION_LABELS } from "@/domain/safety-stats/types";

const GROUP_LABELS: Record<GroupFilter, string> = { total: "Personal propio y contratistas", own: "Personal propio", contractor: "Contratistas" };

const fmt = (n: number, d = 2) => n.toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d });
const value = (n: number | null, d = 2) => (n === null ? "Sin datos" : fmt(n, d));

const METRICS: Record<SafetyMetric, { title: string; unit: (base: number) => string; decimals: number }> = {
  if: { title: "Frecuencia (IF)", unit: () => "casos con baja y fatales por millón de horas", decimals: 2 },
  ig: { title: "Gravedad (IG)", unit: (b) => `días perdidos por ${b === 1_000_000 ? "millón" : "mil"} de horas`, decimals: 2 },
  ii: { title: "Incidencia (II)", unit: () => "casos con baja y fatales por mil trabajadores", decimals: 2 },
  id: { title: "Duración media (ID)", unit: () => "días de baja por caso con baja", decimals: 1 },
};

/**
 * Resumen de una página para la revisión por la dirección (ISO 45001 §9.3): índices con su base, comparación con el
 * período anterior, meta, pirámide, resultados por sede y espacio para las decisiones. Solo totales, sin nombres.
 * Al imprimir se ocultan el menú y las pestañas.
 */
export default async function SafetySummaryPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<SafetyQuery> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const { tenant } = await loadSafetyAccess(slug);
  const today = localDay(new Date());
  const filter = await parseSafetyFilter(tenant.id, sp, today);
  const summary = await getSafetySummary(tenant.id, { ...filter, today });
  const { current, previous, window: w, settings } = summary;
  const raw = current.rawCounts;
  const siteNames = new Map(summary.sites.map((s) => [s.id, s.name]));
  const siteName = filter.siteId ? (siteNames.get(filter.siteId) ?? "Una sede") : "Todas las sedes";
  const statusText =
    current.status === "ok" ? "Completo" : current.status === "partial" ? "Parcial: no usa los meses sin horas cargadas" : "Sin datos: faltan horas por cargar";
  const gaps = describeGaps(current, siteNames, 6);

  return (
    <article className="flex flex-col gap-6">
      <style>{`@media print { header, nav, aside, [role="banner"] { display: none !important; } body { background: #fff; } }`}</style>
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <Link href={`/t/${slug}/safety/stats?${safetyFilterQuery(filter)}`} className="text-sm font-medium text-[var(--color-accent)] hover:underline">
          ← Volver al tablero
        </Link>
        <PrintButton label="Imprimir resumen" />
      </div>

      <div className="flex flex-col gap-1 border-b border-[var(--color-ink)] pb-3">
        <p className="text-sm">{tenant.name} · ISO 45001 §9.3, revisión por la dirección</p>
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">Resumen de accidentabilidad</h2>
        <p className="text-sm text-[var(--color-ink-muted)]">
          {w.label} · {siteName} · {GROUP_LABELS[filter.group]} · emitido el {today.split("-").reverse().join("/")}
        </p>
      </div>

      <section aria-label="Estado del cálculo" className="flex flex-col gap-1 text-sm">
        <p>
          <span className="font-semibold">Cálculo:</span> {statusText}
          {current.monthsUsed.length > 0 ? ` (${current.monthsUsed.length} de ${w.months.length} mes(es))` : ""}.
        </p>
        {gaps.length > 0 ? (
          <ul className="list-disc space-y-0.5 pl-5">
            {gaps.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        ) : null}
        {current.provisionalMonths.length > 0 ? (
          <p>Siguen de baja casos de {current.provisionalMonths.map(monthLabel).join(", ")}: los días perdidos de esos meses son provisorios.</p>
        ) : null}
      </section>

      <section aria-label="Índices" className="flex flex-col gap-2">
        <h3 className="font-semibold">Índices del período</h3>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--color-ink)] text-left">
              <th className="py-1.5 pr-3">Índice</th>
              <th className="py-1.5 pr-3 text-right">Valor</th>
              <th className="py-1.5 pr-3 text-right">Período anterior</th>
              <th className="py-1.5 pr-3">Meta</th>
              <th className="py-1.5">Unidad</th>
            </tr>
          </thead>
          <tbody>
            {SAFETY_METRICS.map((m) => {
              const goal = summary.goals[m];
              const noCases = m === "id" && current.indices.idNoCases;
              return (
                <tr key={m} className="border-b border-[var(--color-line)] align-top">
                  <th scope="row" className="py-1.5 pr-3 text-left font-medium">
                    {METRICS[m].title}
                  </th>
                  <td className="py-1.5 pr-3 text-right tabular-nums font-semibold">{noCases ? "Sin casos" : value(current.indices[m], METRICS[m].decimals)}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{previous.status === "ok" ? value(previous.indices[m], METRICS[m].decimals) : "—"}</td>
                  <td className="py-1.5 pr-3">
                    {goal
                      ? `${fmt(goal.target, 2)} (${goal.status === "met" ? "se cumple" : goal.status === "off" ? "no se cumple" : "sin datos"})`
                      : "—"}
                  </td>
                  <td className="py-1.5">{METRICS[m].unit(settings.severityBase)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="text-xs text-[var(--color-ink-muted)]">
          El período anterior es de igual largo ({previous.status === "ok" ? "completo" : "incompleto: no se compara"}).
          {current.indices.igReal !== null ? ` Gravedad solo con días reales: ${fmt(current.indices.igReal)}.` : ""}
        </p>
      </section>

      <section aria-label="Base del cálculo" className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        <p>
          <span className="font-semibold">Horas trabajadas usadas:</span> {current.status === "no_data" ? "—" : current.totals.hours.toLocaleString("es-AR")}
        </p>
        <p>
          <span className="font-semibold">Dotación promedio:</span> {current.status === "no_data" ? "—" : fmt(current.totals.headcount, 1)}
        </p>
        <p>
          <span className="font-semibold">Casos con baja:</span> {raw.lost_time} · <span className="font-semibold">Fatales:</span> {raw.fatal}
        </p>
        <p>
          <span className="font-semibold">Días de baja reales:</span> {raw.lostDays.toLocaleString("es-AR")}
        </p>
      </section>

      <section aria-label="Eventos" className="flex flex-col gap-2">
        <h3 className="font-semibold">Eventos del período</h3>
        <p className="text-sm text-[var(--color-ink-muted)]">Hechos laborales, con o sin horas cargadas. Sin nombres.</p>
        <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
          {(["fatal", "lost_time", "no_lost_time", "first_aid", "near_miss", "occupational_disease"] as const).map((k) => (
            <li key={k} className="flex justify-between gap-3 border-b border-[var(--color-line)] py-1">
              <span>{CLASSIFICATION_LABELS[k]}</span>
              <span className="tabular-nums font-semibold">{raw[k]}</span>
            </li>
          ))}
        </ul>
        <p className="text-sm">
          Aparte de los índices, en el trayecto al trabajo (in itinere): {current.inItinere.cases} caso(s) con baja o fatales, {current.inItinere.lostDays.toLocaleString("es-AR")} día(s) de baja.
        </p>
      </section>

      <section aria-label="Resultados por sede" className="flex flex-col gap-2">
        <h3 className="font-semibold">Por sede</h3>
        {summary.perSite.length === 0 ? (
          <p className="text-sm">No hay sedes activas.</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--color-ink)] text-left">
                <th className="py-1.5 pr-3">Sede</th>
                <th className="py-1.5 pr-3 text-right">Horas</th>
                <th className="py-1.5 pr-3 text-right">Con baja y fatales</th>
                <th className="py-1.5 pr-3 text-right">Días</th>
                <th className="py-1.5 pr-3 text-right">IF</th>
                <th className="py-1.5 pr-3 text-right">IG</th>
                <th className="py-1.5 text-right">Sin accidentes con baja</th>
              </tr>
            </thead>
            <tbody>
              {summary.perSite.map((s) => {
                const since = summary.daysSince.find((d) => d.siteId === s.siteId)?.value;
                return (
                  <tr key={s.siteId} className="border-b border-[var(--color-line)]">
                    <th scope="row" className="py-1.5 pr-3 text-left font-medium">
                      {s.siteName}
                      {s.result.status === "partial" ? " (parcial)" : ""}
                    </th>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{s.result.status === "no_data" ? "—" : s.result.totals.hours.toLocaleString("es-AR")}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{s.result.rawCounts.lost_time + s.result.rawCounts.fatal}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{s.result.rawCounts.lostDays.toLocaleString("es-AR")}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{value(s.result.indices.if)}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{value(s.result.indices.ig)}</td>
                    <td className="py-1.5 text-right tabular-nums">
                      {since?.kind === "days" ? `${since.days.toLocaleString("es-AR")} día(s)` : since?.kind === "none_since" ? `Desde ${monthLabel(since.since)}` : "Sin datos"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section aria-label="Decisiones de la dirección" className="flex flex-col gap-3 text-sm">
        <h3 className="font-semibold">Revisión por la dirección</h3>
        <p>Observaciones y decisiones (acciones, recursos, cambios en los objetivos):</p>
        <div className="h-24 rounded-[var(--radius-md)] border border-[var(--color-ink)]" />
        <div className="grid gap-6 sm:grid-cols-2">
          <p className="border-t border-[var(--color-ink)] pt-1">Responsable y firma</p>
          <p className="border-t border-[var(--color-ink)] pt-1">Fecha de la revisión</p>
        </div>
      </section>

      <footer className="border-t border-[var(--color-line)] pt-3 text-xs text-[var(--color-ink-muted)]">
        <p>
          Cómo se calcula: se suman casos, días y horas del período antes de dividir. Cada día perdido es un día corrido sin contar el del accidente, con tope de {settings.lostDaysCap}. Cada
          fatal suma un cargo de {settings.fatalChargeDays.toLocaleString("es-AR")} días a la gravedad y no entra en la duración media. Los accidentes in itinere y las enfermedades
          profesionales no entran en ningún índice. Los meses sin horas cargadas se dejan afuera y el período se marca como parcial.
        </p>
      </footer>
    </article>
  );
}
