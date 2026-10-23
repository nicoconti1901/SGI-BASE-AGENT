import Link from "next/link";
import { loadTrainingAccess } from "@/app/(tenant)/t/[slug]/training/access";
import { listSessions } from "@/lib/training-records";
import { listCourses } from "@/lib/training-config";
import { listSites } from "@/lib/masterdata";
import { SitePicker } from "@/components/pickers/SitePicker";
import { Button, EmptyState, Field, INPUT_CLASS, SectionBlock, StatusChip, buttonClass } from "@/components/ui";

type SearchParams = { curso?: string; sede?: string; despues?: string };

const day = (d: Date) => d.toISOString().slice(0, 10).split("-").reverse().join("/");

export default async function SessionsPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<SearchParams> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const { tenant, canRecord } = await loadTrainingAccess(slug);
  const [page, courses, sites] = await Promise.all([
    listSessions(tenant.id, { courseId: sp.curso || undefined, siteId: sp.sede || undefined, after: sp.despues }),
    listCourses(tenant.id),
    listSites(tenant.id),
  ]);
  const base = `/t/${slug}/training`;
  const filtered = Boolean(sp.curso || sp.sede);
  const nextHref = page.nextCursor ? `${base}/sessions?${new URLSearchParams({ ...(sp.curso ? { curso: sp.curso } : {}), ...(sp.sede ? { sede: sp.sede } : {}), despues: page.nextCursor })}` : null;

  return (
    <SectionBlock
      title="Sesiones"
      what="Cada capacitación dictada, con quiénes asistieron y cómo les fue."
      next={canRecord ? "registrá una sesión con sus asistentes, cargá un certificado externo o importá el histórico." : "consultá las capacitaciones dictadas."}
      actions={
        canRecord ? (
          <>
            <Link href={`${base}/sessions/new`} className={buttonClass("primary")}>
              Nueva sesión
            </Link>
            <Link href={`${base}/sessions/individual`} className={buttonClass("secondary")}>
              Cargar un certificado
            </Link>
            <Link href={`${base}/sessions/import`} className={buttonClass("secondary")}>
              Importar histórico
            </Link>
          </>
        ) : undefined
      }
    >
      <form method="get" className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" aria-label="Filtros">
        <Field label="Curso">
          <select name="curso" defaultValue={sp.curso ?? ""} className={INPUT_CLASS}>
            <option value="">Todos</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <SitePicker sites={sites.map((s) => ({ id: s.id, name: s.name }))} name="sede" label="Sede" defaultValue={sp.sede ?? ""} allLabel="Todas" />
        <div className="flex gap-2">
          <Button type="submit" variant="secondary">
            Filtrar
          </Button>
          {filtered ? (
            <Link href={`${base}/sessions`} className={buttonClass("ghost")}>
              Limpiar
            </Link>
          ) : null}
        </div>
      </form>

      {page.items.length === 0 ? (
        <EmptyState
          what={filtered ? "Ninguna sesión coincide con el filtro." : "Todavía no hay sesiones registradas."}
          next={filtered ? "probá con otro filtro." : canRecord ? "registrá la primera o importá el histórico." : "cuando se dicte una, la vas a ver acá."}
          action={canRecord && !filtered ? { href: `${base}/sessions/new`, label: "Nueva sesión" } : undefined}
        />
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-line)]">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <caption className="sr-only">Sesiones de capacitación</caption>
            <thead className="border-b border-[var(--color-line)] bg-[var(--color-surface-sunken)] font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.06em] text-[var(--color-ink-muted)]">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-semibold">Fecha</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Curso</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Sede</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Asistentes</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Planilla</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-line)]">
              {page.items.map((s) => (
                <tr key={s.id} className={s.voidedAt ? "opacity-60" : ""}>
                  <td className="px-4 py-3 tabular-nums">{day(s.heldAt)}</td>
                  <td className="px-4 py-3">
                    <Link href={`${base}/sessions/${s.id}`} className="font-medium text-[var(--color-accent)] hover:underline">
                      {s.course.name}
                    </Link>
                    {s.voidedAt ? <span className="ml-2"><StatusChip status="pending" label="Anulada" /></span> : null}
                    <span className="block text-xs text-[var(--color-ink-muted)]">{s.instructorName}</span>
                  </td>
                  <td className="px-4 py-3">{s.site?.name ?? "—"}</td>
                  <td className="px-4 py-3 tabular-nums">{s._count.records}</td>
                  <td className="px-4 py-3">{s._count.attachments > 0 ? <StatusChip status="ok" label="Subida" /> : <StatusChip status="warning" label="Sin planilla" />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {nextHref ? (
        <p>
          <Link href={nextHref} className={buttonClass("ghost")}>
            Ver las siguientes
          </Link>
        </p>
      ) : null}
    </SectionBlock>
  );
}
