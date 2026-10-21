import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { EmptyState, EntityList, EntityRow, HintCallout, PageFrame, PageHeader, StatusChip, buttonClass, type ChipStatus } from "@/components/ui";
import { getAppSessionContext } from "@/lib/session";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { getMembership } from "@/lib/identity";
import { listIncidents } from "@/lib/safety-stats";
import { canReportIncident } from "@/domain/safety-stats/access";
import { CLASSIFICATION_LABELS, SAFETY_TIME_ZONE, isClassification } from "@/domain/safety-stats/types";

const CLASSIFICATION_CHIP: Record<string, ChipStatus> = {
  near_miss: "info",
  first_aid: "ok",
  no_lost_time: "warning",
  lost_time: "danger",
  fatal: "overdue",
  occupational_disease: "warning",
};

export default async function SafetyPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string; clasificacion?: string }>;
}) {
  const ctx = await getAppSessionContext();
  if (!ctx) redirect("/login");
  const { slug } = await params;
  const query = await searchParams;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();
  const membership = await getMembership(ctx.userId, tenant.id);

  const classification = query.clasificacion && isClassification(query.clasificacion) ? query.clasificacion : undefined;
  const { items, total, page, pageSize } = await listIncidents({
    tenantId: tenant.id,
    page: Number(query.page) || 1,
    classification,
  });
  const canReport = canReportIncident({ role: membership?.role, isPlatformSuperuser: ctx.isPlatformSuperuser });
  const base = `/t/${slug}/safety`;
  const pages = Math.max(Math.ceil(total / pageSize), 1);
  const href = (p: number) => `${base}?page=${p}${classification ? `&clasificacion=${classification}` : ""}`;

  return (
    <PageFrame>
      <PageHeader
        eyebrow="ISO 45001 · §9.1.1 · §10.2"
        title="Accidentabilidad"
        purpose="Cada accidente se registra una sola vez, como un hallazgo de tipo incidente con su ficha."
        actions={
          canReport ? (
            <Link href={`/t/${slug}/findings/new?type=incident`} className={buttonClass("primary")}>
              Registrar accidente
            </Link>
          ) : null
        }
      />
      <HintCallout>Las fichas incluyen datos de salud. Cada consulta de una ficha queda registrada con quién la hizo y cuándo.</HintCallout>

      <nav aria-label="Filtrar por clasificación" className="flex flex-wrap gap-2 text-sm">
        <Link href={base} aria-current={!classification ? "page" : undefined} className={buttonClass(!classification ? "secondary" : "ghost", "min-h-9")}>
          Todos
        </Link>
        {Object.entries(CLASSIFICATION_LABELS).map(([key, label]) => (
          <Link
            key={key}
            href={`${base}?clasificacion=${key}`}
            aria-current={classification === key ? "page" : undefined}
            className={buttonClass(classification === key ? "secondary" : "ghost", "min-h-9")}
          >
            {label}
          </Link>
        ))}
      </nav>

      {items.length === 0 ? (
        <EmptyState
          what="Todavía no hay accidentes registrados."
          next={canReport ? "registrá el primero: se da de alta como un hallazgo de tipo incidente." : "cuando alguien registre un accidente, lo vas a ver acá."}
          action={canReport ? { href: `/t/${slug}/findings/new?type=incident`, label: "Registrar accidente" } : undefined}
        />
      ) : (
        <>
          <EntityList aria-label="Accidentes registrados">
            {items.map((i) => (
              <EntityRow
                key={i.id}
                href={`/t/${slug}/findings/${i.findingId}`}
                kind={CLASSIFICATION_LABELS[i.classification]}
                title={i.title}
                meta={`${i.siteName} · ${i.occurredAt.toLocaleDateString("es-AR", { timeZone: SAFETY_TIME_ZONE })}${i.inItinere ? " · en el trayecto" : ""}`}
                chip={
                  <span className="flex flex-wrap gap-2">
                    {i.findingStatus === "draft" ? <StatusChip status="pending" label="Borrador" /> : null}
                    {i.open ? <StatusChip status="danger" label={`Sigue de baja · ${i.lostDays} d`} /> : null}
                    {i.healthMissing ? <StatusChip status="warning" label="Falta ficha de salud" /> : null}
                    {!i.open && !i.healthMissing ? <StatusChip status={CLASSIFICATION_CHIP[i.classification]} label={CLASSIFICATION_LABELS[i.classification]} /> : null}
                  </span>
                }
              />
            ))}
          </EntityList>
          <nav aria-label="Paginación" className="flex items-center justify-between text-sm text-[var(--color-ink-muted)]">
            <span>
              Página {page} de {pages} · {total} accidente(s)
            </span>
            <span className="flex gap-2">
              {page > 1 ? (
                <Link href={href(page - 1)} className={buttonClass("ghost", "min-h-9")}>
                  Anterior
                </Link>
              ) : null}
              {page < pages ? (
                <Link href={href(page + 1)} className={buttonClass("ghost", "min-h-9")}>
                  Siguiente
                </Link>
              ) : null}
            </span>
          </nav>
        </>
      )}
    </PageFrame>
  );
}
