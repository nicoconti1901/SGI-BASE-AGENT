import Link from "next/link";
import { loadTrainingAccess } from "@/app/(tenant)/t/[slug]/training/access";
import { MATRIX_MAX_COLUMNS, getMatrixPage, trainingToday, type ComplianceCell } from "@/lib/training";
import { listJobPositions, listJobTasks, listSites } from "@/lib/masterdata";
import { SitePicker } from "@/components/pickers/SitePicker";
import { TRAINING_STATUS_LABELS, type TrainingStatus } from "@/domain/training/types";
import { Button, EmptyState, Field, INPUT_CLASS, SectionBlock, StatusChip, buttonClass, type ChipStatus } from "@/components/ui";

type SearchParams = { sede?: string; puesto?: string; tarea?: string; estado?: string; q?: string; despues?: string };

const STATES: Exclude<TrainingStatus, "not_required">[] = ["expired", "missing", "expiring", "in_grace", "valid"];
const CHIP: Record<Exclude<TrainingStatus, "not_required">, ChipStatus> = { valid: "ok", expiring: "warning", expired: "overdue", missing: "danger", in_grace: "info" };

const dmy = (iso: string) => iso.split("-").reverse().join("/");

export default async function CompliancePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<SearchParams> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const { tenant } = await loadTrainingAccess(slug);
  const status = STATES.find((s) => s === sp.estado);
  const filter = {
    today: trainingToday(),
    siteId: sp.sede || undefined,
    positionId: sp.puesto || undefined,
    jobTaskId: sp.tarea || undefined,
    q: sp.q || undefined,
    status,
  };
  const [page, sites, positions, tasks] = await Promise.all([
    getMatrixPage(tenant.id, { ...filter, after: sp.despues }),
    listSites(tenant.id),
    listJobPositions(tenant.id),
    listJobTasks(tenant.id),
  ]);
  const base = `/t/${slug}/training`;
  const cells = new Map<string, ComplianceCell>(page.cells.map((c) => [`${c.personId}|${c.courseId}`, c]));
  const query = (extra: Record<string, string> = {}) => {
    const keep: Record<string, string> = {};
    for (const key of ["sede", "puesto", "tarea", "estado", "q"] as const) if (sp[key]) keep[key] = sp[key]!;
    return new URLSearchParams({ ...keep, ...extra }).toString();
  };
  const filtered = Boolean(sp.sede || sp.puesto || sp.tarea || status || sp.q);

  return (
    <SectionBlock
      title="Cumplimiento"
      what="Cada persona frente a los cursos obligatorios que se le exigen. El color y la fecha salen de los registros: no se marcan a mano."
      next="filtrá por sede, puesto o estado y tocá una persona para ver su ficha."
      actions={
        <a href={`${base}/compliance/export?${query()}`} className={buttonClass("secondary")} download>
          Exportar CSV
        </a>
      }
    >
      <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Filtros">
        <Field label="Buscar" hint="Por nombre o legajo.">
          <input name="q" defaultValue={sp.q ?? ""} className={INPUT_CLASS} />
        </Field>
        <SitePicker sites={sites.map((s) => ({ id: s.id, name: s.name }))} name="sede" label="Sede" defaultValue={sp.sede ?? ""} allLabel="Todas" />
        <Field label="Puesto">
          <select name="puesto" defaultValue={sp.puesto ?? ""} className={INPUT_CLASS}>
            <option value="">Todos</option>
            {positions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tarea">
          <select name="tarea" defaultValue={sp.tarea ?? ""} className={INPUT_CLASS}>
            <option value="">Todas</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Estado" hint="Personas con algún curso obligatorio en este estado.">
          <select name="estado" defaultValue={status ?? ""} className={INPUT_CLASS}>
            <option value="">Todos</option>
            {STATES.map((s) => (
              <option key={s} value={s}>
                {TRAINING_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex items-end gap-2">
          <Button type="submit" variant="secondary">
            Filtrar
          </Button>
          {filtered ? (
            <Link href={`${base}/compliance`} className={buttonClass("ghost")}>
              Limpiar
            </Link>
          ) : null}
        </div>
      </form>

      {page.columns.length === 0 ? (
        <EmptyState what="Todavía no hay cursos obligatorios para este filtro." next="marcá en Requisitos qué curso se exige." action={{ href: `${base}/requirements`, label: "Ir a Requisitos" }} />
      ) : page.people.length === 0 ? (
        <EmptyState what="Ninguna persona coincide con el filtro." next="probá con otra búsqueda o limpiá el filtro." />
      ) : (
        <>
          {page.hasMoreColumns ? (
            <p className="text-sm text-[var(--color-warning)]">
              Se muestran {MATRIX_MAX_COLUMNS} cursos. Filtrá por puesto o tarea para ver los demás, o exportá el CSV completo.
            </p>
          ) : null}
          <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-line)]">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Cumplimiento de capacitaciones por persona y curso</caption>
              <thead className="border-b border-[var(--color-line)] bg-[var(--color-surface-sunken)] text-xs text-[var(--color-ink-muted)]">
                <tr>
                  <th scope="col" className="sticky left-0 bg-[var(--color-surface-sunken)] px-4 py-2.5 font-semibold">Persona</th>
                  {page.columns.map((c) => (
                    <th key={c.id} scope="col" className="min-w-32 px-3 py-2.5 font-semibold">
                      {c.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-line)]">
                {page.people.map((p) => (
                  <tr key={p.id}>
                    <th scope="row" className="sticky left-0 bg-[var(--color-surface-raised)] px-4 py-2.5 font-medium">
                      <Link href={`${base}/people/${p.id}`} className="text-[var(--color-accent)] hover:underline">
                        {p.name}
                      </Link>
                      <span className="block font-[family-name:var(--font-mono)] text-[11px] font-normal text-[var(--color-ink-muted)]">{p.employeeCode}</span>
                    </th>
                    {page.columns.map((c) => {
                      const cell = cells.get(`${p.id}|${c.id}`);
                      return (
                        <td key={c.id} className="px-3 py-2.5 align-top">
                          {cell ? (
                            <div className="flex flex-col gap-1">
                              <StatusChip status={CHIP[cell.status]} label={TRAINING_STATUS_LABELS[cell.status]} />
                              {cell.validUntil ? <span className="text-xs tabular-nums text-[var(--color-ink-muted)]">hasta {dmy(cell.validUntil)}</span> : null}
                              {!cell.mandatory ? <span className="text-xs text-[var(--color-ink-muted)]">recomendado</span> : null}
                            </div>
                          ) : (
                            <span aria-label="No se exige" className="text-[var(--color-ink-muted)]">
                              —
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {page.nextCursor ? (
            <p>
              <Link href={`${base}/compliance?${query({ despues: page.nextCursor })}`} className={buttonClass("ghost")}>
                Ver las siguientes 50 personas
              </Link>
            </p>
          ) : null}
        </>
      )}
    </SectionBlock>
  );
}
