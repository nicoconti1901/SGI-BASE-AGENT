import Link from "next/link";
import type { AssetStatus } from "@prisma/client";
import { listAssets } from "@/lib/assets";
import { listSites } from "@/lib/masterdata";
import { SitePicker } from "@/components/pickers/SitePicker";
import { loadInspectionsAccess } from "@/app/(tenant)/t/[slug]/inspections/access";
import { AssetStatusChip, ComplianceChip } from "@/app/(tenant)/t/[slug]/assets/status";
import { ASSET_TYPES, assetTypeLabel } from "@/domain/inspections/asset-types";
import { Button, EmptyState, Field, INPUT_CLASS, SectionBlock, buttonClass } from "@/components/ui";

type SearchParams = Promise<{ q?: string; sede?: string; estado?: string; tipo?: string; despues?: string }>;

const STATUSES = new Set(["in_service", "out_of_service", "retired", "all"]);

export default async function AssetsPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: SearchParams }) {
  const { slug } = await params;
  const sp = await searchParams;
  const { tenant, canManageAssets, canImportAssets } = await loadInspectionsAccess(slug);
  const status = sp.estado && STATUSES.has(sp.estado) ? (sp.estado as AssetStatus | "all") : "all";
  const [page, sites] = await Promise.all([
    listAssets(tenant.id, { q: sp.q, siteId: sp.sede || undefined, typeKey: sp.tipo || undefined, status, after: sp.despues }),
    listSites(tenant.id),
  ]);
  const base = `/t/${slug}/assets`;
  const filtered = Boolean(sp.q || sp.sede || sp.tipo || (sp.estado && sp.estado !== "all"));
  const nextHref = page.nextCursor
    ? `${base}?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(sp.sede ? { sede: sp.sede } : {}), ...(sp.tipo ? { tipo: sp.tipo } : {}), ...(sp.estado ? { estado: sp.estado } : {}), despues: page.nextCursor })}`
    : null;

  return (
    <SectionBlock
      title={`Activos (${page.total})`}
      what="Cada equipo con su estado, su sede y sus vencimientos. Un activo con inspecciones no se borra: se da de baja."
      next={canManageAssets ? "registrá el primero o importá varios desde un CSV." : "consultá el estado de cada equipo."}
      actions={
        canManageAssets ? (
          <>
            <Link href={`${base}/new`} className={buttonClass("primary")}>
              Registrar activo
            </Link>
            {canImportAssets ? (
              <Link href={`${base}/import`} className={buttonClass("secondary")}>
                Importar CSV
              </Link>
            ) : null}
          </>
        ) : undefined
      }
    >
      <form method="get" className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_1fr_auto] sm:items-end">
        <Field label="Buscar" hint="Por código o descripción.">
          <input name="q" defaultValue={sp.q ?? ""} placeholder="Ej.: EXT-014" className={INPUT_CLASS} />
        </Field>
        <Field label="Tipo">
          <select name="tipo" defaultValue={sp.tipo ?? ""} className={INPUT_CLASS}>
            <option value="">Todos</option>
            {Object.values(ASSET_TYPES).map((t) => (
              <option key={t.key} value={t.key}>
                {t.plural}
              </option>
            ))}
          </select>
        </Field>
        <SitePicker sites={sites.map((s) => ({ id: s.id, name: s.name }))} name="sede" label="Sede" defaultValue={sp.sede ?? ""} allLabel="Todas" />
        <Field label="Estado">
          <select name="estado" defaultValue={status} className={INPUT_CLASS}>
            <option value="all">Todos</option>
            <option value="in_service">En servicio</option>
            <option value="out_of_service">Fuera de servicio</option>
            <option value="retired">Dados de baja</option>
          </select>
        </Field>
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
      </form>

      {page.items.length === 0 ? (
        <EmptyState
          what={filtered ? "Ningún activo coincide con el filtro." : "Todavía no hay activos."}
          next={filtered ? "probá con otra búsqueda o limpiá el filtro." : canManageAssets ? "importá un CSV o creá el primero." : "pedile al administrador que los cargue."}
          action={canManageAssets && !filtered ? { href: `${base}/new`, label: "Registrar activo" } : undefined}
        />
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-line)]">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <caption className="sr-only">Activos de la empresa</caption>
            <thead className="border-b border-[var(--color-line)] bg-[var(--color-surface-sunken)] font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.06em] text-[var(--color-ink-muted)]">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-semibold">Código</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Descripción</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Tipo</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Sede</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Estado</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Vencimientos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-line)]">
              {page.items.map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-3 font-[family-name:var(--font-mono)] tabular-nums">
                    <Link href={`${base}/${a.id}`} className="font-medium text-[var(--color-accent)] hover:underline">
                      {a.code}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{a.description}</td>
                  <td className="px-4 py-3">{assetTypeLabel(a.typeKey)}</td>
                  <td className="px-4 py-3">
                    {a.site.name}
                    {a.sector ? <span className="block text-xs text-[var(--color-ink-muted)]">{a.sector}</span> : null}
                  </td>
                  <td className="px-4 py-3">
                    <AssetStatusChip status={a.status} />
                  </td>
                  <td className="px-4 py-3">{a.status === "retired" ? "—" : <ComplianceChip compliance={a.compliance} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {nextHref ? (
        <p>
          <Link href={nextHref} className={buttonClass("ghost")}>
            Ver los siguientes
          </Link>
        </p>
      ) : null}
    </SectionBlock>
  );
}
