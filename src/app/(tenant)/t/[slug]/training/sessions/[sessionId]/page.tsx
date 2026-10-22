import Link from "next/link";
import { notFound } from "next/navigation";
import { loadTrainingAccess } from "@/app/(tenant)/t/[slug]/training/access";
import { getSession } from "@/lib/training-records";
import { AttachControl, VoidControl } from "@/app/(tenant)/t/[slug]/training/RecordControls";
import { SectionBlock, StatusChip, buttonClass } from "@/components/ui";

const day = (d: Date) => d.toISOString().slice(0, 10).split("-").reverse().join("/");
const LEVELS = { senior: "Superior", middle: "Intermedio", operational: "Operativo" } as const;

export default async function SessionPage({ params }: { params: Promise<{ slug: string; sessionId: string }> }) {
  const { slug, sessionId } = await params;
  const { tenant, canManage, canRecord } = await loadTrainingAccess(slug);
  const session = await getSession(tenant.id, sessionId);
  if (!session) notFound();
  const base = `/t/${slug}/training`;
  const active = session.records.filter((r) => !r.voidedAt);
  const passed = active.filter((r) => r.result === "passed").length;

  return (
    <div className="flex flex-col gap-6">
      <p>
        <Link href={`${base}/sessions`} className="text-sm font-medium text-[var(--color-accent)] hover:underline">
          ← Volver a Sesiones
        </Link>
      </p>

      <SectionBlock
        title={session.course.name}
        eyebrow={`Sesión del ${day(session.heldAt)}`}
        what={[
          session.site?.name,
          `${session.instructorKind === "internal" ? "Interno" : "Externo"}: ${session.instructorName}`,
          session.providerName,
          session.hours ? `${Number(session.hours)} h` : null,
          session.level ? `Nivel ${LEVELS[session.level]}` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <>
            {session.voidedAt ? <StatusChip status="pending" label="Anulada" /> : null}
            {!session.voidedAt ? (
              <Link href={`${base}/sessions/${session.id}/sheet`} className={buttonClass("secondary")}>
                Planilla para imprimir
              </Link>
            ) : null}
          </>
        }
      >
        {session.voidedAt ? <p className="text-sm text-[var(--color-danger)]">Anulada: {session.voidReason}</p> : null}
        <p className="text-sm">
          {active.length} asistente(s) · {passed} aprobó, {active.length - passed} no aprobó.
        </p>
        {canRecord && session.notes ? <p className="text-sm text-[var(--color-ink-muted)]">Observaciones: {session.notes}</p> : null}
      </SectionBlock>

      <SectionBlock title="Asistentes" what="Cada uno tiene su registro y su vencimiento, calculado con la vigencia del curso.">
        <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-line)]">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <caption className="sr-only">Asistentes de la sesión</caption>
            <thead className="border-b border-[var(--color-line)] bg-[var(--color-surface-sunken)] text-xs text-[var(--color-ink-muted)]">
              <tr>
                <th scope="col" className="px-4 py-2 font-semibold">Persona</th>
                <th scope="col" className="px-4 py-2 font-semibold">Puesto</th>
                <th scope="col" className="px-4 py-2 font-semibold">Resultado</th>
                <th scope="col" className="px-4 py-2 font-semibold">Vence</th>
                {canRecord ? <th scope="col" className="px-4 py-2 font-semibold">Nota</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-line)]">
              {session.records.map((r) => (
                <tr key={r.id} className={r.voidedAt ? "opacity-60" : ""}>
                  <td className="px-4 py-2.5">
                    <Link href={`${base}/people/${r.person.id}`} className="font-medium text-[var(--color-accent)] hover:underline">
                      {r.person.name}
                    </Link>
                    <span className="block font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-ink-muted)]">{r.person.employeeCode}</span>
                  </td>
                  <td className="px-4 py-2.5">{r.person.position.name}</td>
                  <td className="px-4 py-2.5">
                    <StatusChip status={r.result === "passed" ? "ok" : "danger"} label={r.result === "passed" ? "Aprobó" : "No aprobó"} />
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">{r.validUntil ? day(r.validUntil) : r.result === "passed" ? "No vence" : "—"}</td>
                  {canRecord ? <td className="px-4 py-2.5 tabular-nums">{r.score ?? "—"}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionBlock>

      <SectionBlock title="Planilla firmada" what="La planilla de asistencia con las firmas, escaneada o fotografiada.">
        {session.attachments.length === 0 ? (
          <p className="text-sm text-[var(--color-warning)]">Todavía no se subió la planilla.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {session.attachments.map((a) => (
              <li key={a.id}>
                <a href={`/api/training/attachments/${a.id}/download`} target="_blank" rel="noreferrer" className="text-[var(--color-accent)] underline">
                  {a.fileName}
                </a>
              </li>
            ))}
          </ul>
        )}
        {canRecord && !session.voidedAt ? <AttachControl slug={slug} kind="session" ownerId={session.id} label="Subir planilla firmada" /> : null}
      </SectionBlock>

      {canManage && !session.voidedAt ? (
        <div className="print:hidden">
          <VoidControl slug={slug} kind="session" id={session.id} label="Anular la sesión" />
        </div>
      ) : null}
    </div>
  );
}
