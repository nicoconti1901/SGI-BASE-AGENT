import Link from "next/link";
import { notFound } from "next/navigation";
import { loadTrainingAccess } from "@/app/(tenant)/t/[slug]/training/access";
import { getPersonFile } from "@/lib/training-records";
import { AttachControl, VoidControl } from "@/app/(tenant)/t/[slug]/training/RecordControls";
import { TRAINING_STATUS_LABELS, type TrainingStatus } from "@/domain/training/types";
import { EmptyState, SectionBlock, StatusChip, buttonClass, type ChipStatus } from "@/components/ui";

const CHIP: Record<TrainingStatus, ChipStatus> = { valid: "ok", expiring: "warning", expired: "overdue", missing: "danger", in_grace: "info", not_required: "pending" };
const BLOCKER_TEXT = { missing: "falta", expired: "vencido", in_grace: "todavía en plazo (no habilita)", ineffective: "no resultó eficaz" } as const;

const dmy = (iso: string) => iso.split("-").reverse().join("/");
const day = (d: Date) => dmy(d.toISOString().slice(0, 10));

export default async function PersonTrainingPage({ params }: { params: Promise<{ slug: string; personId: string }> }) {
  const { slug, personId } = await params;
  const { tenant, canManage, canRecord } = await loadTrainingAccess(slug);
  const file = await getPersonFile(tenant.id, personId);
  if (!file) notFound();
  const { person, statuses, summary, history, tasks, courseName, attachmentsByRecord } = file;
  const base = `/t/${slug}/training`;
  const required = statuses.filter((s) => s.status !== "not_required");
  const others = statuses.filter((s) => s.status === "not_required");

  return (
    <div className="flex flex-col gap-6">
      <p>
        <Link href={`${base}/compliance`} className="text-sm font-medium text-[var(--color-accent)] hover:underline">
          ← Volver a Cumplimiento
        </Link>
      </p>

      <SectionBlock
        title={person.name}
        eyebrow={`Legajo ${person.employeeCode}`}
        what={`${person.position.name} · ${person.site.name}${person.documentId ? ` · DNI ${person.documentId}` : ""}${person.employer === "contractor" ? " · Contratista" : ""}${person.status === "inactive" ? " · Dada de baja" : ""}`}
        actions={
          canRecord && person.status === "active" ? (
            <Link href={`${base}/sessions/individual?persona=${person.id}`} className={buttonClass("primary")}>
              Registrar capacitación
            </Link>
          ) : undefined
        }
      >
        <p className="text-sm">
          {summary.percent === null ? (
            "No tiene cursos obligatorios que medir."
          ) : (
            <>
              <strong>{summary.percent} % al día</strong> · {summary.valid + summary.expiring} de {summary.total} cursos obligatorios
              {summary.inGrace ? ` · ${summary.inGrace} en plazo` : ""}
            </>
          )}
        </p>
      </SectionBlock>

      <SectionBlock title="Cursos que se le exigen" what="Por su puesto, sus tareas y lo que se exige a todo el personal.">
        {required.length === 0 ? (
          <EmptyState what="No tiene cursos exigidos." next="se definen en Requisitos, por puesto, tarea o para todo el personal." />
        ) : (
          <ul className="divide-y divide-[var(--color-line)] rounded-[var(--radius-md)] border border-[var(--color-line)] text-sm">
            {required.map((s) => (
              <li key={s.courseId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <span>
                  <span className="font-medium">{s.courseName}</span>
                  {!s.mandatory ? <span className="ml-2 text-xs text-[var(--color-ink-muted)]">recomendado</span> : null}
                  {s.detail === "failed" ? <span className="ml-2 text-xs text-[var(--color-danger)]">último intento: no aprobó</span> : null}
                </span>
                <span className="flex items-center gap-3">
                  {s.validUntil ? (
                    <span className="text-xs tabular-nums text-[var(--color-ink-muted)]">
                      hasta {dmy(s.validUntil)}
                      {s.daysToExpiry !== null && s.status === "expiring" ? ` (${s.daysToExpiry} días)` : ""}
                    </span>
                  ) : null}
                  <StatusChip status={CHIP[s.status]} label={TRAINING_STATUS_LABELS[s.status]} />
                </span>
              </li>
            ))}
          </ul>
        )}
        {others.length > 0 ? (
          <details className="text-sm">
            <summary className="cursor-pointer font-medium">Otros cursos realizados ({others.length})</summary>
            <ul className="mt-2 list-disc pl-5 text-[var(--color-ink-muted)]">
              {others.map((s) => (
                <li key={s.courseId}>
                  {s.courseName}
                  {s.validUntil ? ` · hasta ${dmy(s.validUntil)}` : ""}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </SectionBlock>

      <SectionBlock title="Tareas para las que está habilitada" what="Una tarea crítica habilita solo con todos sus cursos obligatorios vigentes: «en plazo» no alcanza.">
        {tasks.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-muted)]">No tiene tareas asignadas en Datos maestros.</p>
        ) : (
          <ul className="divide-y divide-[var(--color-line)] rounded-[var(--radius-md)] border border-[var(--color-line)] text-sm">
            {tasks.map((t) => (
              <li key={t.id} className="flex flex-col gap-1 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {t.name}
                    {t.critical ? <span className="ml-2 text-xs text-[var(--color-warning)]">tarea crítica</span> : null}
                  </span>
                  {!t.qualification.hasRequirements ? (
                    <StatusChip status="pending" label="Sin requisitos definidos" />
                  ) : t.qualification.qualified ? (
                    <StatusChip status="ok" label="Habilitada" />
                  ) : (
                    <StatusChip status="danger" label="No habilitada" />
                  )}
                </div>
                {t.qualification.blockers.length > 0 ? (
                  <ul className="list-disc pl-5 text-[var(--color-ink-muted)]">
                    {t.qualification.blockers.map((b) => (
                      <li key={b.courseId}>
                        {courseName.get(b.courseId) ?? "Curso"}: {BLOCKER_TEXT[b.reason]}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {t.qualification.expiring.length > 0 ? (
                  <p className="text-xs text-[var(--color-warning)]">
                    Por vencer: {t.qualification.expiring.map((e) => `${courseName.get(e.courseId) ?? "Curso"} (${e.daysToExpiry} días)`).join(", ")}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </SectionBlock>

      <SectionBlock title="Historial" what="Todo lo realizado, incluso en un puesto anterior. Lo anulado queda a la vista con su motivo.">
        {history.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-muted)]">Todavía no hay capacitaciones registradas.</p>
        ) : (
          <ul className="divide-y divide-[var(--color-line)] rounded-[var(--radius-md)] border border-[var(--color-line)] text-sm">
            {history.map((r) => {
              const files = attachmentsByRecord[r.id] ?? [];
              return (
                <li key={r.id} className={`flex flex-col gap-2 px-4 py-3 ${r.voidedAt ? "opacity-70" : ""}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      <span className="font-medium">{courseName.get(r.courseId) ?? r.course.name}</span>
                      <span className="ml-2 tabular-nums text-[var(--color-ink-muted)]">{day(r.completedAt)}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <StatusChip status={r.result === "passed" ? "ok" : "danger"} label={r.result === "passed" ? "Aprobó" : "No aprobó"} />
                      {r.voidedAt ? <StatusChip status="pending" label="Anulado" /> : null}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--color-ink-muted)]">
                    {r.validUntil ? `Vence el ${day(r.validUntil)}` : r.result === "passed" ? "No vence" : ""}
                    {canRecord && r.score !== null ? ` · Nota ${r.score}` : ""}
                    {r.certificateNumber ? ` · Certificado ${r.certificateNumber}` : ""}
                    {r.providerName ? ` · ${r.providerName}` : ""}
                    {r.source === "import" && files.length === 0 ? " · Sin evidencia" : ""}
                  </p>
                  {r.voidedAt ? <p className="text-xs text-[var(--color-danger)]">Anulado: {r.voidReason}</p> : null}
                  {files.length > 0 ? (
                    <ul className="flex flex-wrap gap-3 text-xs">
                      {files.map((f) => (
                        <li key={f.id}>
                          <a href={`/api/training/attachments/${f.id}/download`} target="_blank" rel="noreferrer" className="text-[var(--color-accent)] underline">
                            {f.fileName}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {!r.voidedAt ? (
                    <div className="flex flex-col gap-2 print:hidden">
                      {canRecord ? <AttachControl slug={slug} kind="record" ownerId={r.id} label="Adjuntar certificado" /> : null}
                      {canManage ? <VoidControl slug={slug} kind="record" id={r.id} /> : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </SectionBlock>
    </div>
  );
}
