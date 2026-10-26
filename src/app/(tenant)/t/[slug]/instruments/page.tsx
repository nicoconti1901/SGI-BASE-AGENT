import Link from "next/link";
import { instrumentCounters, listInstruments, planCompliance, upcomingInstrumentDues, INSTRUMENTS_EXPORT_LIMIT } from "@/lib/instruments";
import { listSites } from "@/lib/masterdata";
import { SitePicker } from "@/components/pickers/SitePicker";
import { loadInstrumentsAccess } from "@/app/(tenant)/t/[slug]/instruments/access";
import { hasInstrumentFilter, instrumentFilterFromParams, type InstrumentSearchParams } from "@/app/(tenant)/t/[slug]/instruments/filters";
import { UsabilityCell } from "@/app/(tenant)/t/[slug]/instruments/status";
import { MAGNITUDES, MAGNITUDE_DEFS, STATUS_GROUPS, STATUS_GROUP_LABELS, magnitudeLabel, type StatusGroup } from "@/domain/calibration";
import { formatDateEs } from "@/domain/inspections/dates";
import { Button, EmptyState, Field, INPUT_CLASS, SectionBlock, StatGrid, StatTile, buttonClass } from "@/components/ui";

const th = "px-4 py-2.5 font-semibold";
const THEAD = "border-b border-[var(--color-line)] bg-[var(--color-surface-sunken)] font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.06em] text-[var(--color-ink-muted)]";

const TILES: { group: StatusGroup; tone: "default" | "danger" | "warning" }[] = [
  { group: "valid", tone: "default" },
  { group: "due_soon", tone: "warning" },
  { group: "unusable", tone: "danger" },
  { group: "in_calibration", tone: "default" },
  { group: "impact_pending", tone: "danger" },
  { group: "not_required", tone: "default" },
];

export default async function InstrumentsPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<InstrumentSearchParams> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const { tenant, canManage } = await loadInstrumentsAccess(slug);
  const base = `/t/${slug}/instruments`;
  const filter = instrumentFilterFromParams(sp);
  // Los contadores respetan sede, magnitud y búsqueda, pero no el estado: son los accesos a cada estado.
  const scope = { q: filter.q, siteId: filter.siteId, magnitude: filter.magnitude };
  const [counters, page, sites, compliance, upcoming] = await Promise.all([
    instrumentCounters(tenant.id, scope),
    listInstruments(tenant.id, filter),
    listSites(tenant.id),
    planCompliance(tenant.id, scope),
    upcomingInstrumentDues(tenant.id, { siteId: filter.siteId }),
  ]);
  const pct = (part: number, whole: number) => (whole === 0 ? "—" : `${Math.round((part / whole) * 100)} %`);

  const query = (extra: Record<string, string | undefined>) => {
    const keep: Record<string, string> = {};
    for (const key of ["q", "sede", "magnitud", "estado"] as const) if (sp[key]) keep[key] = sp[key]!;
    const merged = { ...keep, ...extra };
    const entries = Object.entries(merged).filter((e): e is [string, string] => Boolean(e[1]));
    return new URLSearchParams(entries).toString();
  };
  const filtered = hasInstrumentFilter(filter);

  return (
    <SectionBlock
      title={`Equipos de medición (${counters.total})`}
      what="Cada equipo con su estado de hoy: si se puede usar, cuándo vence y qué falta hacer."
      next={canManage ? "registrá tus equipos de medición y cargá su calibración." : "consultá el estado de cada equipo."}
      actions={
        <>
          {canManage ? (
            <Link href={`${base}/new`} className={buttonClass("primary")}>
              Registrar equipo
            </Link>
          ) : null}
          <a href={`${base}/export?${query({})}`} className={buttonClass("secondary")} download>
            Exportar CSV
          </a>
        </>
      }
    >
      <StatGrid cols={3} aria-label="Estado de los equipos">
        {TILES.map(({ group, tone }) => {
          const count = counters[group];
          const active = filter.group === group;
          return (
            <Link
              key={group}
              href={active ? `${base}?${query({ estado: undefined, pagina: undefined })}` : `${base}?${query({ estado: group, pagina: undefined })}`}
              className="block hover:bg-[var(--color-surface-sunken)]"
              aria-current={active ? "page" : undefined}
              aria-label={`${STATUS_GROUP_LABELS[group]}: ${count}${active ? " (filtro activo, tocá para quitarlo)" : ""}`}
            >
              <StatTile label={STATUS_GROUP_LABELS[group]} value={count} tone={count > 0 ? tone : "default"} />
            </Link>
          );
        })}
      </StatGrid>
      <p className="text-xs text-[var(--color-ink-muted)]">
        «No usar» agrupa los vencidos, los no aptos y los que todavía no tienen su calibración inicial. «Por vencer» avisa con los días de anticipación de cada equipo.
      </p>

      <section aria-label="Plan de calibración y próximos vencimientos" className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">Cumplimiento del plan</h3>
          <StatGrid cols={2} aria-label="Cumplimiento del plan de calibración">
            <StatTile label="Equipos utilizables" value={pct(compliance.usable, compliance.controlled)} tone={compliance.controlled > 0 && compliance.usable < compliance.controlled ? "warning" : "default"} />
            <StatTile label="Recalibrados a tiempo" value={pct(compliance.onTime, compliance.renewals)} tone={compliance.renewals > 0 && compliance.onTime < compliance.renewals ? "warning" : "default"} />
          </StatGrid>
          <p className="text-xs text-[var(--color-ink-muted)]">
            {compliance.usable} de {compliance.controlled} equipos con control se pueden usar hoy. {compliance.onTime} de {compliance.renewals} recalibraciones de los últimos 12 meses se hicieron antes de que venciera la anterior.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">Vencen en los próximos 30 días ({upcoming.total})</h3>
          {upcoming.items.length === 0 ? (
            <p className="text-sm text-[var(--color-ink-muted)]">Ningún equipo vence en los próximos 30 días.</p>
          ) : (
            <ul className="divide-y divide-[var(--color-line)] rounded-[var(--radius-lg)] border border-[var(--color-line)] text-sm">
              {upcoming.items.map((u) => (
                <li key={u.assetId} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5">
                  <span className="min-w-0">
                    <Link href={`${base}/${u.assetId}`} className="font-[family-name:var(--font-mono)] font-medium text-[var(--color-accent)] hover:underline">
                      {u.code}
                    </Link>{" "}
                    <span className="text-[var(--color-ink-muted)]">
                      {u.description} · {u.siteName}
                    </span>
                  </span>
                  <span className="tabular-nums">
                    {formatDateEs(u.nextDueAt)} · {u.daysLeft === 0 ? "vence hoy" : u.daysLeft === 1 ? "falta 1 día" : `faltan ${u.daysLeft} días`}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {upcoming.total > upcoming.items.length ? <p className="text-xs text-[var(--color-ink-muted)]">Se muestran los {upcoming.items.length} más próximos. El resto está en «Por vencer».</p> : null}
        </div>
      </section>

      <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end" aria-label="Filtros">
        <Field label="Buscar" hint="Por código o descripción.">
          <input name="q" defaultValue={sp.q ?? ""} placeholder="Ej.: DET-007" className={INPUT_CLASS} />
        </Field>
        <SitePicker sites={sites.map((s) => ({ id: s.id, name: s.name }))} name="sede" label="Sede" defaultValue={sp.sede ?? ""} allLabel="Todas" />
        <Field label="Magnitud">
          <select name="magnitud" defaultValue={filter.magnitude ?? ""} className={INPUT_CLASS}>
            <option value="">Todas</option>
            {MAGNITUDES.map((m) => (
              <option key={m} value={m}>
                {MAGNITUDE_DEFS[m].label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Estado">
          <select name="estado" defaultValue={filter.group ?? ""} className={INPUT_CLASS}>
            <option value="">Todos</option>
            {(Object.keys(STATUS_GROUPS) as StatusGroup[]).map((g) => (
              <option key={g} value={g}>
                {STATUS_GROUP_LABELS[g]}
              </option>
            ))}
          </select>
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

      {page.items.length === 0 ? (
        <EmptyState
          what={filtered ? "Ningún equipo coincide con el filtro." : "Todavía no hay equipos de medición."}
          next={filtered ? "probá con otro filtro o limpialo." : canManage ? "registrá el primero, con su magnitud, su rango y el error máximo que aceptás." : "pedile al administrador que los cargue."}
          action={canManage && !filtered ? { href: `${base}/new`, label: "Registrar equipo" } : undefined}
        />
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-line)]">
          <table className="w-full min-w-[52rem] text-left text-sm">
            <caption className="sr-only">Equipos de medición de la empresa</caption>
            <thead className={THEAD}>
              <tr>
                <th scope="col" className={th}>Código</th>
                <th scope="col" className={th}>Equipo</th>
                <th scope="col" className={th}>Sede</th>
                <th scope="col" className={th}>Responsable</th>
                <th scope="col" className={th}>Estado</th>
                <th scope="col" className={th}>Próximo vencimiento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-line)]">
              {page.items.map((i) => (
                <tr key={i.id}>
                  <td className="px-4 py-3 font-[family-name:var(--font-mono)] tabular-nums">
                    <Link href={`${base}/${i.asset.id}`} className="font-medium text-[var(--color-accent)] hover:underline">
                      {i.asset.code}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {i.asset.description}
                    <span className="block text-xs text-[var(--color-ink-muted)]">{magnitudeLabel(i.magnitude)}</span>
                  </td>
                  <td className="px-4 py-3">{i.asset.site.name}</td>
                  <td className="px-4 py-3">{i.asset.assignedPerson?.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <UsabilityCell status={i.view.status} usability={i.view.usability} />
                  </td>
                  <td className="px-4 py-3 tabular-nums">{i.view.nextDueAt ? formatDateEs(i.view.nextDueAt) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {page.pages > 1 ? (
        <nav aria-label="Páginas" className="flex flex-wrap items-center gap-3 text-sm">
          {page.page > 1 ? (
            <Link href={`${base}?${query({ pagina: String(page.page - 1) })}`} className={buttonClass("ghost")}>
              ← Anteriores
            </Link>
          ) : null}
          <span className="tabular-nums text-[var(--color-ink-muted)]">
            Página {page.page} de {page.pages} · {page.total} equipos
          </span>
          {page.page < page.pages ? (
            <Link href={`${base}?${query({ pagina: String(page.page + 1) })}`} className={buttonClass("ghost")}>
              Siguientes →
            </Link>
          ) : null}
        </nav>
      ) : null}
      <p className="text-xs text-[var(--color-ink-muted)]">
        La exportación respeta los filtros y llega hasta {INSTRUMENTS_EXPORT_LIMIT.toLocaleString("es-AR")} filas. Los equipos dados de baja no se listan.
      </p>
    </SectionBlock>
  );
}
