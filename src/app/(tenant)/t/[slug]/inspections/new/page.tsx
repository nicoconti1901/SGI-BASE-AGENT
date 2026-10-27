import Link from "next/link";
import { notFound } from "next/navigation";
import { getAsset, searchAssets } from "@/lib/assets";
import { listSiteSchedule } from "@/lib/inspection-sites";
import { formatDateEs } from "@/domain/inspections/dates";
import { loadInspectionsAccess } from "@/app/(tenant)/t/[slug]/inspections/access";
import { setSiteScheduleAction, startInspectionAction, startSiteInspectionAction } from "@/app/(tenant)/t/[slug]/inspections/actions";
import { AssetStatusChip } from "@/app/(tenant)/t/[slug]/assets/status";
import { startPreUseInspectionAction } from "@/app/(tenant)/t/[slug]/inspections/actions";
import { getAssetType } from "@/domain/inspections/asset-types";
import { assetTypeLabel } from "@/domain/inspections/asset-types";
import { Button, EmptyState, Field, FormError, INPUT_CLASS, SectionBlock, StatusChip } from "@/components/ui";

export default async function NewInspectionPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ q?: string; sq?: string; assetId?: string; error?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const { tenant, canWrite, canManageAssets } = await loadInspectionsAccess(slug);
  if (!canWrite) notFound();

  // Con un activo elegido (desde su ficha) se ofrece empezar; la búsqueda por código alcanza para el resto.
  const q = sp.q?.trim();
  const sq = sp.sq?.trim();
  const [assets, chosen, sites] = await Promise.all([
    searchAssets(tenant.id, { q: q || undefined, take: 20 }),
    sp.assetId ? getAsset(tenant.id, sp.assetId) : Promise.resolve(null),
    listSiteSchedule(tenant.id, { q: sq || undefined }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <p>
        <Link href={`/t/${slug}/inspections`} className="text-sm font-medium text-[var(--color-accent)] hover:underline">
          ← Volver a inspecciones
        </Link>
      </p>
      <SectionBlock title="Nueva inspección" eyebrow="Paso 1 · Qué se inspecciona" what="Elegí el activo por su código. El listado de control se arma solo según el tipo.">
        {sp.error ? <FormError>{sp.error}</FormError> : null}

        {chosen && chosen.status !== "retired" ? (
          <form action={startInspectionAction.bind(null, slug, chosen.id)} className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--color-accent)] p-4">
            <p>
              <span className="font-[family-name:var(--font-mono)] font-semibold">{chosen.code}</span> · {chosen.description}
              <span className="block text-sm text-[var(--color-ink-muted)]">{chosen.site.name}</span>
            </p>
            <div>
              <Button type="submit" className="min-h-12 w-full sm:w-auto">
                Empezar la inspección
              </Button>
            </div>
          </form>
        ) : null}
        {chosen && chosen.status !== "retired" && getAssetType(chosen.typeKey).preUseTemplateKey ? (
          <form action={startPreUseInspectionAction.bind(null, slug, chosen.id)} className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--color-line)] p-4">
            <p className="text-sm text-[var(--color-ink-muted)]">Antes de usar el equipo: un control corto, sin calendario.</p>
            <div>
              <Button type="submit" variant="secondary" className="min-h-12 w-full sm:w-auto">
                Control previo al uso
              </Button>
            </div>
          </form>
        ) : null}

        <form method="get" className="flex flex-wrap items-end gap-3">
          <div className="min-w-[14rem] flex-1">
            <Field label="Buscar activo" hint="Por código o descripción.">
              <input name="q" defaultValue={q ?? ""} placeholder="Ej.: EXT-014" autoComplete="off" className={`${INPUT_CLASS} min-h-12`} />
            </Field>
          </div>
          <Button type="submit" variant="secondary" className="min-h-12">
            Buscar
          </Button>
        </form>

        {assets.length === 0 ? (
          <EmptyState what={q ? "Ningún activo coincide con la búsqueda." : "Todavía no hay activos para inspeccionar."} next={q ? "probá con otro código." : "cargá los activos primero."} action={q ? undefined : { href: `/t/${slug}/assets`, label: "Ir a Activos" }} />
        ) : (
          <ul className="flex flex-col gap-2">
            {assets.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-line)] p-3">
                <div className="min-w-0">
                  <p className="font-[family-name:var(--font-mono)] font-semibold">{a.code}</p>
                  <p className="truncate text-sm text-[var(--color-ink-muted)]">
                    {assetTypeLabel(a.typeKey)} · {a.description} · {a.site.name}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <AssetStatusChip status={a.status} />
                  <form action={startInspectionAction.bind(null, slug, a.id)}>
                    <Button type="submit" className="min-h-12" aria-label={`Inspeccionar ${a.code}`}>
                      Inspeccionar
                    </Button>
                  </form>
                  {getAssetType(a.typeKey).preUseTemplateKey ? (
                    <form action={startPreUseInspectionAction.bind(null, slug, a.id)}>
                      <Button type="submit" variant="secondary" className="min-h-12" aria-label={`Control previo al uso de ${a.code}`}>
                        Control previo
                      </Button>
                    </form>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionBlock>
      <SectionBlock title="Zona de obradores" eyebrow="O un área, sin activo" what="Se inspecciona por sede, una vez por semana. Programá la sede para que el sistema avise cuando toca.">
        <form method="get" className="flex flex-wrap items-end gap-3" aria-label="Buscar sede">
          {q ? <input type="hidden" name="q" value={q} /> : null}
          <div className="min-w-[14rem] flex-1">
            <Field label="Buscar sede">
              <input name="sq" defaultValue={sq ?? ""} placeholder="Ej.: Obra Norte" autoComplete="off" className={`${INPUT_CLASS} min-h-12`} />
            </Field>
          </div>
          <Button type="submit" variant="secondary" className="min-h-12">
            Buscar sede
          </Button>
        </form>
        {sites.length === 0 ? (
          <EmptyState what={sq ? "Ninguna sede coincide con la búsqueda." : "Todavía no hay sedes."} next={sq ? "probá con otro nombre." : "cargalas en Datos maestros."} />
        ) : (
          <ul className="flex flex-col gap-2">
            {sites.map((site) => (
              <li key={site.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-line)] p-3">
                <div className="min-w-0">
                  <p className="font-semibold">{site.name}</p>
                  <p className="text-sm text-[var(--color-ink-muted)]">
                    {site.scheduled ? `Próxima inspección: ${site.nextDueAt ? formatDateEs(site.nextDueAt) : "sin fecha"}` : "Sin programar"}
                    {site.lastInspectedAt ? ` · última: ${formatDateEs(site.lastInspectedAt)}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {site.overdue ? <StatusChip status="overdue" label="Vencida" /> : null}
                  {canManageAssets ? (
                    <form action={setSiteScheduleAction.bind(null, slug, site.id, !site.scheduled)}>
                      <Button type="submit" variant="secondary" className="min-h-12" aria-label={`${site.scheduled ? "Quitar del programa" : "Programar"} la zona de obradores de ${site.name}`}>
                        {site.scheduled ? "Quitar del programa" : "Programar"}
                      </Button>
                    </form>
                  ) : null}
                  <form action={startSiteInspectionAction.bind(null, slug, site.id)}>
                    <Button type="submit" className="min-h-12" aria-label={`Inspeccionar la zona de obradores de ${site.name}`}>
                      Inspeccionar
                    </Button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionBlock>
    </div>
  );
}
