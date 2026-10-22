import Link from "next/link";
import { loadTrainingAccess } from "@/app/(tenant)/t/[slug]/training/access";
import { getComplianceBySite, getExpiryBuckets, getTopMissingCourses, trainingToday } from "@/lib/training";
import { listSites } from "@/lib/masterdata";
import { SitePicker } from "@/components/pickers/SitePicker";
import { Button, EmptyState, SectionBlock, StatGrid, StatTile, StatusChip, buttonClass } from "@/components/ui";

export default async function TrainingHomePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ sede?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const { tenant, canRecord } = await loadTrainingAccess(slug);
  const today = trainingToday();
  const scope = { today, siteId: sp.sede || undefined };
  const [sites, bySite, buckets, missing] = await Promise.all([
    listSites(tenant.id),
    getComplianceBySite(tenant.id, scope),
    getExpiryBuckets(tenant.id, scope),
    getTopMissingCourses(tenant.id, scope, 5),
  ]);
  const base = `/t/${slug}/training`;
  const siteName = new Map(sites.map((s) => [s.id, s.name]));
  const expiry = new Map(buckets.map((b) => [b.siteId, b]));
  const rows = bySite
    .map((s) => {
      const total = s.valid + s.expiring + s.expired + s.missing + s.inGrace;
      return { ...s, total, percent: total === 0 ? null : Math.round(((s.valid + s.expiring) / total) * 100), expiry: expiry.get(s.siteId) };
    })
    .sort((x, y) => (siteName.get(x.siteId) ?? "").localeCompare(siteName.get(y.siteId) ?? "", "es"));

  return (
    <div className="flex flex-col gap-6">
      <SectionBlock
        title="Cumplimiento por sede"
        what="Cuántos cursos obligatorios tiene al día el personal de cada sede. Se calcula solo con la matriz y los registros."
        next={rows.length === 0 ? "definí en Requisitos qué curso se le exige a cada puesto o tarea." : "tocá un número para ver quién es."}
        actions={
          canRecord ? (
            <Link href={`${base}/sessions/new`} className={buttonClass("primary")}>
              Registrar sesión
            </Link>
          ) : undefined
        }
      >
        <form method="get" className="flex flex-wrap items-end gap-3">
          <SitePicker sites={sites.map((s) => ({ id: s.id, name: s.name }))} name="sede" label="Sede" defaultValue={sp.sede ?? ""} allLabel="Todas" />
          <Button type="submit" variant="secondary">
            Filtrar
          </Button>
        </form>

        {rows.length === 0 ? (
          <EmptyState
            what="Todavía no hay cursos obligatorios que medir."
            next="cargá los cursos y marcá a quién se le exigen."
            action={{ href: `${base}/requirements`, label: "Ir a Requisitos" }}
          />
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {rows.map((s) => {
              const filter = (status: string) => `${base}/compliance?sede=${s.siteId}&estado=${status}`;
              const tone = s.percent === null ? "pending" : s.percent >= 90 ? "ok" : s.percent >= 70 ? "warning" : "danger";
              return (
                <li key={s.siteId} className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--color-line)] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-[family-name:var(--font-display)] text-base font-semibold">
                      <Link href={`${base}/compliance?sede=${s.siteId}`} className="hover:underline">
                        {siteName.get(s.siteId) ?? "Sede"}
                      </Link>
                    </h3>
                    <StatusChip status={tone} label={s.percent === null ? "Sin datos" : `${s.percent} % al día`} />
                  </div>
                  <p className="text-xs text-[var(--color-ink-muted)]">{s.people} persona(s) · {s.total} curso(s) obligatorio(s) medidos</p>
                  <StatGrid cols={4} aria-label={`Estados en ${siteName.get(s.siteId) ?? "la sede"}`}>
                    <Link href={filter("expired")} className="block hover:bg-[var(--color-surface-sunken)]">
                      <StatTile label="Vencidas" value={s.expired} tone={s.expired > 0 ? "danger" : "default"} />
                    </Link>
                    <Link href={filter("missing")} className="block hover:bg-[var(--color-surface-sunken)]">
                      <StatTile label="Faltan" value={s.missing} tone={s.missing > 0 ? "warning" : "default"} />
                    </Link>
                    <Link href={filter("expiring")} className="block hover:bg-[var(--color-surface-sunken)]">
                      <StatTile label="Por vencer" value={s.expiring} />
                    </Link>
                    <Link href={filter("in_grace")} className="block hover:bg-[var(--color-surface-sunken)]">
                      <StatTile label="En plazo" value={s.inGrace} />
                    </Link>
                  </StatGrid>
                  <p className="text-sm">
                    <span className="font-semibold">Vencen en:</span> 30 días {s.expiry?.in30 ?? 0} · 60 días {s.expiry?.in60 ?? 0} · 90 días {s.expiry?.in90 ?? 0}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </SectionBlock>

      {missing.length > 0 ? (
        <SectionBlock title="Los cursos que más faltan" what="Obligatorios faltantes o vencidos, por cantidad de personas.">
          <ol className="divide-y divide-[var(--color-line)] rounded-[var(--radius-md)] border border-[var(--color-line)] text-sm">
            {missing.map((c) => (
              <li key={c.courseId} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="font-medium">{c.name}</span>
                <span className="tabular-nums text-[var(--color-ink-muted)]">{c.people} persona(s)</span>
              </li>
            ))}
          </ol>
        </SectionBlock>
      ) : null}
    </div>
  );
}
