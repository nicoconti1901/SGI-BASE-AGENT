import { getFieldAuditFormOptions, getFieldAuditProgram } from "@/lib/inspection-field-audit";
import { loadInspectionsAccess } from "@/app/(tenant)/t/[slug]/inspections/access";
import { setMonthlyTargetAction, startFieldAuditAction } from "@/app/(tenant)/t/[slug]/inspections/campo/actions";
import { SPECIAL_TASKS } from "@/domain/inspections/templates/field-audit";
import { Button, EmptyState, Field, FormError, INPUT_CLASS, SectionBlock, StatusChip } from "@/components/ui";

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function monthLabel(month: string) {
  const [year, m] = month.split("-");
  return `${MONTHS[Number(m) - 1]} de ${year}`;
}

export default async function FieldAuditPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ q?: string; error?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const { tenant, canWrite, canManageAssets } = await loadInspectionsAccess(slug);
  const q = sp.q?.trim();
  const [program, options] = await Promise.all([
    getFieldAuditProgram(tenant.id, { q: q || undefined }),
    canWrite ? getFieldAuditFormOptions(tenant.id) : Promise.resolve({ tasks: [], people: [] }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      {sp.error ? <FormError>{sp.error}</FormError> : null}
      {canWrite ? (
        <SectionBlock title="Nueva auditoría en campo" eyebrow="Actividad en curso" what="Una auditoría mira cómo se trabaja en el frente: documentos, personas y condiciones. Marcá las tareas especiales para sumar sus controles." next="completá los datos y tocá Empezar.">
          <form action={startFieldAuditAction.bind(null, slug)} className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Sede" htmlFor="siteId" required>
                <select id="siteId" name="siteId" required defaultValue="" className={`${INPUT_CLASS} min-h-12`}>
                  <option value="" disabled>
                    Elegí la sede
                  </option>
                  {program.sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Tarea auditada" htmlFor="jobTaskId" hint="Opcional.">
                <select id="jobTaskId" name="jobTaskId" defaultValue="" className={`${INPUT_CLASS} min-h-12`}>
                  <option value="">Sin tarea</option>
                  {options.tasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Contratista" htmlFor="contractorName" hint="Opcional. Si la tarea la hace un tercero.">
                <input id="contractorName" name="contractorName" maxLength={120} autoComplete="off" className={`${INPUT_CLASS} min-h-12`} />
              </Field>
              <Field label="Supervisor" htmlFor="supervisorPersonId" hint="Opcional.">
                <select id="supervisorPersonId" name="supervisorPersonId" defaultValue="" className={`${INPUT_CLASS} min-h-12`}>
                  <option value="">Sin supervisor</option>
                  {options.people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.employeeCode})
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-semibold">Tareas especiales</legend>
              <div className="flex flex-wrap gap-3">
                {Object.entries(SPECIAL_TASKS).map(([key, label]) => (
                  <label key={key} className="flex min-h-12 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-line)] px-3">
                    <input type="checkbox" name="specialTasks" value={key} className="h-5 w-5" />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            <div>
              <Button type="submit" className="min-h-12 w-full sm:w-auto">
                Empezar la auditoría
              </Button>
            </div>
          </form>
        </SectionBlock>
      ) : null}

      <SectionBlock title={`Programa de ${monthLabel(program.month)}`} what="Auditorías cerradas este mes contra la meta mensual de cada sede." next={canManageAssets ? "fijá la meta de cada sede para ver el cumplimiento." : "pedile al administrador que fije la meta de cada sede."}>
        <form method="get" className="flex flex-wrap items-end gap-3" aria-label="Buscar sede">
          <div className="min-w-[14rem] flex-1">
            <Field label="Buscar sede">
              <input name="q" defaultValue={q ?? ""} autoComplete="off" className={`${INPUT_CLASS} min-h-12`} />
            </Field>
          </div>
          <Button type="submit" variant="secondary" className="min-h-12">
            Buscar
          </Button>
        </form>
        {program.sites.length === 0 ? (
          <EmptyState what={q ? "Ninguna sede coincide con la búsqueda." : "Todavía no hay sedes."} next={q ? "probá con otro nombre." : "cargalas en Datos maestros."} />
        ) : (
          <ul className="flex flex-col gap-2">
            {program.sites.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-line)] p-3">
                <div className="min-w-0">
                  <p className="font-semibold">{s.name}</p>
                  <p className="text-sm text-[var(--color-ink-muted)]" data-testid={`program-${s.name}`}>
                    {s.status === "no_target" ? `${s.done} auditoría(s) este mes · sin meta` : `${s.done} de ${s.target} auditorías · ${s.pct} %`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {s.status === "met" ? <StatusChip status="ok" label="Cumplida" /> : null}
                  {s.status === "pending" ? <StatusChip status="pending" label={`Faltan ${s.remaining}`} /> : null}
                  {canManageAssets ? (
                    <form action={setMonthlyTargetAction.bind(null, slug, s.id)} className="flex items-center gap-2">
                      <label className="sr-only" htmlFor={`target-${s.id}`}>
                        Meta mensual de {s.name}
                      </label>
                      <input id={`target-${s.id}`} name="target" type="number" inputMode="numeric" min={1} max={100} defaultValue={s.target || ""} placeholder="Meta" className={`${INPUT_CLASS} min-h-12 w-24`} />
                      <Button type="submit" variant="secondary" className="min-h-12" aria-label={`Guardar la meta de ${s.name}`}>
                        Guardar
                      </Button>
                    </form>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionBlock>
    </div>
  );
}
