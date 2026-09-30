import Link from "next/link";
import { notFound } from "next/navigation";
import { getObjective } from "@/lib/objectives";
import { listTenantMemberOptions } from "@/lib/findings";
import { AUDIT_STANDARD_LABELS } from "@/domain/audits/types";
import {
  DIRECTION_LABELS,
  FREQUENCY_LABELS,
  KIND_LABELS,
  MEASUREMENT_STATUS_LABELS,
  MEASUREMENT_STATUS_TONE,
  OBJECTIVE_STATUS_LABELS,
} from "@/domain/indicators/types";
import {
  CloseObjectiveForm,
  CreateIndicatorForm,
  EditIndicatorForm,
  EditObjectiveForm,
  ToggleIndicatorButton,
} from "@/app/(tenant)/t/[slug]/indicators/ObjectiveForms";
import {
  formatDate,
  loadIndicatorsAccess,
  toDateInput,
} from "@/app/(tenant)/t/[slug]/indicators/access";

export default async function ObjectivePage({
  params,
}: {
  params: Promise<{ slug: string; objectiveId: string }>;
}) {
  const { slug, objectiveId } = await params;
  const { tenant, canManage } = await loadIndicatorsAccess(slug);
  const [objective, members] = await Promise.all([
    getObjective(tenant.id, objectiveId),
    listTenantMemberOptions(tenant.id),
  ]);
  if (!objective) notFound();

  const options = members.map((m) => ({ id: m.id, name: m.name }));
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? "Sin asignar";
  const open = objective.status === "active";
  const editable = canManage && open;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-8">
      <header>
        <Link href={`/t/${slug}/indicators`} className="text-sm text-[var(--color-accent)]">
          ← Objetivos e indicadores
        </Link>
        <p className="mt-2 font-[family-name:var(--font-mono)] text-xs text-[var(--color-ink-muted)]">
          {objective.code} · {OBJECTIVE_STATUS_LABELS[objective.status]}
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">{objective.title}</h1>
        {objective.closingNote ? (
          <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
            Cierre{objective.closedAt ? ` (${formatDate(objective.closedAt)})` : ""}: {objective.closingNote}
          </p>
        ) : null}
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="font-[family-name:var(--font-display)] text-xl">Objetivo</h2>
        {editable ? (
          <EditObjectiveForm
            slug={slug}
            objectiveId={objective.id}
            members={options}
            defaults={{
              title: objective.title,
              description: objective.description,
              standards: objective.standards,
              ownerUserId: objective.ownerUserId,
              dueDate: toDateInput(objective.dueDate),
              plan: objective.plan,
            }}
          />
        ) : (
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[10rem_1fr]">
            <dt className="font-medium">Normas</dt>
            <dd>{objective.standards.map((s) => AUDIT_STANDARD_LABELS[s]).join(", ")}</dd>
            <dt className="font-medium">Responsable</dt>
            <dd>{nameOf(objective.ownerUserId)}</dd>
            <dt className="font-medium">Fecha de cumplimiento</dt>
            <dd>{formatDate(objective.dueDate)}</dd>
            <dt className="font-medium">Descripción</dt>
            <dd>{objective.description || "—"}</dd>
            <dt className="font-medium">Plan</dt>
            <dd>{objective.plan || "—"}</dd>
          </dl>
        )}
      </section>

      <section className="flex flex-col gap-3 border-t border-[var(--color-line)] pt-6">
        <h2 className="font-[family-name:var(--font-display)] text-xl">Indicadores</h2>
        {objective.indicators.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-muted)]">
            Este objetivo todavía no tiene indicadores: sin ellos no se puede medir el avance.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {objective.indicators.map((i) => {
              const last = i.measurements[0];
              const status = last ? last.status : "no_data";
              return (
                <li
                  key={i.id}
                  className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--color-line)] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">
                        <Link
                          href={`/t/${slug}/indicators/${objective.id}/${i.id}`}
                          className="hover:underline"
                        >
                          {i.name}
                        </Link>
                        {!i.active ? (
                          <span className="ml-2 text-xs text-[var(--color-ink-muted)]">(desactivado)</span>
                        ) : null}
                      </p>
                      <p className="text-xs text-[var(--color-ink-muted)]">
                        {DIRECTION_LABELS[i.direction]} · Meta {i.target} {i.unit}
                        {i.alertThreshold !== null ? ` · Alerta ${i.alertThreshold}` : ""}
                        {" · "}
                        {FREQUENCY_LABELS[i.frequency]} · {KIND_LABELS[i.kind]}
                        {" · Carga: "}
                        {nameOf(i.ownerUserId)}
                      </p>
                    </div>
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-semibold ${MEASUREMENT_STATUS_TONE[status]}`}
                    >
                      {MEASUREMENT_STATUS_LABELS[status]}
                    </span>
                  </div>
                  {editable ? (
                    <details className="text-sm">
                      <summary className="cursor-pointer font-medium text-[var(--color-accent)]">
                        Editar indicador
                      </summary>
                      <div className="mt-3 flex flex-col gap-4">
                        <EditIndicatorForm
                          slug={slug}
                          objectiveId={objective.id}
                          indicatorId={i.id}
                          members={options}
                          defaults={{
                            name: i.name,
                            formula: i.formula,
                            unit: i.unit,
                            direction: i.direction,
                            target: String(i.target),
                            alertThreshold: i.alertThreshold === null ? "" : String(i.alertThreshold),
                            frequency: i.frequency,
                            kind: i.kind,
                            ownerUserId: i.ownerUserId,
                          }}
                        />
                        <ToggleIndicatorButton
                          slug={slug}
                          objectiveId={objective.id}
                          indicatorId={i.id}
                          active={i.active}
                        />
                      </div>
                    </details>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        {editable ? (
          <div className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--color-line)] p-4">
            <h3 className="text-sm font-semibold">Agregar indicador</h3>
            <CreateIndicatorForm slug={slug} objectiveId={objective.id} members={options} />
          </div>
        ) : null}
      </section>

      {editable ? (
        <div className="border-t border-[var(--color-line)] pt-4">
          <CloseObjectiveForm slug={slug} objectiveId={objective.id} />
        </div>
      ) : null}
    </div>
  );
}
