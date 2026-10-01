import Link from "next/link";
import { notFound } from "next/navigation";
import { getPerson, listJobPositions, listJobTasks, listPersonHistory, listSites } from "@/lib/masterdata";
import { listTenantMemberOptions } from "@/lib/findings";
import { loadMasterDataAccess } from "@/app/(tenant)/t/[slug]/master-data/access";
import { PersonActiveToggle, PersonForm, PersonTasksForm } from "@/app/(tenant)/t/[slug]/master-data/PersonForms";
import { EMPLOYER_LABELS } from "@/domain/masterdata/types";
import { SectionBlock, StatusChip } from "@/components/ui";

const date = (d: Date) => d.toLocaleDateString("es-AR", { timeZone: "UTC" });

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.06em] text-[var(--color-ink-muted)]">{label}</dt>
      <dd className="mt-0.5 text-sm">{children}</dd>
    </div>
  );
}

export default async function PersonPage({ params }: { params: Promise<{ slug: string; personId: string }> }) {
  const { slug, personId } = await params;
  const { tenant, canManage, canAssignTasks } = await loadMasterDataAccess(slug);
  const person = await getPerson(tenant.id, personId);
  if (!person) notFound();

  const active = person.status === "active";
  const [sites, positions, tasks, members, history] = await Promise.all([
    canManage && active ? listSites(tenant.id) : Promise.resolve([]),
    canManage && active ? listJobPositions(tenant.id) : Promise.resolve([]),
    (canManage || canAssignTasks) && active ? listJobTasks(tenant.id) : Promise.resolve([]),
    canManage && active ? listTenantMemberOptions(tenant.id) : Promise.resolve([]),
    listPersonHistory(tenant.id, person.id),
  ]);
  const taskOptions = tasks.map((t) => ({ id: t.id, name: t.name, critical: t.critical }));
  const memberName = members.find((m) => m.id === person.userId)?.name;

  return (
    <div className="flex flex-col gap-6">
      <p>
        <Link href={`/t/${slug}/master-data/people`} className="text-sm font-medium text-[var(--color-accent)] hover:underline">
          ← Volver a personas
        </Link>
      </p>

      <SectionBlock
        title={person.name}
        eyebrow={`Legajo ${person.employeeCode}`}
        actions={<StatusChip status={active ? "ok" : "pending"} label={active ? "Activa" : `De baja${person.inactiveAt ? ` · ${date(person.inactiveAt)}` : ""}`} />}
      >
        {canManage && active ? (
          <PersonForm
            slug={slug}
            sites={sites.map((s) => ({ id: s.id, name: s.name }))}
            positions={positions.map((p) => ({ id: p.id, name: p.name }))}
            tasks={taskOptions}
            members={members.map((m) => ({ id: m.id, name: m.name }))}
            person={{
              id: person.id,
              employeeCode: person.employeeCode,
              name: person.name,
              documentId: person.documentId,
              userId: person.userId,
              employer: person.employer,
              contractorName: person.contractorName,
              siteId: person.siteId,
              extraSiteIds: person.extraSites.map((e) => e.siteId),
              positionId: person.positionId,
              hiredAt: person.hiredAt ? person.hiredAt.toISOString().slice(0, 10) : null,
              jobTaskIds: person.jobTasks.map((t) => t.jobTaskId),
            }}
          />
        ) : (
          <dl className="grid gap-4 sm:grid-cols-2">
            <Item label="DNI">{person.documentId ?? "—"}</Item>
            <Item label="Empresa">
              {EMPLOYER_LABELS[person.employer]}
              {person.contractorName ? ` · ${person.contractorName}` : ""}
            </Item>
            <Item label="Puesto">{person.position.name}</Item>
            <Item label="Sede base">{person.site.name}</Item>
            <Item label="Sedes adicionales">{person.extraSites.length ? person.extraSites.map((e) => e.site.name).join(", ") : "—"}</Item>
            <Item label="Ingreso">{person.hiredAt ? date(person.hiredAt) : "—"}</Item>
            <Item label="Tareas">
              {person.jobTasks.length
                ? person.jobTasks.map((t) => `${t.jobTask.name}${t.jobTask.critical ? " (crítica)" : ""}`).join(", ")
                : "—"}
            </Item>
            {memberName ? <Item label="Usuario del sistema">{memberName}</Item> : null}
          </dl>
        )}
      </SectionBlock>

      {canAssignTasks && !canManage && active ? (
        <SectionBlock title="Tareas asignadas" what="Qué trabajos realiza esta persona." next="marcá las tareas que hace hoy; las críticas exigen habilitación.">
          <PersonTasksForm slug={slug} personId={person.id} tasks={taskOptions} selected={person.jobTasks.map((t) => t.jobTaskId)} />
        </SectionBlock>
      ) : null}

      {canManage ? (
        <SectionBlock
          title={active ? "Dar de baja" : "Reactivar"}
          what={active ? "La baja es lógica: deja de aparecer en los selectores pero conserva su historial." : "Vuelve a aparecer en los selectores."}
        >
          <PersonActiveToggle slug={slug} personId={person.id} active={active} name={person.name} />
        </SectionBlock>
      ) : null}

      <SectionBlock title="Historial de cambios" what="Quién modificó esta ficha y cuándo.">
        {history.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-muted)]">Todavía no hay cambios registrados.</p>
        ) : (
          <ul className="divide-y divide-[var(--color-line)] rounded-[var(--radius-lg)] border border-[var(--color-line)]">
            {history.map((h) => (
              <li key={h.id} className="flex flex-wrap justify-between gap-2 px-4 py-2.5 text-sm">
                <span>{h.summary}</span>
                <span className="font-[family-name:var(--font-mono)] text-xs text-[var(--color-ink-muted)]">{h.createdAt.toLocaleString("es-AR")}</span>
              </li>
            ))}
          </ul>
        )}
      </SectionBlock>
    </div>
  );
}
