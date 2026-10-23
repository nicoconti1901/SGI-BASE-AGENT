import Link from "next/link";
import { Button, EmptyState, Field, INPUT_CLASS, PageHeader, SectionBlock, StatGrid, StatTile, StatusChip, buttonClass } from "@/components/ui";
import { SitePicker } from "@/components/pickers/SitePicker";
import { listSites } from "@/lib/masterdata";
import { getSupplierCounts, listSupplierCategories, listSuppliers, type SupplierFilters, type SupplierView } from "@/lib/suppliers";
import { loadSupplierAccess } from "@/app/(tenant)/t/[slug]/suppliers/access";
import { SemaphoreChip } from "@/app/(tenant)/t/[slug]/suppliers/SemaphoreChip";
import { formatCuit } from "@/domain/suppliers/cuit";
import { buenosAiresToday, isoDay } from "@/domain/suppliers/dates";
import { describeAttention, isEnabled } from "@/domain/suppliers/status";
import {
  SUPPLIER_CRITICALITIES,
  SUPPLIER_CRITICALITY_LABELS,
  SUPPLIER_STATUSES,
  SUPPLIER_STATUS_LABELS,
  SUPPLIER_TYPES,
  SUPPLIER_TYPE_LABELS,
  type SupplierCriticalityValue,
  type SupplierStatusValue,
  type SupplierTypeValue,
} from "@/domain/suppliers/types";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const VIEWS: { key: SupplierView; label: string }[] = [
  { key: "attention", label: "Requieren atención" },
  { key: "all", label: "Todos" },
  { key: "red", label: "Rojos" },
  { key: "amber", label: "Ámbar" },
  { key: "unrated", label: "Sin evaluar" },
  { key: "approved", label: "Aprobados vigentes" },
];

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const oneOf = <T extends string>(value: string, allowed: readonly T[]): T | undefined => allowed.find((a) => a === value);

const dmy = (date: Date) => isoDay(date).split("-").reverse().join("/");

export default async function SuppliersPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: SearchParams }) {
  const { slug } = await params;
  const sp = await searchParams;
  const { tenant, canManage } = await loadSupplierAccess(slug);
  const now = new Date();
  const today = buenosAiresToday(now);

  const [counts, categories, sites] = await Promise.all([
    getSupplierCounts(tenant.id, now),
    listSupplierCategories(tenant.id),
    listSites(tenant.id),
  ]);

  // Vista inicial: «Requieren atención» si hay alguno; si no, «Todos».
  const requested = oneOf(first(sp.vista), VIEWS.map((v) => v.key));
  const view: SupplierView = requested ?? (counts.red + counts.amber > 0 ? "attention" : "all");
  const filters: SupplierFilters = {
    view,
    status: oneOf<SupplierStatusValue>(first(sp.estado), SUPPLIER_STATUSES),
    criticality: oneOf<SupplierCriticalityValue>(first(sp.criticidad), SUPPLIER_CRITICALITIES),
    type: oneOf<SupplierTypeValue>(first(sp.tipo), SUPPLIER_TYPES),
    category: first(sp.rubro) || undefined,
    siteId: first(sp.sede) || undefined,
    notEnabled: first(sp.nohab) === "1",
    q: first(sp.q) || undefined,
  };
  const page = await listSuppliers(tenant.id, filters, Number(first(sp.pagina)) || 1, now);

  const base = `/t/${slug}/suppliers`;
  const hasFilters = Boolean(filters.status || filters.criticality || filters.type || filters.category || filters.siteId || filters.notEnabled || filters.q);
  const href = (patch: Record<string, string | number | undefined>) => {
    const query = new URLSearchParams();
    const current: Record<string, string> = {
      vista: view, estado: first(sp.estado), criticidad: first(sp.criticidad), tipo: first(sp.tipo),
      rubro: first(sp.rubro), sede: first(sp.sede), nohab: first(sp.nohab), q: first(sp.q),
    };
    for (const [k, v] of Object.entries({ ...current, ...patch })) if (v !== undefined && v !== "") query.set(k, String(v));
    return `${base}?${query.toString()}`;
  };

  return (
    <>
      <PageHeader
        eyebrow="Proveedores · ISO 9001 §8.4 · ISO 14001 §8.1 · ISO 45001 §8.1.4"
        title="Proveedores"
        purpose="A quién le compra la empresa, por qué confía en cada uno y cuánto control le aplica."
        actions={
          <>
            {canManage ? (
              <Link href={`${base}/new`} className={buttonClass("primary")}>
                Nuevo proveedor
              </Link>
            ) : null}
            {canManage ? (
              <Link href={`${base}/import`} className={buttonClass("secondary")}>
                Importar CSV
              </Link>
            ) : null}
            <Link href={`${base}/approved`} className={buttonClass("secondary")}>
              Lista de aprobados
            </Link>
            <Link href={`${base}/criteria`} className={buttonClass("ghost")}>
              Criterios y documentos
            </Link>
          </>
        }
      />

      {counts.total > 0 ? (
        <StatGrid cols={4} aria-label="Estado de los proveedores">
          <Link href={href({ vista: "red", pagina: undefined })} className="block hover:bg-[var(--color-accent-soft)]">
            <StatTile label="Rojos" value={String(counts.red)} tone={counts.red > 0 ? "danger" : "default"} />
          </Link>
          <Link href={href({ vista: "amber", pagina: undefined })} className="block hover:bg-[var(--color-accent-soft)]">
            <StatTile label="Ámbar" value={String(counts.amber)} tone={counts.amber > 0 ? "warning" : "default"} />
          </Link>
          <Link href={href({ vista: "unrated", pagina: undefined })} className="block hover:bg-[var(--color-accent-soft)]">
            <StatTile label="Sin evaluar" value={String(counts.unrated)} />
          </Link>
          <Link href={href({ vista: "approved", pagina: undefined })} className="block hover:bg-[var(--color-accent-soft)]">
            <StatTile label="Aprobados vigentes" value={String(counts.approved)} />
          </Link>
        </StatGrid>
      ) : null}

      <SectionBlock
        title={`Proveedores (${page.total})`}
        what="Cada proveedor se ve en rojo, ámbar o verde según lo que haya que atender. Lo más urgente va primero."
        next={counts.total === 0 ? undefined : "abrí uno para ver su ficha, o filtrá por estado, criticidad o rubro."}
      >
        {counts.total === 0 ? (
          <EmptyState
            what="Todavía no cargó proveedores."
            next="empiece por los que afectan la calidad, la seguridad o el ambiente."
            action={canManage ? { href: `${base}/new`, label: "Cargar el primero" } : undefined}
          />
        ) : (
          <>
            <nav aria-label="Vistas de la lista" className="flex flex-wrap gap-2">
              {VIEWS.map((v) => (
                <Link
                  key={v.key}
                  href={href({ vista: v.key, pagina: undefined })}
                  aria-current={v.key === view ? "page" : undefined}
                  className={`rounded-[var(--radius-md)] border px-3 py-1.5 text-sm font-semibold ${
                    v.key === view
                      ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent-ink)]"
                      : "border-[var(--color-line)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
                  }`}
                >
                  {v.label}
                </Link>
              ))}
            </nav>

            <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <input type="hidden" name="vista" value={view} />
              <div className="sm:col-span-2">
                <Field label="Buscar" hint="Por razón social o CUIT.">
                  <input name="q" defaultValue={first(sp.q)} placeholder="Ej.: Montajes del Sur o 30-50001091-2" className={INPUT_CLASS} />
                </Field>
              </div>
              <Field label="Estado">
                <select name="estado" defaultValue={filters.status ?? ""} className={INPUT_CLASS}>
                  <option value="">Todos</option>
                  {SUPPLIER_STATUSES.map((s) => (
                    <option key={s} value={s}>{SUPPLIER_STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </Field>
              <Field label="Criticidad">
                <select name="criticidad" defaultValue={filters.criticality ?? ""} className={INPUT_CLASS}>
                  <option value="">Todas</option>
                  {SUPPLIER_CRITICALITIES.map((c) => (
                    <option key={c} value={c}>{SUPPLIER_CRITICALITY_LABELS[c]}</option>
                  ))}
                </select>
              </Field>
              <Field label="Tipo">
                <select name="tipo" defaultValue={filters.type ?? ""} className={INPUT_CLASS}>
                  <option value="">Todos</option>
                  {SUPPLIER_TYPES.map((t) => (
                    <option key={t} value={t}>{SUPPLIER_TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </Field>
              <Field label="Rubro">
                <select name="rubro" defaultValue={filters.category ?? ""} className={INPUT_CLASS}>
                  <option value="">Todos</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <SitePicker sites={sites.map((s) => ({ id: s.id, name: s.name }))} name="sede" label="Sede" hint="Incluye a quienes atienden todas." defaultValue={first(sp.sede)} allLabel="Todas" />
              <label className="flex items-end gap-2 pb-2 text-sm">
                <input type="checkbox" name="nohab" value="1" defaultChecked={filters.notEnabled} className="h-4 w-4 accent-[var(--color-accent)]" />
                <span className="font-semibold">Solo no habilitados</span>
              </label>
              <div className="flex items-end gap-2">
                <Button type="submit" variant="secondary">Filtrar</Button>
                {hasFilters ? (
                  <Link href={href({ estado: "", criticidad: "", tipo: "", rubro: "", sede: "", nohab: "", q: "", pagina: undefined })} className={buttonClass("ghost")}>
                    Limpiar
                  </Link>
                ) : null}
              </div>
            </form>

            {page.items.length === 0 ? (
              <EmptyState
                what="Ningún proveedor coincide con lo que pidió."
                next={view === "attention" ? "no hay nada que atender ahora: revisá «Todos»." : "probá con otra vista o limpiá los filtros."}
                action={{ href: href({ vista: "all", estado: "", criticidad: "", tipo: "", rubro: "", sede: "", nohab: "", q: "", pagina: undefined }), label: "Ver todos" }}
              />
            ) : (
              <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-line)]">
                <table className="w-full min-w-[56rem] text-left text-sm">
                  <caption className="sr-only">Proveedores de la empresa</caption>
                  <thead className="border-b border-[var(--color-line)] bg-[var(--color-surface-sunken)] font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.06em] text-[var(--color-ink-muted)]">
                    <tr>
                      <th scope="col" className="px-4 py-2.5 font-semibold">Semáforo</th>
                      <th scope="col" className="px-4 py-2.5 font-semibold">Razón social</th>
                      <th scope="col" className="px-4 py-2.5 font-semibold">Tipo</th>
                      <th scope="col" className="px-4 py-2.5 font-semibold">Criticidad</th>
                      <th scope="col" className="px-4 py-2.5 font-semibold">Último puntaje</th>
                      <th scope="col" className="px-4 py-2.5 font-semibold">Próxima atención</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-line)]">
                    {page.items.map((s) => {
                      const enabled = isEnabled(s.status, s.missingBlockingDocs, s.blockingDocExpiresAt, today);
                      const activeStatus = s.status === "approved" || s.status === "conditional";
                      return (
                        <tr key={s.id}>
                          <td className="px-4 py-3">
                            <SemaphoreChip status={s.status} attentionAt={s.attentionAt} missingRequiredDocs={s.missingRequiredDocs} today={today} />
                          </td>
                          <td className="px-4 py-3">
                            <Link href={`${base}/${s.id}`} className="font-medium text-[var(--color-accent)] hover:underline">
                              {s.legalName}
                            </Link>
                            <span className="block text-xs text-[var(--color-ink-muted)]">
                              <span className="tabular-nums">{s.taxId ? formatCuit(s.taxId) : "Sin CUIT"}</span>
                              {s.category ? ` · ${s.category}` : ""}
                            </span>
                            {activeStatus && !enabled ? (
                              <span className="mt-1 inline-block">
                                <StatusChip status="danger" label="No habilitado" />
                              </span>
                            ) : null}
                          </td>
                          <td className="px-4 py-3">{SUPPLIER_TYPE_LABELS[s.type]}</td>
                          <td className="px-4 py-3">{SUPPLIER_CRITICALITY_LABELS[s.criticality]}</td>
                          <td className="px-4 py-3 tabular-nums">
                            {s.lastScore !== null ? (
                              <>
                                {s.lastScore.toFixed(1).replace(".", ",")}
                                {s.lastEvaluatedAt ? <span className="block text-xs text-[var(--color-ink-muted)]">{dmy(s.lastEvaluatedAt)}</span> : null}
                              </>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-4 py-3 text-[var(--color-ink-muted)]">
                            {describeAttention({ ...s, today }) || "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {page.pages > 1 ? (
              <nav aria-label="Paginación" className="flex items-center justify-between gap-3 text-sm">
                <span className="text-[var(--color-ink-muted)]">
                  Página {page.page} de {page.pages} · {page.total} proveedores
                </span>
                <span className="flex gap-2">
                  {page.page > 1 ? (
                    <Link href={href({ pagina: page.page - 1 })} className={buttonClass("secondary")}>Anterior</Link>
                  ) : null}
                  {page.page < page.pages ? (
                    <Link href={href({ pagina: page.page + 1 })} className={buttonClass("secondary")}>Siguiente</Link>
                  ) : null}
                </span>
              </nav>
            ) : null}
          </>
        )}
      </SectionBlock>
    </>
  );
}
