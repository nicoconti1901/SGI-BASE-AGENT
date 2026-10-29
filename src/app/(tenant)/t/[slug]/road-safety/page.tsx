import Link from "next/link";
import { loadRoadAccess } from "@/app/(tenant)/t/[slug]/road-safety/access";
import { Bars } from "@/app/(tenant)/t/[slug]/safety/stats/parts";
import { RateCard, ResultCard, StatCard } from "@/app/(tenant)/t/[slug]/road-safety/parts";
import { defaultRoadAnchor, getRoadDashboard, roadMonthOptions, type RoadRateBlock } from "@/lib/road-dashboard";
import { WINDOW_KINDS, WINDOW_LABELS, type WindowKind } from "@/domain/safety-stats/dashboard";
import { monthLabel } from "@/domain/safety-stats/exposure-import";
import { localDay } from "@/domain/safety-stats/period";
import { ROAD_RATE_BASE } from "@/domain/road-safety/types";
import { Button, EmptyState, Field, HintCallout, INPUT_CLASS, SectionBlock, StatusChip, buttonClass } from "@/components/ui";

const fmt = (n: number, d = 2) => n.toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d });

function blockStatus(b: RoadRateBlock, minExposureKm: number) {
  if (b.aggregate.status === "no_data") return <StatusChip status="danger" label="Sin datos" />;
  return (
    <span className="flex flex-wrap gap-1.5">
      {b.aggregate.status === "partial" ? <StatusChip status="warning" label="Parcial" /> : <StatusChip status="ok" label="Completo" />}
      {b.aggregate.lowExposure ? <StatusChip status="warning" label={`Poca exposición (menos de ${minExposureKm.toLocaleString("es-AR")} km)`} /> : null}
    </span>
  );
}

export default async function RoadSafetyDashboardPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ ventana?: string; mes?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const { tenant, actor, canManage } = await loadRoadAccess(slug);
  const today = localDay(new Date());
  const months = roadMonthOptions(today, 24);
  const anchor = sp.mes && months.includes(sp.mes) ? sp.mes : defaultRoadAnchor(today);
  const kind: WindowKind = (WINDOW_KINDS as readonly string[]).includes(sp.ventana ?? "") ? (sp.ventana as WindowKind) : "rolling12";
  const dash = await getRoadDashboard({ tenantId: tenant.id, actor, kind, anchor, today });
  const base = `/t/${slug}/road-safety`;
  const query = `ventana=${kind}&mes=${anchor}`;
  const { result, exposure, intermediate: mid, breakdown, rates, settings } = dash;
  const noEvents = result.fatalities === 0 && result.hospitalized === 0 && mid.eventCount === 0 && result.nearMisses === 0 && result.outsideControl === 0;

  return (
    <div className="flex flex-col gap-6">
      <SectionBlock
        title="Período"
        what="Elegí hasta qué mes mirar y qué período. Las tasas siempre muestran el mes, el año y los últimos 12 meses."
        actions={
          <nav aria-label="Exportar" className="flex flex-wrap gap-2">
            <a href={`${base}/export?${query}&tipo=totales`} className={buttonClass("secondary", "min-h-9")}>
              Descargar CSV por mes
            </a>
            {canManage ? (
              <a href={`${base}/export?${query}&tipo=casos`} className={buttonClass("secondary", "min-h-9")}>
                Descargar casos (con nombres)
              </a>
            ) : null}
          </nav>
        }
      >
        <form method="get" className="flex flex-wrap items-end gap-3" aria-label="Período">
          <Field label="Período">
            <select name="ventana" defaultValue={kind} className={INPUT_CLASS}>
              {WINDOW_KINDS.map((k) => (
                <option key={k} value={k}>
                  {WINDOW_LABELS[k]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Hasta el mes de">
            <select name="mes" defaultValue={anchor} className={INPUT_CLASS}>
              {months.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </select>
          </Field>
          <Button type="submit" variant="secondary">
            Ver
          </Button>
        </form>
        <p className="text-sm text-[var(--color-ink-muted)]">
          <span className="font-semibold text-[var(--color-ink)]">{dash.window.label}</span> · hechos de la flota en misión
        </p>
      </SectionBlock>

      {noEvents && exposure.vehicles === 0 ? (
        <EmptyState what="Todavía no hay hechos de tránsito ni vehículos con km." next="registrá un hecho de tránsito o cargá los vehículos en Equipos." action={{ href: `/t/${slug}/assets`, label: "Ir a Equipos" }} />
      ) : null}

      <SectionBlock title="1. Resultado final" what="Lo que más importa: personas. Se cuentan, no se dividen por km.">
        <div className="grid gap-4 sm:grid-cols-2" role="group" aria-label="Resultado final">
          <ResultCard title="Muertes" value={result.fatalities} help="Personas fallecidas en hechos de la flota en misión." />
          <ResultCard title="Lesionados graves" value={result.hospitalized} help="Personas que requirieron internación." />
        </div>
      </SectionBlock>

      <SectionBlock
        title="2. Exposición"
        what="Los km que recorrió la flota en el período. Sin km no hay tasa."
        actions={canManage ? <Link href={`${base}/km`} className={buttonClass("secondary", "min-h-9")}>Km del mes</Link> : null}
      >
        <p className="font-[family-name:var(--font-display)] text-2xl font-semibold tabular-nums">
          {exposure.totalKm > 0 ? `${exposure.totalKm.toLocaleString("es-AR")} km` : "Sin datos"}
        </p>
        <ul className="flex flex-wrap gap-2 text-sm" aria-label="De dónde sale cada dato">
          <li><StatusChip status="ok" label={`Calculado: ${exposure.calculated}`} /></li>
          <li><StatusChip status="pending" label={`Repartido: ${exposure.allocated}`} /></li>
          <li><StatusChip status="pending" label={`Manual: ${exposure.manual}`} /></li>
          <li><StatusChip status={exposure.noData > 0 ? "warning" : "pending"} label={`Sin dato: ${exposure.noData}`} /></li>
        </ul>
        <p className="text-xs text-[var(--color-ink-muted)]">Cada número cuenta vehículos por mes. «Repartido»: lecturas separadas por meses sin lectura, repartidas por días.</p>
        {result.status !== "ok" && result.missing.length > 0 ? (
          <HintCallout>
            {canManage ? "Faltan km de " : "Hay vehículos sin km: "}
            {rates.rolling12.missingLabels.slice(0, 6).join(", ")}
            {rates.rolling12.missingLabels.length > 6 ? ` y ${rates.rolling12.missingLabels.length - 6} más` : ""}. {canManage ? "Cargalos en «Km del mes»." : "Pedile al administrador o al responsable de proceso que los cargue."}
          </HintCallout>
        ) : null}
      </SectionBlock>

      <SectionBlock title="3. Tasas por millón de km" what={`Hechos de la flota en misión cada ${ROAD_RATE_BASE.toLocaleString("es-AR")} de km. Se suman los hechos y los km antes de dividir.`}>
        <div className="grid gap-4 lg:grid-cols-3">
          {([rates.month, rates.ytd, rates.rolling12] as const).map((b) => (
            <RateCard
              key={b.label}
              title={b.label}
              status={blockStatus(b, settings.minExposureKm)}
              events={b.indices?.eventsPerMillionKm ?? null}
              injury={b.indices?.injuryEventsPerMillionKm ?? null}
              rollovers={b.indices?.rolloversPerMillionKm ?? null}
              totalKm={b.aggregate.totalKm}
              partial={b.aggregate.status === "partial" ? b.missingLabels : null}
              lowExposure={b.aggregate.lowExposure && b.aggregate.status !== "no_data"}
              absolute={b.aggregate.events}
            />
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <caption className="pb-2 text-left text-sm font-semibold">Mes a mes: hechos por millón de km</caption>
            <thead>
              <tr className="border-b border-[var(--color-line)] text-[var(--color-ink-muted)]">
                <th scope="col" className="py-1.5 pr-3 font-medium">Mes</th>
                <th scope="col" className="py-1.5 pr-3 text-right font-medium">Hechos</th>
                <th scope="col" className="py-1.5 pr-3 text-right font-medium">Km</th>
                <th scope="col" className="py-1.5 pr-3 text-right font-medium">Tasa</th>
                <th scope="col" className="py-1.5 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {dash.series.map((p) => (
                <tr key={p.month} className="border-b border-[var(--color-line)] last:border-0">
                  <th scope="row" className="py-1.5 pr-3 font-normal">{monthLabel(p.month)}</th>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{p.aggregate.events}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{p.aggregate.totalKm.toLocaleString("es-AR")}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{p.indices ? fmt(p.indices.eventsPerMillionKm) : "Sin datos"}</td>
                  <td className="py-1.5 text-[var(--color-ink-muted)]">{p.aggregate.status === "ok" ? "Completo" : p.aggregate.status === "partial" ? "Parcial" : "Sin datos"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionBlock>

      <SectionBlock title="4. Resultados intermedios" what="Medidas que se ven antes de que haya un choque. Solo las que el sistema tiene.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Cinturón"
            value={mid.seatbeltPct === null ? "Sin datos" : `${fmt(mid.seatbeltPct, 0)} %`}
            help={mid.seatbeltPct === null ? "Ningún hecho del período tiene el dato de cinturón." : `Hechos con todos los ocupantes con cinturón, sobre ${mid.seatbeltBase} con dato.`}
          />
          <StatCard title="Fatiga, distracción o alcohol" value={String(mid.fatigueOrAlcoholCount)} help={`Hechos cuya causa principal fue esa, de ${mid.eventCount}.`} />
          <StatCard
            title="Flota con inspección al día"
            value={mid.fleet.total === 0 ? "Sin datos" : `${mid.fleet.upToDate} de ${mid.fleet.total}`}
            help={mid.fleet.overdue.length === 0 ? "Hoy; un vehículo sin inspección cuenta como vencido." : `Vencidos o sin inspección: ${mid.fleet.overdue.slice(0, 5).map((v) => v.code).join(", ")}${mid.fleet.overdue.length > 5 ? "…" : ""}.`}
          />
          <StatCard title="Denuncia realizada" value={mid.eventCount === 0 ? "Sin datos" : `${mid.reportFiledCount} de ${mid.eventCount}`} help="Hechos con la denuncia del siniestro presentada." />
          <StatCard
            title="Excesos de velocidad"
            value={mid.speeding.loadedMonths === 0 ? "Sin datos" : String(mid.speeding.total)}
            help={mid.speeding.loadedMonths === 0 ? "No hay excesos cargados en el período." : "Cargados a mano por vehículo y mes."}
          />
        </div>
      </SectionBlock>

      <SectionBlock title="5. Fuera de las tasas" what="Hechos que cuentan, pero no entran en la tasa por km.">
        <div className="grid gap-3 sm:grid-cols-3" role="group" aria-label="Fuera de las tasas">
          <StatCard title="Sin daño (casi accidentes)" value={String(result.nearMisses)} help="No entran en las tasas." />
          <StatCard title="Fuera del control de la empresa" value={String(result.outsideControl)} help="In itinere o en vehículo particular." />
          <StatCard title="En misión, sin vehículo cargado" value={String(result.unattributed)} help="Cargá el vehículo en el hecho para que entre en la tasa." />
        </div>
      </SectionBlock>

      <SectionBlock title="Cómo ocurren" what="Hechos del período, sin nombres de personas.">
        <div className="grid gap-6 lg:grid-cols-3">
          <Bars title="Tipo de hecho" rows={breakdown.byType} empty="Sin hechos." />
          <Bars title="Causa principal" rows={breakdown.byCause} empty="Sin hechos." />
          <Bars title="Por vehículo" rows={breakdown.byVehicle} empty="Sin hechos con vehículo." />
        </div>
        {breakdown.withoutVehicle > 0 ? <p className="text-sm text-[var(--color-ink-muted)]">{breakdown.withoutVehicle} hecho(s) sin vehículo de la empresa no figuran por vehículo.</p> : null}
      </SectionBlock>

      {dash.canSeeDrivers ? (
        <SectionBlock
          title="6. Conductores para revisar"
          what={`Quienes tuvieron ${settings.repeatThreshold} o más hechos en los últimos ${settings.repeatWindowMonths} meses. Es para conversar y revisar el caso, sin puntaje ni sanción.`}
        >
          {dash.review && dash.review.length > 0 ? (
            <ul className="divide-y divide-[var(--color-line)] rounded-[var(--radius-lg)] border border-[var(--color-line)] text-sm">
              {dash.review.map((r) => (
                <li key={r.personId} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="font-medium">{r.name}</span>
                  <span className="tabular-nums">{r.count} hechos</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--color-ink-muted)]">Nadie llegó al umbral en el período.</p>
          )}
          <p className="text-xs text-[var(--color-ink-muted)]">Consultar esta lista deja un registro.</p>
        </SectionBlock>
      ) : null}
    </div>
  );
}
