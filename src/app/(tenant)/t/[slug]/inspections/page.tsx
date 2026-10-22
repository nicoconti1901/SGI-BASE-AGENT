import Link from "next/link";
import { inspectionCounters, listDuePlans, listInspections, type DuePlanKind } from "@/lib/inspection-list";
import { prisma } from "@/lib/db";
import { listSites } from "@/lib/masterdata";
import { listTenantMembers } from "@/lib/identity";
import { SitePicker } from "@/components/pickers/SitePicker";
import { loadInspectionsAccess } from "@/app/(tenant)/t/[slug]/inspections/access";
import { hasInspectionFilter, inspectionFilterFromParams, type InspectionSearchParams } from "@/app/(tenant)/t/[slug]/inspections/filters";
import { startInspectionAction } from "@/app/(tenant)/t/[slug]/inspections/actions";
import { formatDateEs, isoFromDate } from "@/domain/inspections/dates";
import { MAX_EXPORT_ROWS } from "@/domain/inspections/export";
import { RESULT_LABELS, type InspectionResult } from "@/domain/inspections/types";
import { Button, EmptyState, Field, FormError, INPUT_CLASS, SectionBlock, StatGrid, StatTile, StatusChip, buttonClass } from "@/components/ui";

const RESULT_CHIP: Record<InspectionResult, "ok" | "warning" | "danger"> = { fit: "ok", fit_with_observations: "warning", unfit: "danger" };

const th = "px-4 py-2.5 font-semibold";
const THEAD = "border-b border-[var(--color-line)] bg-[var(--color-surface-sunken)] font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.06em] text-[var(--color-ink-muted)]";

export default async function InspectionsPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<InspectionSearchParams> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const { tenant, canWrite } = await loadInspectionsAccess(slug);
  const base = `/t/${slug}/inspections`;
  const filter = inspectionFilterFromParams(sp);
  const view: DuePlanKind | null = sp.vista === "vencidas" ? "overdue" : sp.vista === "proximas" ? "upcoming" : null;

  const [counters, sites, templates, members] = await Promise.all([
    inspectionCounters(tenant.id),
    listSites(tenant.id),
    prisma.inspectionTemplate.findMany({ where: { tenantId: tenant.id, active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    listTenantMembers(tenant.id),
  ]);
  const due = view ? await listDuePlans(tenant.id, { kind: view, after: sp.despues }) : null;
  const page = view ? null : await listInspections(tenant.id, { ...filter, after: sp.despues });

  const query = (extra: Record<string, string>) => {
    const keep: Record<string, string> = {};
    for (const key of ["tipo", "sede", "activo", "inspector", "resultado", "desde", "hasta", "vista"] as const) if (sp[key]) keep[key] = sp[key]!;
    return new URLSearchParams({ ...keep, ...extra }).toString();
  };
  const filtered = hasInspectionFilter(filter);
  const exportHref = `${base}/export?${query({})}`;

  return (
    <SectionBlock
      title="Inspecciones"
      what="Cada control queda con su resultado, sus fotos y quién lo firmó."
      next={canWrite ? "tocá «Nueva inspección», elegí el activo y respondé el listado." : "consultá las inspecciones hechas."}
      actions={
        <>
          {canWrite ? (
            <Link href={`${base}/new`} className={buttonClass("primary", "min-h-12")}>
              Nueva inspección
            </Link>
          ) : null}
          <a href={exportHref} className={buttonClass("secondary")} download>
            Exportar CSV
          </a>
        </>
      }
    >
      {sp.error ? <FormError>{sp.error}</FormError> : null}

      <StatGrid cols={4} aria-label="Resumen de inspecciones">
        <Link href={`${base}?vista=vencidas`} className="block hover:bg-[var(--color-surface-sunken)]" aria-current={view === "overdue" ? "page" : undefined}>
          <StatTile label="Vencidas" value={counters.overdue} tone={counters.overdue > 0 ? "danger" : "default"} />
        </Link>
        <Link href={`${base}?resultado=unfit&desde=${counters.unfitSince}`} className="block hover:bg-[var(--color-surface-sunken)]">
          <StatTile label="No aptas · 30 días" value={counters.unfit} tone={counters.unfit > 0 ? "danger" : "default"} />
        </Link>
        <Link href={`/t/${slug}/assets?estado=out_of_service`} className="block hover:bg-[var(--color-surface-sunken)]">
          <StatTile label="Activos fuera de servicio" value={counters.outOfService} tone={counters.outOfService > 0 ? "warning" : "default"} />
        </Link>
        <Link href={`${base}?vista=proximas`} className="block hover:bg-[var(--color-surface-sunken)]" aria-current={view === "upcoming" ? "page" : undefined}>
          <StatTile label="Próximas 7 días" value={counters.upcoming} />
        </Link>
      </StatGrid>

      {view ? (
        <p className="text-sm">
          <strong>{view === "overdue" ? "Inspecciones vencidas" : "Inspecciones de los próximos 7 días"}.</strong>{" "}
          <Link href={base} className="font-medium text-[var(--color-accent)] hover:underline">
            Ver todas las inspecciones
          </Link>
        </p>
      ) : (
        <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Filtros">
          <Field label="Tipo de inspección">
            <select name="tipo" defaultValue={sp.tipo ?? ""} className={INPUT_CLASS}>
              <option value="">Todos</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
          <SitePicker sites={sites.map((s) => ({ id: s.id, name: s.name }))} name="sede" label="Sede" defaultValue={sp.sede ?? ""} allLabel="Todas" />
          <Field label="Activo" hint="Parte del código.">
            <input name="activo" defaultValue={sp.activo ?? ""} placeholder="Ej.: EXT-014" className={INPUT_CLASS} />
          </Field>
          <Field label="Inspector">
            <select name="inspector" defaultValue={sp.inspector ?? ""} className={INPUT_CLASS}>
              <option value="">Todos</option>
              {members.map((m) => (
                <option key={m.user.id} value={m.user.id}>
                  {m.user.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Resultado">
            <select name="resultado" defaultValue={sp.resultado ?? ""} className={INPUT_CLASS}>
              <option value="">Todos</option>
              {(Object.keys(RESULT_LABELS) as InspectionResult[]).map((r) => (
                <option key={r} value={r}>
                  {RESULT_LABELS[r]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Desde">
            <input type="date" name="desde" defaultValue={sp.desde ?? ""} className={INPUT_CLASS} />
          </Field>
          <Field label="Hasta">
            <input type="date" name="hasta" defaultValue={sp.hasta ?? ""} className={INPUT_CLASS} />
          </Field>
          <div className="flex items-end gap-2">
            <Button type="submit" variant="secondary">
              Filtrar
            </Button>
            {filtered ? (
              <Link href={base} className={buttonClass("ghost")}>
                Limpiar
              </Link>
            ) : null}
          </div>
        </form>
      )}

      {due ? (
        due.items.length === 0 ? (
          <EmptyState what={view === "overdue" ? "No hay inspecciones vencidas." : "No hay inspecciones para los próximos 7 días."} next="todo está al día." />
        ) : (
          <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-line)]">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <caption className="sr-only">{view === "overdue" ? "Inspecciones vencidas" : "Inspecciones próximas"}</caption>
              <thead className={THEAD}>
                <tr>
                  <th scope="col" className={th}>Vence</th>
                  <th scope="col" className={th}>Activo</th>
                  <th scope="col" className={th}>Sede</th>
                  <th scope="col" className={th}>
                    <span className="sr-only">Acción</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-line)]">
                {due.items.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 tabular-nums">{formatDateEs(p.dueIso)}</td>
                    <td className="px-4 py-3">
                      <span className="font-medium">{p.asset?.code ?? p.template.name}</span>
                      <span className="block text-xs text-[var(--color-ink-muted)]">{p.asset?.description ?? p.template.name}</span>
                    </td>
                    <td className="px-4 py-3">{p.site.name}</td>
                    <td className="px-4 py-3 text-right">
                      {canWrite && p.asset ? (
                        <form action={startInspectionAction.bind(null, slug, p.asset.id)}>
                          <Button type="submit" variant="secondary" className="min-h-10">
                            Inspeccionar
                          </Button>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}

      {page ? (
        page.items.length === 0 ? (
          <EmptyState
            what={filtered ? "Ninguna inspección coincide con el filtro." : "Todavía no hay inspecciones."}
            next={filtered ? "probá con otro filtro o limpialo." : canWrite ? "cargá los activos que vas a controlar y empezá la primera inspección." : "cuando se haga la primera, la vas a ver acá."}
            action={filtered ? undefined : { href: `/t/${slug}/assets`, label: "Ir a Activos" }}
          />
        ) : (
          <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-line)]">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <caption className="sr-only">Inspecciones de la empresa</caption>
              <thead className={THEAD}>
                <tr>
                  <th scope="col" className={th}>Fecha</th>
                  <th scope="col" className={th}>Activo</th>
                  <th scope="col" className={th}>Sede</th>
                  <th scope="col" className={th}>Inspector</th>
                  <th scope="col" className={th}>Resultado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-line)]">
                {page.items.map((i) => (
                  <tr key={i.id}>
                    <td className="px-4 py-3 tabular-nums">{formatDateEs(isoFromDate(i.inspectedAt))}</td>
                    <td className="px-4 py-3">
                      <Link href={`${base}/${i.id}`} className="font-medium text-[var(--color-accent)] hover:underline">
                        {i.asset?.code ?? i.template.name}
                      </Link>
                      <span className="block text-xs text-[var(--color-ink-muted)]">{i.template.name}</span>
                    </td>
                    <td className="px-4 py-3">{i.site.name}</td>
                    <td className="px-4 py-3">{i.inspectorName}</td>
                    <td className="px-4 py-3">{i.result ? <StatusChip status={RESULT_CHIP[i.result]} label={RESULT_LABELS[i.result]} /> : <StatusChip status="pending" label="Borrador" />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}

      {(due?.nextCursor ?? page?.nextCursor) ? (
        <p>
          <Link href={`${base}?${query({ despues: (due?.nextCursor ?? page?.nextCursor)! })}`} className={buttonClass("ghost")}>
            Ver las siguientes
          </Link>
        </p>
      ) : null}
      <p className="text-xs text-[var(--color-ink-muted)]">La exportación respeta los filtros y llega hasta {MAX_EXPORT_ROWS.toLocaleString("es-AR")} filas: si hay más, afiná el filtro.</p>
    </SectionBlock>
  );
}
