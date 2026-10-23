import Link from "next/link";
import { EmptyState, EntityList, EntityRow, HintCallout, StatusChip, buttonClass, type ChipStatus } from "@/components/ui";
import { loadSafetyAccess } from "@/app/(tenant)/t/[slug]/safety/access";
import { listIncidents } from "@/lib/safety-stats";
import { CLASSIFICATION_LABELS, SAFETY_TIME_ZONE, isClassification } from "@/domain/safety-stats/types";

const CLASSIFICATION_CHIP: Record<string, ChipStatus> = {
  near_miss: "info",
  first_aid: "ok",
  no_lost_time: "warning",
  lost_time: "danger",
  fatal: "overdue",
  occupational_disease: "warning",
};

type Query = { page?: string; clasificacion?: string; estado?: string };

export default async function SafetyCasesPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Query> }) {
  const { slug } = await params;
  const query = await searchParams;
  const { tenant, canReport } = await loadSafetyAccess(slug);

  const classification = query.clasificacion && isClassification(query.clasificacion) ? query.clasificacion : undefined;
  const state = query.estado === "abiertos" || query.estado === "incompletas" ? query.estado : undefined;
  const { items, total, page, pageSize } = await listIncidents({
    tenantId: tenant.id,
    page: Number(query.page) || 1,
    classification,
    open: state === "abiertos",
    incomplete: state === "incompletas",
  });
  const base = `/t/${slug}/safety`;
  const pages = Math.max(Math.ceil(total / pageSize), 1);
  const filtered = Boolean(classification || state);
  const link = (extra: Query) => {
    const params = new URLSearchParams();
    const merged: Query = { clasificacion: classification, estado: state, ...extra };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  };

  return (
    <>
      <HintCallout>Las fichas incluyen datos de salud. Cada consulta de una ficha queda registrada con quién la hizo y cuándo.</HintCallout>

      <nav aria-label="Filtrar por clasificación" className="flex flex-wrap gap-2 text-sm">
        <Link href={link({ clasificacion: undefined })} aria-current={!classification ? "page" : undefined} className={buttonClass(!classification ? "secondary" : "ghost", "min-h-9")}>
          Todos
        </Link>
        {Object.entries(CLASSIFICATION_LABELS).map(([key, label]) => (
          <Link
            key={key}
            href={link({ clasificacion: key })}
            aria-current={classification === key ? "page" : undefined}
            className={buttonClass(classification === key ? "secondary" : "ghost", "min-h-9")}
          >
            {label}
          </Link>
        ))}
      </nav>
      <nav aria-label="Filtrar por estado del caso" className="flex flex-wrap gap-2 text-sm">
        <Link href={link({ estado: undefined })} aria-current={!state ? "page" : undefined} className={buttonClass(!state ? "secondary" : "ghost", "min-h-9")}>
          Cualquier estado
        </Link>
        <Link href={link({ estado: "abiertos" })} aria-current={state === "abiertos" ? "page" : undefined} className={buttonClass(state === "abiertos" ? "secondary" : "ghost", "min-h-9")}>
          Siguen de baja
        </Link>
        <Link href={link({ estado: "incompletas" })} aria-current={state === "incompletas" ? "page" : undefined} className={buttonClass(state === "incompletas" ? "secondary" : "ghost", "min-h-9")}>
          Falta la ficha de salud
        </Link>
      </nav>

      {items.length === 0 ? (
        <EmptyState
          what={filtered ? "Ningún accidente coincide con el filtro." : "Todavía no hay accidentes registrados."}
          next={
            filtered
              ? "probá con otro filtro."
              : canReport
                ? "registrá el primero: se da de alta como un hallazgo de tipo incidente."
                : "cuando alguien registre un accidente, lo vas a ver acá."
          }
          action={canReport && !filtered ? { href: `/t/${slug}/findings/new?type=incident`, label: "Registrar accidente" } : undefined}
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
                <Link href={link({ page: String(page - 1) })} className={buttonClass("ghost", "min-h-9")}>
                  Anterior
                </Link>
              ) : null}
              {page < pages ? (
                <Link href={link({ page: String(page + 1) })} className={buttonClass("ghost", "min-h-9")}>
                  Siguiente
                </Link>
              ) : null}
            </span>
          </nav>
        </>
      )}
    </>
  );
}
